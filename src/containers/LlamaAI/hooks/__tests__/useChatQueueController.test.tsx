// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { QueueSnapshot } from '~/containers/LlamaAI/api'
import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'
import { useChatQueueController } from '~/containers/LlamaAI/hooks/useChatQueueController'

type Controller = ReturnType<typeof useChatQueueController>

/** One request to the LlamaAI queue server, answered when the test says so. */
interface ServerCall {
	method: string
	path: string
	body: Record<string, unknown> | undefined
	signal: AbortSignal | undefined
	respond: (body: unknown) => void
	fail: (status: number, body: unknown) => void
}

let calls: Array<ServerCall>
/** Answers a call as it arrives; returning undefined leaves it open. */
let autoRespond: (call: ServerCall) => unknown

// The controller takes its fetch as a parameter: this stands in for the network behind it.
const authorizedFetch: AuthorizedFetch = (url, init) =>
	new Promise<Response>((resolve, reject) => {
		const call: ServerCall = {
			method: init?.method ?? 'GET',
			path: new URL(url).pathname,
			body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
			signal: init?.signal ?? undefined,
			respond: (body) => resolve(Response.json(body)),
			fail: (status, body) => resolve(Response.json(body, { status }))
		}
		call.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
		calls.push(call)
		const answer = autoRespond(call)
		if (answer !== undefined) call.respond(answer)
	})

const queuePosts = () => calls.filter((call) => call.method === 'POST' && call.path === '/agentic/queue')
const renewals = () => calls.filter((call) => call.path.endsWith('/edit/renew'))
/** Lets the fetch, response parsing and reducer dispatches that follow a server reply run. */
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
/** An action awaiting an autoRespond reply fails in a second if no rule answers it, instead of hanging. */
const within = <T,>(promise: Promise<T>, ms = 1000) =>
	Promise.race([
		promise,
		new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`No server reply in ${ms}ms`)), ms))
	])

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

const editing = { ...pending(), state: 'editing' as const, editLeaseId: 'lease-1', editExpiresAt: 'later' }

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
		controller = useChatQueueController({ sessionId, enabled, admissionPaused, authorizedFetch })
		return null
	}

	/** Opens this tab's editor on q1 with lease-1. */
	async function openEditor() {
		autoRespond = (call) => (call.path.endsWith('/q1/edit') ? { snapshot: snapshot(2, [editing]) } : undefined)
		await act(async () => controller.applySnapshot(snapshot(1, [pending()])))
		await act(async () => within(controller.beginEdit('q1')))
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		calls = []
		autoRespond = () => undefined
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
		await act(async () => controller.applySnapshot(snapshot(1, [pending()])))

		let opening!: Promise<void>
		await act(async () => {
			opening = controller.beginEdit('q1')
		})
		expect(controller.ownedEditId).toBeNull()
		expect(controller.rowStatus.q1?.action).toBe('opening_edit')

		await act(async () => {
			controller.applySnapshot(snapshot(3, [editing, pending('q2')]))
			calls[0]!.respond({ snapshot: snapshot(2, [editing]) })
			await opening
		})
		expect(controller.ownedEditId).toBe('q1')
	})

	test('renews only while the owned editor is visible', async () => {
		vi.useFakeTimers()
		await openEditor()
		autoRespond = (call) => (call.path.endsWith('/renew') ? { snapshot: snapshot(3, [editing]) } : undefined)

		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewals().map((call) => [call.path, call.body])).toEqual([
			['/agentic/queue/session-1/q1/edit/renew', { editLeaseId: 'lease-1' }]
		])

		await act(async () => root.render(<Harness sessionId="session-1" enabled={false} />))
		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewals()).toHaveLength(1)
		await act(async () => root.render(<Harness sessionId="session-1" />))
		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewals()).toHaveLength(2)

		await act(async () => root.render(<Harness sessionId="session-2" />))
		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewals()).toHaveLength(2)
	})

	test('keeps renewing an open edit after in-flight commands are aborted, as jumping to a message does', async () => {
		vi.useFakeTimers()
		await openEditor()
		autoRespond = (call) => (call.path.endsWith('/renew') ? { snapshot: snapshot(3, [editing]) } : undefined)

		await act(async () => controller.abortCommands())
		await act(async () => vi.advanceTimersByTimeAsync(30_000))
		expect(renewals().map((call) => [call.path, call.body])).toEqual([
			['/agentic/queue/session-1/q1/edit/renew', { editLeaseId: 'lease-1' }]
		])
	})

	test('restores this tab edit ownership and draft when returning to a session', async () => {
		await openEditor()
		controller.updateEditDraft('q1', 'draft from session one')

		await act(async () => root.render(<Harness sessionId="session-2" />))
		act(() => controller.restoreSnapshot(snapshot(3, [editing], 'session-1')))
		await act(async () => root.render(<Harness sessionId="session-1" />))

		expect(controller.ownedEditId).toBe('q1')
		expect(controller.rowStatus.q1?.unsavedDraft).toBe('draft from session one')
	})

	test('keeps the remembered draft copyable after the lease expires', async () => {
		await openEditor()
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
		await openEditor()
		controller.updateEditDraft('q1', 'my draft')

		await act(async () => controller.applySnapshot(snapshot(3, [{ ...editing, editLeaseId: 'lease-2' }])))

		expect(controller.ownedEditId).toBeNull()
		expect(controller.rowStatus.q1?.unsavedDraft).toBe('my draft')
	})

	test('serializes rapid optimistic submissions in order', async () => {
		await act(async () => {
			expect(controller.enqueue({ ...payload, message: 'B' })).toBe('queued')
			expect(controller.enqueue({ ...payload, message: 'C' })).toBe('queued')
			expect(controller.enqueue({ ...payload, message: 'D' })).toBe('queued')
		})

		expect(queuePosts()).toHaveLength(1)
		expect(
			controller.rows.map((row) => [row.kind, row.state, row.kind === 'local' ? row.payload.message : row.message])
		).toEqual([
			['local', 'adding', 'B'],
			['local', 'waiting', 'C'],
			['local', 'waiting', 'D']
		])

		const first = queuePosts()[0]!
		first.respond({
			snapshot: snapshot(1, [{ ...pending('b'), clientMutationId: first.body!.clientMutationId as string }]),
			maxDepth: 3
		})
		await flush()

		expect(queuePosts().map((call) => call.body!.message)).toEqual(['B', 'C'])
	})

	test('reconciles SSE confirmation when the POST response is lost', async () => {
		await act(async () => {
			controller.enqueue(payload)
		})
		const local = controller.rows.find((row) => row.kind === 'local')
		if (local?.kind !== 'local') throw new Error('Expected a local queue row')

		await act(async () => {
			controller.applySnapshot(
				snapshot(1, [{ ...pending('confirmed'), clientMutationId: local.payload.clientMutationId }])
			)
			queuePosts()[0]!.fail(502, { error: 'Connection closed before the response arrived' })
		})
		await flush()

		expect(controller.rows.map((row) => row.id)).toEqual(['confirmed'])
	})

	test('keeps later prompts waiting when confirmed rows fill capacity', async () => {
		await act(async () => {
			controller.enqueue({ ...payload, message: 'B' })
			controller.enqueue({ ...payload, message: 'C' })
		})
		const first = queuePosts()[0]!
		first.respond({
			snapshot: snapshot(1, [{ ...pending('confirmed'), clientMutationId: first.body!.clientMutationId as string }]),
			maxDepth: 1
		})
		await flush()

		expect(queuePosts()).toHaveLength(1)
		expect(controller.rows.map((row) => [row.kind, row.state])).toEqual([
			['server', 'pending'],
			['local', 'waiting']
		])
	})

	test('preserves an aborted local intent when switching away and back', async () => {
		await act(async () => {
			controller.enqueue(payload)
		})
		expect(controller.rows.map((row) => row.kind)).toEqual(['local'])

		await act(async () => root.render(<Harness sessionId="session-2" />))
		expect(controller.rows).toEqual([])
		await act(async () => root.render(<Harness sessionId="session-1" admissionPaused />))
		expect(controller.rows.map((row) => [row.kind, row.state])).toEqual([['local', 'waiting']])
	})

	test('moves local intents from a temporary session to the canonical session', async () => {
		await act(async () => {
			controller.enqueue(payload)
		})
		const clientMutationId = queuePosts()[0]!.body!.clientMutationId

		await act(async () => {
			controller.adoptSession('session-1', 'canonical-session')
			root.render(<Harness sessionId="canonical-session" />)
		})
		await flush()

		expect(queuePosts().map((call) => [call.body!.sessionId, call.body!.clientMutationId])).toEqual([
			['session-1', clientMutationId],
			['canonical-session', clientMutationId]
		])
		expect(controller.rows.map((row) => [row.kind, row.state])).toEqual([['local', 'adding']])
	})

	test('keeps later intents behind a failed head and advances after dismiss', async () => {
		autoRespond = (call) => {
			if (queuePosts().length === 1) call.fail(400, { error: 'server rejected the prompt' })
			return undefined
		}
		await act(async () => {
			controller.enqueue({ ...payload, message: 'B' })
			controller.enqueue({ ...payload, message: 'C' })
		})
		await flush()

		expect(queuePosts()).toHaveLength(1)
		expect(controller.rows.map((row) => [row.state, row.kind === 'local' ? row.payload.message : row.message])).toEqual(
			[
				['failed', 'B'],
				['waiting', 'C']
			]
		)

		await act(async () => controller.dismiss(controller.rows[0]!.id))
		await flush()
		expect(queuePosts().map((call) => call.body!.message)).toEqual(['B', 'C'])
	})

	test('clears a failed local error when retrying the prompt', async () => {
		autoRespond = (call) => {
			if (queuePosts().length === 1) call.fail(400, { error: 'server rejected the prompt' })
			return undefined
		}
		await act(async () => {
			controller.enqueue(payload)
		})
		await flush()

		const failedRow = controller.rows[0]!
		expect(failedRow).toMatchObject({
			kind: 'local',
			state: 'failed',
			error: 'Could not add this prompt. Retry or dismiss it.'
		})

		await act(async () => controller.retry(failedRow.id))

		expect(controller.rows[0]).toMatchObject({ kind: 'local', state: 'adding' })
		expect(controller.rows[0]).not.toHaveProperty('error')
	})

	test('continues and clears the complete queue through acknowledged snapshots', async () => {
		const paused = { ...pending(), state: 'not_sent' as const, reason: 'execution_stopped' as const }
		await act(async () => controller.applySnapshot(snapshot(1, [paused])))
		autoRespond = (call) => {
			if (call.path === '/agentic/queue/session-1/continue') return { snapshot: snapshot(2, [pending()]) }
			if (call.method === 'DELETE' && call.path === '/agentic/queue/session-1') return { snapshot: snapshot(3, []) }
			return undefined
		}
		await act(async () => within(controller.continueQueue()))

		expect(controller.paused).toBe(false)

		await act(async () => within(controller.clearQueue()))
		expect(controller.rows).toEqual([])
	})

	test('does not admit local prompts while Clear waits for its response', async () => {
		const paused = { ...pending(), state: 'not_sent' as const, reason: 'execution_failed' as const }
		await act(async () => controller.applySnapshot(snapshot(1, [paused])))
		await act(async () => controller.enqueue(payload))

		let clearing!: Promise<void>
		await act(async () => {
			clearing = controller.clearQueue()
		})
		await act(async () => controller.applySnapshot(snapshot(2, [])))
		await flush()

		expect(queuePosts()).toHaveLength(0)
		expect(controller.rows.map((row) => row.kind)).toEqual(['local'])

		await act(async () => {
			calls.find((call) => call.method === 'DELETE')!.respond({ snapshot: snapshot(3, []) })
			await clearing
		})
		expect(controller.rows).toEqual([])
	})

	test('keeps local prompts waiting when the Clear response is lost', async () => {
		const paused = { ...pending(), state: 'not_sent' as const, reason: 'execution_failed' as const }
		await act(async () => controller.applySnapshot(snapshot(1, [paused])))
		await act(async () => controller.enqueue(payload))

		await act(async () => {
			const clearing = controller.clearQueue()
			controller.applySnapshot(snapshot(2, []))
			calls.find((call) => call.method === 'DELETE')!.fail(502, { error: 'Connection closed' })
			await clearing
		})

		expect(queuePosts()).toHaveLength(0)
		expect(controller.rows.map((row) => [row.kind, row.state])).toEqual([['local', 'waiting']])
		expect(controller.queueActionError).toEqual({
			action: 'clearing',
			message: 'Could not clear the queue. Try again.'
		})
	})

	test('uses the atomic retry command and applies its snapshot', async () => {
		const retried = pending('q1')
		autoRespond = () => ({ snapshot: snapshot(2, [retried]) })
		await act(async () => within(controller.retry('q1')))

		expect(calls.map((call) => [call.method, call.path])).toEqual([['POST', '/agentic/queue/session-1/q1/retry']])
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
