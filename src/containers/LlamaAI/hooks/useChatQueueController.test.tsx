// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	beginQueuedMessageEdit,
	queueMessage,
	renewQueuedMessageEdit,
	retryQueuedMessage,
	type QueueSnapshot
} from '~/containers/LlamaAI/api'
import { useChatQueueController } from '~/containers/LlamaAI/hooks/useChatQueueController'

vi.mock('~/containers/LlamaAI/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/LlamaAI/api')>()),
	beginQueuedMessageEdit: vi.fn(),
	cancelQueuedMessage: vi.fn(),
	cancelQueuedMessageEdit: vi.fn(),
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

	function Harness({ sessionId }: { sessionId: string | null }) {
		controller = useChatQueueController({ sessionId, authorizedFetch: vi.fn() })
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

	it('ignores foreign and stale snapshots', async () => {
		await act(async () => {
			controller.applySnapshot(snapshot(2, [pending('new')]))
			controller.applySnapshot(snapshot(1, [pending('stale')]))
			controller.applySnapshot(snapshot(3, [pending('foreign')], 'session-2'))
		})

		expect(controller.serverQueue.map((item) => item.id)).toEqual(['new'])
	})

	it('opens the editor only after the reservation snapshot arrives', async () => {
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

	it('renews only while the owned editor is visible', async () => {
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

		await act(async () => root.render(<Harness sessionId="session-2" />))
		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewQueuedMessageEdit).toHaveBeenCalledOnce()
	})

	it('restores this tab edit ownership and draft when returning to a session', async () => {
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

	it('keeps the remembered draft copyable after the lease expires', async () => {
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

	it('does not treat another lease for the same row as owned', async () => {
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

	it('deduplicates simultaneous enqueue intents', async () => {
		let confirm: ((value: Awaited<ReturnType<typeof queueMessage>>) => void) | null = null
		vi.mocked(queueMessage).mockImplementation(() => new Promise((resolve) => (confirm = resolve)))

		let first: Promise<'queued' | 'session_idle' | 'busy' | 'aborted'>
		await act(async () => {
			first = controller.enqueue(payload)
			await Promise.resolve()
		})
		await expect(controller.enqueue(payload)).resolves.toBe('busy')
		expect(queueMessage).toHaveBeenCalledOnce()

		await act(async () => {
			confirm?.({ snapshot: snapshot(1, [pending()]), maxDepth: 3 })
			await first
		})
		expect(controller.rows).toHaveLength(1)
		expect(controller.rows[0].kind).toBe('server')
		expect(controller.atCapacity).toBe(false)

		await act(async () => {
			controller.applySnapshot(snapshot(2, [pending('q1'), pending('q2'), pending('q3')]))
		})
		expect(controller.atCapacity).toBe(true)
	})

	it('aborts an enqueue and hides its optimistic row when the session changes', async () => {
		vi.mocked(queueMessage).mockImplementation((_fetch, _sessionId, _payload, signal) => {
			return new Promise((_resolve, reject) => {
				signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
			})
		})
		let enqueue: Promise<'queued' | 'session_idle' | 'busy' | 'aborted'>
		await act(async () => {
			enqueue = controller.enqueue(payload)
			await Promise.resolve()
		})
		expect(controller.rows[0].kind).toBe('creating')

		await act(async () => root.render(<Harness sessionId="session-2" />))
		await expect(enqueue).resolves.toBe('aborted')
		expect(controller.rows).toEqual([])
	})

	it('rejects a mutation response for another session', async () => {
		vi.mocked(queueMessage).mockResolvedValue({ snapshot: snapshot(1, [], 'session-2'), maxDepth: 3 })

		await act(async () => {
			await expect(controller.enqueue(payload)).rejects.toThrow('Queue response belongs to another session')
		})
		expect(controller.rows).toEqual([])
	})

	it('uses the atomic retry command and applies its snapshot', async () => {
		const retried = pending('q1')
		vi.mocked(retryQueuedMessage).mockResolvedValue({ snapshot: snapshot(2, [retried]) })
		await act(async () => controller.retry('q1'))

		expect(retryQueuedMessage).toHaveBeenCalledOnce()
		expect(controller.serverQueue).toEqual([retried])
	})

	it('keeps queued content for the execution handoff even when the firing snapshot is missed', async () => {
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
