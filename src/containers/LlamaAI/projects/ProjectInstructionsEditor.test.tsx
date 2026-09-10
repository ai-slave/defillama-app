// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ProjectInstructionsEditor } from './ProjectInstructionsEditor'

const updateProject = vi.fn<(body: { custom_instructions: string | null }) => Promise<void>>()
let projectUpdatePending = false
let projectUpdateError: Error | null = null

vi.mock('./hooks', () => ({
	useUpdateProject: () => ({ isPending: projectUpdatePending, error: projectUpdateError, mutate: updateProject })
}))

vi.mock('react-hot-toast', () => ({
	default: { success: vi.fn(), error: vi.fn() }
}))

describe('ProjectInstructionsEditor', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		projectUpdatePending = false
		projectUpdateError = null
		updateProject.mockResolvedValue(undefined)
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	async function render(projectId: string, value: string | null) {
		await act(async () =>
			root.render(<ProjectInstructionsEditor key={projectId} projectId={projectId} value={value} />)
		)
		return container.querySelector('textarea') as HTMLTextAreaElement
	}

	function change(textarea: HTMLTextAreaElement, value: string) {
		const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
		setValue?.call(textarea, value)
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
	}

	test('does not submit a changed-then-restored draft without a pending save', async () => {
		const textarea = await render('project-1', 'Saved instructions')

		await act(async () => change(textarea, 'Changed instructions'))
		expect(container.textContent).toContain('Unsaved')

		await act(async () => change(textarea, 'Saved instructions'))
		expect(container.textContent).not.toContain('Unsaved')
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		expect(updateProject).not.toHaveBeenCalled()

		const refreshed = await render('project-1', 'Server refresh')
		expect(refreshed.value).toBe('Server refresh')
	})

	test('preserves a dirty draft when fresh project data arrives', async () => {
		const textarea = await render('project-1', 'Original')
		await act(async () => change(textarea, 'Local draft'))

		const refreshed = await render('project-1', 'Server refresh')

		expect(refreshed.value).toBe('Local draft')
		expect(container.textContent).toContain('Unsaved')
	})

	test('adopts fresh project data when the draft is clean', async () => {
		await render('project-1', 'Original')

		const refreshed = await render('project-1', 'Server refresh')

		expect(refreshed.value).toBe('Server refresh')
		expect(container.textContent).not.toContain('Unsaved')
	})

	test('saves the trimmed draft on blur', async () => {
		const textarea = await render('project-1', 'Original')
		await act(async () => change(textarea, '  Updated instructions  '))
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

		expect(updateProject).toHaveBeenCalledOnce()
		expect(updateProject).toHaveBeenCalledWith({ custom_instructions: 'Updated instructions' })
	})

	test('submits a newer draft while an earlier save is pending', async () => {
		let resolveFirstSave: (() => void) | null = null
		updateProject.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirstSave = resolve)))
		const textarea = await render('project-1', 'Original')

		await act(async () => change(textarea, 'First draft'))
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		await act(async () => change(textarea, 'Latest draft'))
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

		expect(updateProject).toHaveBeenCalledTimes(2)
		expect(updateProject).toHaveBeenLastCalledWith({ custom_instructions: 'Latest draft' })
		await act(async () => {
			resolveFirstSave?.()
			await Promise.resolve()
		})
	})

	test('restores the saved value after a different draft starts saving', async () => {
		let resolveFirstSave: (() => void) | null = null
		updateProject.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirstSave = resolve)))
		const textarea = await render('project-1', 'Original')

		await act(async () => change(textarea, 'Temporary draft'))
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		projectUpdatePending = true
		await render('project-1', 'Original')
		await act(async () => change(textarea, 'Original'))
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

		expect(updateProject).toHaveBeenCalledTimes(2)
		expect(updateProject).toHaveBeenLastCalledWith({ custom_instructions: 'Original' })
		await act(async () => {
			resolveFirstSave?.()
			await Promise.resolve()
		})
	})

	test('preserves a focused edit when an earlier save is acknowledged', async () => {
		let resolveFirstSave: (() => void) | null = null
		updateProject.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveFirstSave = resolve)))
		const textarea = await render('project-1', 'Original')

		await act(async () => change(textarea, 'Submitted draft'))
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		projectUpdatePending = true
		await render('project-1', 'Original')
		await act(async () => change(textarea, 'Original'))
		const acknowledged = await render('project-1', 'Submitted draft')

		expect(acknowledged.value).toBe('Original')
		await act(async () => resolveFirstSave?.())
	})
	test('reports pending and failed saves accurately, then retries the current draft once', async () => {
		const textarea = await render('project-1', 'Original')
		expect(container.querySelector('[role="status"]')?.textContent).toBe('Saved')
		expect(textarea.labels?.[0].textContent).toBe('Instructions')
		await act(async () => change(textarea, 'First draft'))
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		projectUpdatePending = true
		await render('project-1', 'Original')
		expect(container.querySelector('[role="status"]')?.textContent).toContain('Saving…')
		projectUpdatePending = false
		projectUpdateError = new Error('Network unavailable')
		await render('project-1', 'Original')
		expect(container.querySelector('[role="status"]')?.textContent).toBe('Not saved')
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('Network unavailable')
		expect(textarea.getAttribute('aria-invalid')).toBe('true')
		expect(textarea.value).toBe('First draft')
		await act(async () => change(textarea, 'Retry this newer draft'))
		await act(async () => {
			textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
			container.querySelector<HTMLButtonElement>('button')!.click()
		})
		expect(updateProject).toHaveBeenCalledTimes(2)
		expect(updateProject).toHaveBeenLastCalledWith({ custom_instructions: 'Retry this newer draft' })
		projectUpdateError = null
		await render('project-1', 'Retry this newer draft')
		expect(container.querySelector('[role="status"]')?.textContent).toBe('Saved')
		expect(container.querySelector('[role="alert"]')).toBeNull()
	})

	test('does not label a newer edit Saved when an earlier save finishes', async () => {
		const textarea = await render('project-1', 'Original')
		await act(async () => change(textarea, 'Submitted draft'))
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		await act(async () => change(textarea, 'Newer edit'))
		await render('project-1', 'Submitted draft')
		expect(textarea.value).toBe('Newer edit')
		expect(container.querySelector('[role="status"]')?.textContent).toBe('Unsaved')
	})

	test('clearing instructions saves null and returns to Saved after acknowledgement', async () => {
		const textarea = await render('project-1', 'Original')
		await act(async () => change(textarea, '  '))
		await act(async () => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
		expect(updateProject).toHaveBeenLastCalledWith({ custom_instructions: null })
		await render('project-1', null)
		expect(container.querySelector('[role="status"]')?.textContent).toBe('Saved')
	})
})
