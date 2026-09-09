// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
	beginQueuedMessageEdit,
	cancelAllQueuedMessages,
	continueQueuedMessages,
	queueMessage,
	renewQueuedMessageEdit,
	retryQueuedMessage,
	type QueueSnapshot
} from '~/containers/LlamaAI/api'
import { useChatQueueController } from '~/containers/LlamaAI/hooks/useChatQueueController'

vi.mock('~/containers/LlamaAI/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/LlamaAI/api')>()),
	beginQueuedMessageEdit: vi.fn(),
	cancelAllQueuedMessages: vi.fn(),
	cancelQueuedMessage: vi.fn(),
	cancelQueuedMessageEdit: vi.fn(),
	continueQueuedMessages: vi.fn(),
	queueMessage: vi.fn(),
	renewQueuedMessageEdit: vi.fn(),
	retryQueuedMessage: vi.fn(),
	saveQueuedMessageEdit: vi.fn()
}))

type Controller = ReturnType<typeof useChatQueueController>

function snapshot(revision: number, queue: QueueSnapshot['queue'] = [], sessionId = 'session-1'): QueueSnapshot {
	return { sessionId, revision, queue }
}

function pending(id = 'q1'): QueueSnapshot['queue'][number] {
	return {
		id,
		state: 'pending',
		message: 'follow up',
		researchMode: false,
		client: 'web',
		queuedAt: '2026-08-21T10:00:00.000Z'
	}
}

const payload = {
	message: 'follow up',
	researchMode: false,
	client: 'web' as const
}

describe('useChatQueueController', () => {
	let container: HTMLDivElement
	let root: Root
	let controller: Controller

	function Harness({
		sessionId,
		enabled = true,
		admissionPaused = false
	}: {
		sessionId: string | null
		enabled?: boolean
		admissionPaused?: boolean
	}) {
		controller = useChatQueueController({ sessionId, enabled, admissionPaused, authorizedFetch: vi.fn() })
		return null
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => root.render(<Harness sessionId="session-1" />))
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.useRealTimers()
	})

	test('ignores foreign and stale snapshots', async () => {
		await act(async () => {
			controller.applySnapshot(snapshot(2, [pending('new')]))
			controller.applySnapshot(snapshot(1, [pending('stale')]))
			controller.applySnapshot(snapshot(3, [pending('foreign')], 'session-2'))
		})

		expect(controller.serverQueue.map((item) => item.id)).toEqual(['new'])
	})

	test('opens the editor only after the reservation snapshot arrives', async () => {
		let confirm: ((value: Awaited<ReturnType<typeof beginQueuedMessageEdit>>) => void) | null = null
		vi.mocked(beginQueuedMessageEdit).mockImplementation(() => new Promise((resolve) => (confirm = resolve)))
		await act(async () => controller.applySnapshot(snapshot(1, [pending()])))

		let opening: Promise<void>
		await act(async () => {
			opening = controller.beginEdit('q1')
			await Promise.resolve()
		})
		expect(controller.ownedEditId).toBeNull()
		expect(controller.rowStatus.q1?.action).toBe('opening_edit')

		const editing = { ...pending(), state: 'editing' as const, editLeaseId: 'lease-1', editExpiresAt: 'later' }
		await act(async () => {
			controller.applySnapshot(snapshot(3, [editing, pending('q2')]))
			confirm?.({ snapshot: snapshot(2, [editing]) })
			await opening
		})
		expect(controller.ownedEditId).toBe('q1')
	})

	test('renews only while the owned editor is visible', async () => {
		vi.useFakeTimers()
		const editing = {
			...pending(),
			state: 'editing' as const,
			editLeaseId: 'lease-1',
			editExpiresAt: 'later'
		}
		vi.mocked(beginQueuedMessageEdit).mockResolvedValue({ snapshot: snapshot(2, [editing]) })
		vi.mocked(renewQueuedMessageEdit).mockResolvedValue({ snapshot: snapshot(3, [editing]) })
		await act(async () => controller.applySnapshot(snapshot(1, [pending()])))
		await act(async () => controller.beginEdit('q1'))

		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewQueuedMessageEdit).toHaveBeenCalledOnce()
		expect(renewQueuedMessageEdit).toHaveBeenCalledWith(
			expect.any(Function),
			'session-1',
			'q1',
			'lease-1',
			expect.any(AbortSignal)
		)

		await act(async () => root.render(<Harness sessionId="session-1" enabled={false} />))
		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewQueuedMessageEdit).toHaveBeenCalledOnce()
		await act(async () => root.render(<Harness sessionId="session-1" />))
		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewQueuedMessageEdit).toHaveBeenCalledTimes(2)

		await act(async () => root.render(<Harness sessionId="session-2" />))
		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewQueuedMessageEdit).toHaveBeenCalledTimes(2)
	})

	test('restores this tab edit ownership and draft when returning to a session', async () => {
		const editing = {
			...pending(),
			state: 'editing' as const,
			editLeaseId: 'lease-1',
			editExpiresAt: 'later'
		}
		vi.mocked(beginQueuedMessageEdit).mockResolvedValue({ snapshot: snapshot(2, [editing]) })
		await act(async () => controller.applySnapshot(snapshot(1, [pending()])))
		await act(async () => controller.beginEdit('q1'))
		controller.updateEditDraft('q1', 'draft from session one')

		await act(async () => root.render(<Harness sessionId="session-2" />))
		act(() => controller.restoreSnapshot(snapshot(3, [editing], 'session-1')))
		await act(async () => root.render(<Harness sessionId="session-1" />))

		expect(controller.ownedEditId).toBe('q1')
		expect(controller.rowStatus.q1?.unsavedDraft).toBe('draft from session one')
	})

	test('keeps the remembered draft copyable after the lease expires', async () => {
		const editing = {
			...pending(),
			state: 'editing' as const,
			editLeaseId: 'lease-1',
			editExpiresAt: 'later'
		}
		vi.mocked(beginQueuedMessageEdit).mockResolvedValue({ snapshot: snapshot(2, [editing]) })
		await act(async () => controller.applySnapshot(snapshot(1, [pending()])))
		await act(async () => controller.beginEdit('q1'))
		controller.updateEditDraft('q1', 'unsaved long edit')

		await act(async () =>
			controller.applySnapshot(snapshot(3, [{ ...pending(), state: 'not_sent', reason: 'edit_expired' }]))
		)

		expect(controller.ownedEditId).toBeNull()
		expect(controller.rowStatus.q1).toMatchObject({
			error: 'This edit is no longer reserved. Copy your changes and try again.',
			unsavedDraft: 'unsaved long edit'
		})
	})

	test('does not treat another lease for the same row as owned', async () => {
		const editing = {
			...pending(),
			state: 'editing' as const,
			editLeaseId: 'lease-1',
			editExpiresAt: 'later'
		}
		vi.mocked(beginQueuedMessageEdit).mockResolvedValue({ snapshot: snapshot(2, [editing]) })
		await act(async () => controller.applySnapshot(snapshot(1, [pending()])))
		await act(async () => controller.beginEdit('q1'))
		controller.updateEditDraft('q1', 'my draft')

		await act(async () => controller.applySnapshot(snapshot(3, [{ ...editing, editLeaseId: 'lease-2' }])))

		expect(controller.ownedEditId).toBeNull()
		expect(controller.rowStatus.q1?.unsavedDraft).toBe('my draft')
	})

	test('serializes rapid optimistic submissions in order', async () => {
		const pendingRequests: Array<{
			payload: Parameters<typeof queueMessage>[2]
			resolve: (value: Awaited<ReturnType<typeof queueMessage>>) => void
		}> = []
		vi.mocked(queueMessage).mockImplementation(
			(_fetch, _sessionId, request) => new Promise((resolve) => pendingRequests.push({ payload: request, resolve }))
		)

		await act(async () => {
			expect(controller.enqueue({ ...payload, message: 'B' })).toBe('queued')
			expect(controller.enqueue({ ...payload, message: 'C' })).toBe('queued')
			expect(controller.enqueue({ ...payload, message: 'D' })).toBe('queued')
			await Promise.resolve()
		})

		expect(queueMessage).toHaveBeenCalledOnce()
		expect(
			controller.rows.map((row) => [row.kind, row.state, row.kind === 'local' ? row.payload.message : row.message])
		).toEqual([
			['local', 'adding', 'B'],
			['local', 'waiting', 'C'],
			['local', 'waiting', 'D']
		])

		const first = pendingRequests[0]
		expect(first).toBeDefined()
		if (!first) throw new Error('Missing first queue request')
		await act(async () => {
			first.resolve({
				snapshot: snapshot(1, [{ ...pending('b'), clientMutationId: first.payload.clientMutationId }]),
				maxDepth: 3
			})
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(queueMessage).toHaveBeenCalledTimes(2)
		const second = pendingRequests[1]
		expect(second).toBeDefined()
		if (!second) throw new Error('Missing second queue request')
		expect(second.payload.message).toBe('C')
	})

	test('reconciles SSE confirmation when the POST response is lost', async () => {
		let reject: ((error: Error) => void) | null = null
		vi.mocked(queueMessage).mockImplementationOnce(
			() => new Promise((_resolve, rejectPromise) => (reject = rejectPromise))
		)
		await act(async () => {
			controller.enqueue(payload)
			await Promise.resolve()
		})
		const local = controller.rows.find((row) => row.kind === 'local')
		if (local?.kind !== 'local') throw new Error('Expected a local queue row')

		await act(async () => {
			controller.applySnapshot(
				snapshot(1, [{ ...pending('confirmed'), clientMutationId: local.payload.clientMutationId }])
			)
			reject?.(new Error('Connection closed before the response arrived'))
			await Promise.resolve()
		})

		expect(controller.rows.map((row) => row.id)).toEqual(['confirmed'])
	})

	test('keeps later prompts waiting when confirmed rows fill capacity', async () => {
		let confirm: ((value: Awaited<ReturnType<typeof queueMessage>>) => void) | null = null
		vi.mocked(queueMessage).mockImplementationOnce(() => new Promise((resolve) => (confirm = resolve)))

		await act(async () => {
			controller.enqueue({ ...payload, message: 'B' })
			controller.enqueue({ ...payload, message: 'C' })
			await Promise.resolve()
		})
		const firstCall = vi.mocked(queueMessage).mock.calls[0]
		expect(firstCall).toBeDefined()
		if (!firstCall) throw new Error('Missing first queue call')
		const firstRequest = firstCall[2]
		await act(async () => {
			confirm?.({
				snapshot: snapshot(1, [{ ...pending('confirmed'), clientMutationId: firstRequest.clientMutationId }]),
				maxDepth: 1
			})
			await Promise.resolve()
		})

		expect(queueMessage).toHaveBeenCalledOnce()
		expect(controller.rows.map((row) => [row.kind, row.state])).toEqual([
			['server', 'pending'],
			['local', 'waiting']
		])
	})

	test('preserves an aborted local intent when switching away and back', async () => {
		vi.mocked(queueMessage).mockImplementation((_fetch, _sessionId, _payload, signal) => {
			return new Promise((_resolve, reject) => {
				signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
			})
		})
		await act(async () => {
			controller.enqueue(payload)
			await Promise.resolve()
		})
		const firstRow = controller.rows[0]
		expect(firstRow).toBeDefined()
		if (!firstRow) throw new Error('Missing local queue row')
		expect(firstRow.kind).toBe('local')

		await act(async () => root.render(<Harness sessionId="session-2" />))
		expect(controller.rows).toEqual([])
		await act(async () => root.render(<Harness sessionId="session-1" admissionPaused />))
		expect(controller.rows.map((row) => [row.kind, row.state])).toEqual([['local', 'waiting']])
	})

	test('moves local intents from a temporary session to the canonical session', async () => {
		vi.mocked(queueMessage).mockImplementation((_fetch, _sessionId, _payload, signal) => {
			return new Promise((_resolve, reject) => {
				signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
			})
		})
		await act(async () => {
			controller.enqueue(payload)
			await Promise.resolve()
		})
		const initialCall = vi.mocked(queueMessage).mock.calls[0]
		expect(initialCall).toBeDefined()
		if (!initialCall) throw new Error('Missing initial queue call')
		const clientMutationId = initialCall[2].clientMutationId

		await act(async () => {
			controller.adoptSession('session-1', 'canonical-session')
			root.render(<Harness sessionId="canonical-session" />)
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(queueMessage).toHaveBeenCalledTimes(2)
		const adoptedCall = vi.mocked(queueMessage).mock.calls[1]
		expect(adoptedCall).toBeDefined()
		if (!adoptedCall) throw new Error('Missing adopted queue call')
		expect(adoptedCall[1]).toBe('canonical-session')
		expect(adoptedCall[2].clientMutationId).toBe(clientMutationId)
		expect(controller.rows.map((row) => [row.kind, row.state])).toEqual([['local', 'adding']])
	})

	test('keeps later intents behind a failed head and advances after dismiss', async () => {
		vi.mocked(queueMessage)
			.mockRejectedValueOnce(new Error('server rejected the prompt'))
			.mockImplementationOnce(
				(_fetch, _sessionId, _payload, signal) =>
					new Promise((_resolve, reject) =>
						signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
					)
			)

		await act(async () => {
			controller.enqueue({ ...payload, message: 'B' })
			controller.enqueue({ ...payload, message: 'C' })
			await Promise.resolve()
			await Promise.resolve()
		})

		expect(queueMessage).toHaveBeenCalledOnce()
		expect(controller.rows.map((row) => [row.state, row.kind === 'local' ? row.payload.message : row.message])).toEqual(
			[
				['failed', 'B'],
				['waiting', 'C']
			]
		)

		await act(async () => {
			const failedRow = controller.rows[0]
			expect(failedRow).toBeDefined()
			if (!failedRow) throw new Error('Missing failed queue row')
			controller.dismiss(failedRow.id)
			await Promise.resolve()
		})
		expect(queueMessage).toHaveBeenCalledTimes(2)
		const retryCall = vi.mocked(queueMessage).mock.calls[1]
		expect(retryCall).toBeDefined()
		if (!retryCall) throw new Error('Missing retried queue call')
		expect(retryCall[2].message).toBe('C')
	})

	test('clears a failed local error when retrying the prompt', async () => {
		vi.mocked(queueMessage)
			.mockRejectedValueOnce(new Error('server rejected the prompt'))
			.mockImplementationOnce((_fetch, _sessionId, _payload, signal) => {
				expect(signal).toBeDefined()
				if (!signal) throw new Error('Missing queue abort signal')
				return new Promise((_resolve, reject) =>
					signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
				)
			})

		await act(async () => {
			controller.enqueue(payload)
			await Promise.resolve()
		})

		const failedRow = controller.rows[0]
		expect(failedRow).toMatchObject({ kind: 'local', state: 'failed' })
		if (!failedRow) throw new Error('Missing failed queue row')
		expect(failedRow.kind === 'local' ? failedRow.error : undefined).toBe(
			'Could not add this prompt. Retry or dismiss it.'
		)

		await act(async () => {
			await controller.retry(failedRow.id)
			await Promise.resolve()
		})

		const retriedRow = controller.rows[0]
		expect(retriedRow).toMatchObject({ kind: 'local', state: 'adding' })
		if (!retriedRow) throw new Error('Missing retried queue row')
		expect(retriedRow.kind === 'local' ? retriedRow.error : undefined).toBeUndefined()
	})

	test('continues and clears the complete queue through acknowledged snapshots', async () => {
		const paused = { ...pending(), state: 'not_sent' as const, reason: 'execution_stopped' as const }
		await act(async () => controller.applySnapshot(snapshot(1, [paused])))
		vi.mocked(continueQueuedMessages).mockResolvedValue({ snapshot: snapshot(2, [pending()]) })
		await act(async () => controller.continueQueue())

		expect(continueQueuedMessages).toHaveBeenCalledWith(expect.any(Function), 'session-1', expect.any(AbortSignal))
		expect(controller.paused).toBe(false)

		vi.mocked(cancelAllQueuedMessages).mockResolvedValue({ snapshot: snapshot(3, []) })
		await act(async () => controller.clearQueue())
		expect(controller.rows).toEqual([])
	})

	test('does not admit local prompts while Clear waits for its response', async () => {
		const paused = { ...pending(), state: 'not_sent' as const, reason: 'execution_failed' as const }
		await act(async () => controller.applySnapshot(snapshot(1, [paused])))
		await act(async () => controller.enqueue(payload))
		let confirmClear: ((value: Awaited<ReturnType<typeof cancelAllQueuedMessages>>) => void) | null = null
		vi.mocked(cancelAllQueuedMessages).mockImplementation(() => new Promise((resolve) => (confirmClear = resolve)))

		let clearing: Promise<void>
		await act(async () => {
			clearing = controller.clearQueue()
			await Promise.resolve()
		})
		await act(async () => {
			controller.applySnapshot(snapshot(2, []))
			await Promise.resolve()
		})

		expect(queueMessage).not.toHaveBeenCalled()
		expect(controller.rows.map((row) => row.kind)).toEqual(['local'])

		await act(async () => {
			confirmClear?.({ snapshot: snapshot(3, []) })
			await clearing
		})
		expect(controller.rows).toEqual([])
	})

	test('keeps local prompts waiting when the Clear response is lost', async () => {
		const paused = { ...pending(), state: 'not_sent' as const, reason: 'execution_failed' as const }
		await act(async () => controller.applySnapshot(snapshot(1, [paused])))
		await act(async () => controller.enqueue(payload))
		let rejectClear: ((error: Error) => void) | null = null
		vi.mocked(cancelAllQueuedMessages).mockImplementation(
			() => new Promise((_resolve, reject) => (rejectClear = reject))
		)

		let clearing: Promise<void>
		await act(async () => {
			clearing = controller.clearQueue()
			await Promise.resolve()
			controller.applySnapshot(snapshot(2, []))
			rejectClear?.(new Error('Connection closed before the response arrived'))
			await clearing
		})

		expect(queueMessage).not.toHaveBeenCalled()
		expect(controller.rows.map((row) => [row.kind, row.state])).toEqual([['local', 'waiting']])
		expect(controller.queueActionError).toEqual({
			action: 'clearing',
			message: 'Could not clear the queue. Try again.'
		})
	})

	test('uses the atomic retry command and applies its snapshot', async () => {
		const retried = pending('q1')
		vi.mocked(retryQueuedMessage).mockResolvedValue({ snapshot: snapshot(2, [retried]) })
		await act(async () => controller.retry('q1'))

		expect(retryQueuedMessage).toHaveBeenCalledOnce()
		expect(controller.serverQueue).toEqual([retried])
	})

	// The payload cache used to evict whatever was inserted first, which in queue order is the head:
	// the very next message to run. Losing it drops that message from the transcript entirely.
	test('keeps the head payload for a queue deeper than the retired-row bound', async () => {
		const deep = Array.from({ length: 25 }, (_, index) => pending(`q${index + 1}`))
		await act(async () => controller.applySnapshot(snapshot(1, deep)))

		expect(controller.takeStartedItem('q1')).toEqual(deep[0])
		expect(controller.takeStartedItem('q25')).toEqual(deep[24])
	})

	// Adopting the real session id runs ahead of the prop on purpose, so the payloads have to travel
	// with it: queue item ids do not change.
	test('keeps queued payloads when the session takes its real id', async () => {
		const queued = pending('q1')
		await act(async () => controller.applySnapshot(snapshot(1, [queued])))
		await act(async () => controller.adoptSession('session-1', 'session-2'))

		expect(controller.takeStartedItem('q1')).toEqual(queued)
	})

	// The queue the user can see, not just the payload cache. The reducer drops a snapshot for a
	// session it has not adopted yet, and the prop committing resets the queue, so an accepted
	// snapshot has to survive both or the queue empties until a newer revision happens along.
	test('shows the adopted queue once the session prop commits', async () => {
		await act(async () => controller.adoptSession('session-1', 'session-2'))
		await act(async () => controller.applySnapshot(snapshot(4, [pending('q1')], 'session-2')))
		await act(async () => root.render(<Harness sessionId="session-2" />))

		expect(controller.serverQueue.map((item) => item.id)).toEqual(['q1'])
	})

	test('a snapshot for the adopted session still applies after adoption', async () => {
		await act(async () => controller.applySnapshot(snapshot(1, [pending('q1')])))
		await act(async () => controller.adoptSession('session-1', 'session-2'))
		await act(async () => controller.applySnapshot(snapshot(2, [pending('q2')], 'session-2')))

		expect(controller.takeStartedItem('q2')).toEqual(pending('q2'))
	})

	// The opposite edge: moving to a different session must not serve that session's payloads.
	test('drops queued payloads when the session actually changes', async () => {
		await act(async () => controller.applySnapshot(snapshot(1, [pending('q1')])))
		await act(async () => root.render(<Harness sessionId="session-9" />))

		expect(controller.takeStartedItem('q1')).toBeNull()
	})

	test('never serves the same payload twice, retired or not', async () => {
		const queued = pending('q1')
		await act(async () => controller.applySnapshot(snapshot(1, [queued])))
		// Leaving the queue retires the payload rather than dropping it.
		await act(async () => controller.applySnapshot(snapshot(2, [])))

		expect(controller.takeStartedItem('q1')).toEqual(queued)
		expect(controller.takeStartedItem('q1')).toBeNull()
	})

	test('bounds retired payloads without touching live ones', async () => {
		const live = pending('live')
		await act(async () => controller.applySnapshot(snapshot(1, [live])))
		await act(async () => {
			for (let index = 0; index < 30; index++) {
				controller.applySnapshot(snapshot(index * 2 + 2, [live, pending(`gone${index}`)]))
				controller.applySnapshot(snapshot(index * 2 + 3, [live]))
			}
		})

		expect(controller.takeStartedItem('gone0')).toBeNull()
		expect(controller.takeStartedItem('gone29')).toEqual(pending('gone29'))
		expect(controller.takeStartedItem('live')).toEqual(live)
	})

	test('keeps queued content for the execution handoff even when the firing snapshot is missed', async () => {
		const queued = pending('q1')
		await act(async () => {
			controller.applySnapshot(snapshot(1, [queued]))
			controller.applySnapshot(snapshot(3, []))
			controller.applySnapshot(snapshot(2, [{ ...pending('stale'), state: 'firing' }]))
		})

		expect(controller.takeStartedItem('other')).toBeNull()
		expect(controller.takeStartedItem('stale')).toBeNull()
		expect(controller.takeStartedItem('q1')).toEqual(queued)
		expect(controller.takeStartedItem('q1')).toBeNull()
	})
})
