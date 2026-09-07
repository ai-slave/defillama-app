// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueueChips } from '~/containers/LlamaAI/components/QueueChips'
import type { QueueSurface, QueueServerRow } from '~/containers/LlamaAI/hooks/useChatQueueController'

function pending(overrides: Partial<QueueServerRow> = {}): QueueServerRow {
	return {
		kind: 'server',
		id: 'q1',
		state: 'pending',
		message: 'What is the TVL of Aave?',
		researchMode: false,
		client: 'web',
		queuedAt: '2026-08-21T10:00:00.000Z',
		...overrides
	} as QueueServerRow
}

function surface(overrides: Partial<QueueSurface> = {}): QueueSurface {
	return {
		rows: [],
		ownedEditId: null,
		rowStatus: {},
		onEditStart: vi.fn(),
		onEditDraftChange: vi.fn(),
		onEditSave: vi.fn(),
		onEditCancel: vi.fn(),
		onDismiss: vi.fn(),
		onRetry: vi.fn(),
		onContinue: vi.fn(),
		onClear: vi.fn(),
		queueAction: null,
		queueActionError: null,
		...overrides
	}
}

describe('QueueChips', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
	})

	async function render(queueSurface: QueueSurface, quotaResetTime?: string | null) {
		await act(async () =>
			root.render(<QueueChips surface={queueSurface} {...(quotaResetTime === undefined ? {} : { quotaResetTime })} />)
		)
	}

	test('keeps an in-flight local row non-interactive', async () => {
		await render(
			surface({
				rows: [
					{
						kind: 'local',
						id: 'temp-1',
						state: 'adding',
						payload: { clientMutationId: 'mutation-1', message: 'Follow up', researchMode: false, client: 'web' }
					}
				]
			})
		)

		expect(container.textContent).toContain('Adding…')
		expect(container.querySelector('button')).toBeNull()
	})

	test('preserves the chip node when the server confirms an optimistic row', async () => {
		await render(
			surface({
				rows: [
					{
						kind: 'local',
						id: 'temp-1',
						state: 'adding',
						payload: { clientMutationId: 'mutation-1', message: 'Follow up', researchMode: false, client: 'web' }
					}
				]
			})
		)
		const optimisticNode = container.querySelector('li')

		await render(surface({ rows: [pending({ clientMutationId: 'mutation-1' })] }))

		expect(container.querySelector('li')).toBe(optimisticNode)
		expect(container.textContent).not.toContain('Adding…')
	})

	test('offers one Continue action for a paused queue', async () => {
		const onContinue = vi.fn()
		await render(
			surface({
				rows: [
					pending({ state: 'not_sent', reason: 'execution_failed' }),
					pending({ id: 'q2', state: 'not_sent', reason: 'execution_failed' })
				],
				onContinue
			})
		)

		expect(container.textContent).toContain('Queue paused')
		expect(container.querySelector('[aria-label="Retry"]')).toBeNull()
		const continueButton = [...container.querySelectorAll('button')].find(
			(button) => button.textContent === 'Continue queue'
		)
		await act(async () => continueButton?.click())
		expect(onContinue).toHaveBeenCalledOnce()
	})

	test('keeps Retry clear available after an ambiguous Clear failure', async () => {
		const onClear = vi.fn()
		await render(
			surface({
				rows: [
					{
						kind: 'local',
						id: 'temp-1',
						state: 'waiting',
						payload: { clientMutationId: 'mutation-1', message: 'Follow up', researchMode: false, client: 'web' }
					}
				],
				onClear,
				queueActionError: { action: 'clearing', message: 'Could not clear the queue. Try again.' }
			})
		)

		const retryClear = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Retry clear')
		await act(async () => retryClear?.click())

		expect(onClear).not.toHaveBeenCalled()
		const dialog = document.querySelector('[role="dialog"]')!
		expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
			'Clear all queued prompts?'
		)
		const confirm = [...dialog.querySelectorAll('button')].find((button) => button.textContent === 'Clear queue')!
		await act(async () => confirm.click())
		expect(onClear).toHaveBeenCalledOnce()
	})

	test('waits for the editing snapshot before rendering the editor', async () => {
		const onEditStart = vi.fn()
		const initial = surface({ rows: [pending()], onEditStart })
		await render(initial)
		await act(async () => (container.querySelector('[aria-label="Edit"]') as HTMLButtonElement).click())

		expect(onEditStart).toHaveBeenCalledWith('q1')
		expect(container.querySelector('textarea')).toBeNull()

		await render(
			surface({
				...initial,
				ownedEditId: 'q1',
				rows: [pending({ state: 'editing', editLeaseId: 'lease-1', editExpiresAt: 'later' })]
			})
		)
		expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toContain('TVL')
	})

	test('does not expose another client editing reservation', async () => {
		await render(
			surface({
				rows: [pending({ state: 'editing', editLeaseId: 'lease-1', editExpiresAt: 'later' })]
			})
		)

		expect(container.textContent).toContain('Being edited')
		expect(container.querySelector('textarea')).toBeNull()
		expect(container.querySelector('button')).toBeNull()
	})

	test('keeps a rejected edit copyable after another client takes the lease', async () => {
		await render(
			surface({
				rows: [pending({ state: 'editing', editLeaseId: 'lease-2', editExpiresAt: 'later' })],
				rowStatus: {
					q1: { action: null, error: 'This edit is no longer reserved.', unsavedDraft: 'My unsaved rewrite' }
				}
			})
		)

		expect(container.textContent).toContain('My unsaved rewrite')
		expect(container.textContent).toContain('This edit is no longer reserved.')
		expect(container.querySelector('button')).toBeNull()
	})

	test('submits the uncontrolled edit draft', async () => {
		const onEditSave = vi.fn()
		const onEditDraftChange = vi.fn()
		await render(
			surface({
				ownedEditId: 'q1',
				onEditDraftChange,
				onEditSave,
				rows: [pending({ state: 'editing', editLeaseId: 'lease-1', editExpiresAt: 'later' })]
			})
		)
		const textarea = container.querySelector('textarea') as HTMLTextAreaElement
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, ' edited follow up ')
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		await act(async () => (container.querySelector('[aria-label="Save"]') as HTMLButtonElement).click())

		expect(onEditDraftChange).toHaveBeenCalledWith('q1', ' edited follow up ')
		expect(onEditSave).toHaveBeenCalledWith('q1', 'edited follow up')
	})

	test('describes only an owned head reservation as paused', async () => {
		const editing = pending({ state: 'editing', editLeaseId: 'lease-1', editExpiresAt: 'later' })
		await render(surface({ ownedEditId: 'q1', rows: [editing] }))
		expect(container.textContent).toContain('Queue paused while you edit')

		await render(surface({ ownedEditId: 'q1', rows: [pending({ id: 'q2' }), editing] }))
		expect(container.textContent).not.toContain('Queue paused while you edit')
	})

	test('shows row-scoped mutation state without disabling other rows', async () => {
		await render(
			surface({
				rows: [pending({ id: 'q1' }), pending({ id: 'q2' })],
				rowStatus: { q1: { action: 'dismissing', error: null } }
			})
		)
		const dismissButtons = container.querySelectorAll<HTMLButtonElement>('[aria-label="Dismiss"]')

		const firstDismiss = dismissButtons[0]
		const secondDismiss = dismissButtons[1]
		expect(firstDismiss).toBeDefined()
		expect(secondDismiss).toBeDefined()
		if (!firstDismiss || !secondDismiss) throw new Error('Missing dismiss buttons')
		expect(firstDismiss.disabled).toBe(true)
		expect(secondDismiss.disabled).toBe(false)
	})

	test('retries expired image prompts without the old image-loss warning', async () => {
		const onRetry = vi.fn()
		await render(
			surface({
				onRetry,
				rows: [
					pending({
						state: 'not_sent',
						reason: 'expired',
						message: '',
						images: [{ id: 'image-1', url: 'https://example.com/image.png' }]
					})
				]
			})
		)
		const retry = container.querySelector('[aria-label="Retry"]') as HTMLButtonElement
		await act(async () => retry.click())

		expect(retry.disabled).toBe(false)
		expect(onRetry).toHaveBeenCalledWith('q1')
		expect(container.textContent).not.toContain("Images can't")
		expect(container.querySelector('[aria-label="Edit"]')).toBeNull()
	})

	test('preserves a rejected edit for copying without retrying the original text', async () => {
		await render(
			surface({
				rows: [pending({ state: 'not_sent', reason: 'edit_expired', message: 'original text' })],
				rowStatus: {
					q1: { action: null, error: 'This edit is no longer reserved.', unsavedDraft: 'unsaved edit' }
				}
			})
		)

		expect(container.textContent).toContain('unsaved edit')
		expect(container.textContent).not.toContain('original text')
		expect(container.textContent).toContain('Copy the unsaved edit')
		expect((container.querySelector('[aria-label="Retry"]') as HTMLButtonElement).disabled).toBe(true)
	})

	test('unblocks the paused queue when the quota reset time arrives', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-08-21T10:00:00.000Z'))
		await render(
			surface({ rows: [pending({ state: 'not_sent', reason: 'quota_exceeded' })] }),
			'2026-08-21T10:00:01.000Z'
		)
		const continueButton = [...container.querySelectorAll('button')].find((button) =>
			button.textContent?.startsWith('Continue')
		) as HTMLButtonElement
		expect(continueButton.disabled).toBe(true)

		await act(async () => vi.advanceTimersByTime(1100))
		expect(continueButton.disabled).toBe(false)
	})

	test('marks later pending rows as blocked by an editing head', async () => {
		await render(
			surface({
				rows: [pending({ state: 'editing', editLeaseId: 'lease-1', editExpiresAt: 'later' }), pending({ id: 'q2' })]
			})
		)

		expect(container.textContent).toContain('waiting for the message above')
	})
})
