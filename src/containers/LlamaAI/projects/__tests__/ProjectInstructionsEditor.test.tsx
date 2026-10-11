// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { AI_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import {
	getInstructionsBlurAction,
	getInstructionsSaveStatus,
	isInstructionsDraftDirty,
	reconcileInstructionsDraft
} from '../instructionsDraft'
import { ProjectInstructionsEditor } from '../ProjectInstructionsEditor'

const idle = { isPending: false, hasError: false }

describe('instructions draft', () => {
	test('adopts fresh server text only while the draft is clean and nothing is saving', () => {
		const clean = { value: 'Original', savedValue: 'Original', edited: false }
		expect(reconcileInstructionsDraft(clean, 'Server refresh', false)).toEqual({
			value: 'Server refresh',
			savedValue: 'Server refresh',
			edited: false
		})
		expect(reconcileInstructionsDraft(clean, 'Server refresh', true).value).toBe('Original')
		const dirty = { value: 'Local draft', savedValue: 'Original', edited: true }
		expect(reconcileInstructionsDraft(dirty, 'Server refresh', false)).toEqual({
			value: 'Local draft',
			savedValue: 'Server refresh',
			edited: true
		})
	})

	test('keeps a focused edit when an earlier save is acknowledged', () => {
		const typedBack = { value: 'Original', savedValue: 'Original', edited: true }
		expect(reconcileInstructionsDraft(typedBack, 'Submitted draft', false).value).toBe('Original')
	})

	test('labels a newer edit Unsaved after an earlier save finishes', () => {
		const draft = reconcileInstructionsDraft(
			{ value: 'Newer edit', savedValue: 'Original', edited: true },
			'Submitted draft',
			false
		)
		expect(getInstructionsSaveStatus({ ...idle, dirty: isInstructionsDraftDirty(draft) })).toBe('unsaved')
	})

	test('saves the trimmed draft on blur and clears whitespace-only text to null', () => {
		const draft = (value: string) => ({ value, savedValue: 'Original', edited: true })
		expect(getInstructionsBlurAction(draft('  Updated  '), idle)).toEqual({ type: 'save', value: 'Updated' })
		expect(getInstructionsBlurAction(draft('  '), idle)).toEqual({ type: 'save', value: null })
	})

	test('does not submit a changed-then-restored draft unless a save is in flight', () => {
		const restored = { value: 'Saved instructions', savedValue: 'Saved instructions', edited: true }
		expect(getInstructionsBlurAction(restored, idle)).toEqual({ type: 'clear-edited' })
		expect(getInstructionsBlurAction({ ...restored, edited: false }, idle)).toEqual({ type: 'none' })
		// Typing back to the saved text must supersede the in-flight save of other text.
		expect(getInstructionsBlurAction(restored, { isPending: true, hasError: false })).toEqual({
			type: 'save',
			value: 'Saved instructions'
		})
	})

	test('waits for an explicit retry after a failed save', () => {
		const dirty = { value: 'Retry me', savedValue: 'Original', edited: true }
		expect(getInstructionsBlurAction(dirty, { isPending: false, hasError: true })).toEqual({ type: 'none' })
	})

	test('reports saving before failure and failure before unsaved text', () => {
		expect(getInstructionsSaveStatus({ isPending: true, hasError: true, dirty: true })).toBe('saving')
		expect(getInstructionsSaveStatus({ isPending: false, hasError: true, dirty: true })).toBe('failed')
		expect(getInstructionsSaveStatus({ ...idle, dirty: true })).toBe('unsaved')
		expect(getInstructionsSaveStatus({ ...idle, dirty: false })).toBe('saved')
	})
})

describe('ProjectInstructionsEditor', () => {
	const session = installSubscriberSession('owner')
	let container: HTMLDivElement
	let root: Root
	let patchReplies: Array<Response>
	const patches = () =>
		session.requests.filter(({ init }) => init?.method === 'PATCH').map(({ init }) => JSON.parse(init!.body as string))

	beforeEach(() => {
		patchReplies = []
		session.serve({
			[`${AI_SERVER}/projects/project-1`]: (_url: URL, init?: RequestInit) =>
				patchReplies.shift() ?? { project: { id: 'project-1', ...JSON.parse(init!.body as string) } }
		})
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	function type(textarea: HTMLTextAreaElement, value: string) {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, value)
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
	}
	const status = () => container.querySelector('[role="status"]')?.textContent

	test('shows a failed save inline and retries the current draft once', async () => {
		patchReplies.push(Response.json({ error: 'Network unavailable' }, { status: 500 }))
		await act(async () =>
			root.render(
				<session.Wrapper>
					<ProjectInstructionsEditor projectId="project-1" value="Original" />
				</session.Wrapper>
			)
		)
		const textarea = container.querySelector('textarea')!
		expect(textarea.labels?.[0].textContent).toBe('Instructions')
		expect(status()).toBe('Saved')

		await act(async () => type(textarea, '  First draft  '))
		expect(status()).toBe('Unsaved')
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		await waitForUi(() => expect(status()).toBe('Not saved'), { timeout: 1000 })
		expect(container.querySelector('[role="alert"]')?.textContent).not.toContain('Network unavailable')
		expect(textarea.getAttribute('aria-invalid')).toBe('true')

		await act(async () => type(textarea, 'Retry this newer draft'))
		await act(async () => {
			textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
			container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click()
		})
		await waitForUi(() => expect(container.querySelector('[role="alert"]')).toBeNull(), { timeout: 1000 })
		expect(patches()).toEqual([
			{ custom_instructions: 'First draft' },
			{ custom_instructions: 'Retry this newer draft' }
		])
	})
})
