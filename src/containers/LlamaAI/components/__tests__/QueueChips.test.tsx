// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueueChips } from '~/containers/LlamaAI/components/QueueChips'
import type { QueueSurface, QueueServerRow } from '~/containers/LlamaAI/hooks/useChatQueueController'
import { accessibleName } from '~/utils/testing/accessibleName'

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

	test('a confirmed Clear names its pending state in the Clear button', async () => {
		const onClear = vi.fn()
		await render(surface({ rows: [pending({ state: 'not_sent', reason: 'execution_failed' })], onClear }))
		const clear = [...container.querySelectorAll('button')].find((button) => accessibleName(button) === 'Clear queue')!
		await act(async () => clear.click())
		const dialog = document.querySelector('[role="alertdialog"]')!
		const confirm = [...dialog.querySelectorAll('button')].find((button) => accessibleName(button) === 'Clear queue')!
		await act(async () => confirm.click())
		expect(onClear).toHaveBeenCalledOnce()

		await render(
			surface({ rows: [pending({ state: 'not_sent', reason: 'execution_failed' })], queueAction: 'clearing' })
		)
		const names = [...container.querySelectorAll('button')].map((button) => [
			accessibleName(button),
			button.getAttribute('aria-busy')
		])
		expect(names).toEqual([
			['Continue queue', null],
			['Clearing…', 'true'],
			['Dismiss', null]
		])
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
		const dialog = document.querySelector('[role="alertdialog"]')!
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
		// Unavailable while busy, yet still focusable, so a pressed button keeps focus while its request runs.
		expect(firstDismiss.getAttribute('aria-disabled')).toBe('true')
		expect(firstDismiss.disabled).toBe(false)
		expect(secondDismiss.getAttribute('aria-disabled')).toBeNull()
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
		expect(container.querySelector('[aria-label="Retry"]')!.getAttribute('aria-disabled')).toBe('true')
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
	test('a long queue shows its first two prompts and folds the rest behind one button, keeping a failed row visible', async () => {
		const messages = ['First', 'Second', 'Third', 'Fourth', 'Fifth']
		const rows = messages.map((message, index) =>
			index === 3
				? {
						kind: 'local' as const,
						id: `l${index}`,
						state: 'failed' as const,
						error: 'Failed to queue your prompt.',
						payload: { clientMutationId: `c${index}`, message, researchMode: false, client: 'web' as const }
					}
				: pending({ id: `q${index}`, clientMutationId: `c${index}`, message })
		)
		await render(surface({ rows }))
		const shown = () => [...container.querySelectorAll('li')].map((row) => row.querySelector('p')?.textContent)
		expect(shown()).toEqual(['First', 'Second', 'Fourth'])

		const toggle = [...container.querySelectorAll('button')].find((button) => button.textContent === '2 more queued')!
		await act(async () => toggle.click())
		expect(shown()).toEqual(messages)
		expect([...container.querySelectorAll('button')].some((button) => button.textContent === 'Show fewer')).toBe(true)
	})

	test('a short queue shows every prompt with nothing to expand', async () => {
		await render(
			surface({
				rows: ['First', 'Second', 'Third'].map((message, index) =>
					pending({ id: `q${index}`, clientMutationId: `c${index}`, message })
				)
			})
		)
		expect(container.querySelectorAll('li')).toHaveLength(3)
		expect(
			[...container.querySelectorAll('button')].some((button) => button.textContent?.includes('more queued'))
		).toBe(false)
	})
	function renderWithComposer(queueSurface: QueueSurface) {
		return act(async () =>
			root.render(
				<>
					<textarea aria-label="Composer" ref={composerRef} />
					<QueueChips surface={queueSurface} promptInputRef={composerRef} />
				</>
			)
		)
	}
	const composerRef = { current: null as HTMLTextAreaElement | null }
	const rowNamed = (text: string) =>
		[...container.querySelectorAll('li')].find((row) => row.textContent?.includes(text))!

	test('a dismissed row hands focus to the next row, and the last one to the composer', async () => {
		const first = pending({ id: 'q1', message: 'First prompt' })
		const second = pending({ id: 'q2', message: 'Second prompt' })
		await renderWithComposer(surface({ rows: [first, second] }))
		const dismiss = rowNamed('First prompt').querySelector<HTMLElement>('[aria-label="Dismiss"]')!
		await act(async () => dismiss.focus())
		await renderWithComposer(
			surface({ rows: [first, second], rowStatus: { q1: { action: 'dismissing', error: null } } })
		)
		expect(dismiss.getAttribute('aria-disabled')).toBe('true')
		expect(document.activeElement).toBe(dismiss)
		await renderWithComposer(surface({ rows: [second] }))
		expect(document.activeElement).toBe(rowNamed('Second prompt'))
		await renderWithComposer(surface({ rows: [] }))
		expect(document.activeElement).toBe(composerRef.current)
	})

	test('a saved edit leaves focus on its row', async () => {
		const editing = pending({ state: 'editing', editLeaseId: 'lease-1', editExpiresAt: 'later' })
		await renderWithComposer(surface({ ownedEditId: 'q1', rows: [editing] }))
		const save = container.querySelector<HTMLElement>('[aria-label="Save"]')!
		await act(async () => save.focus())
		await renderWithComposer(
			surface({ ownedEditId: 'q1', rows: [editing], rowStatus: { q1: { action: 'saving_edit', error: null } } })
		)
		expect(save.getAttribute('aria-disabled')).toBe('true')
		expect(document.activeElement).toBe(save)
		await renderWithComposer(surface({ rows: [pending({ message: 'Edited prompt' })] }))
		expect(document.activeElement).toBe(rowNamed('Edited prompt'))
	})

	test('continuing a paused queue hands focus to the composer', async () => {
		const paused = surface({ rows: [pending({ state: 'not_sent', reason: 'execution_failed' })] })
		await renderWithComposer(paused)
		const resume = [...container.querySelectorAll('button')].find(
			(button) => accessibleName(button) === 'Continue queue'
		)!
		await act(async () => resume.focus())
		await renderWithComposer(surface({ rows: [pending()] }))
		expect(document.activeElement).toBe(composerRef.current)
	})
})
