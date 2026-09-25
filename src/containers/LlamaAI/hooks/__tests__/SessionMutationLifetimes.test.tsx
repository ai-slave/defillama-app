// @vitest-environment happy-dom
import { QueryObserver } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { SESSIONS_QUERY_KEY, type SessionListInfiniteData } from '../sessionListCache'
import { useSessionMutations } from '../useSessionMutations'
import { useUpdateSessionTitle } from '../useUpdateSessionTitle'

const session = installSubscriberSession('user')

/** Server replies, taken in the order LlamaAI requests arrive. A rejection stands for a network failure. */
let replies: Array<() => unknown>
const ok = () => new Response(null, { status: 204 })
const offline = (message: string) => () => Promise.reject(new TypeError(message))
/** A reply the test settles later. */
function held() {
	const reply = {
		arrived: false,
		resolve: () => {},
		reject: (_error: Error) => {},
		respond: () => {
			reply.arrived = true
			return new Promise<Response>((resolve, reject) => {
				reply.resolve = () => resolve(ok())
				reply.reject = reject
			})
		}
	}
	return reply
}
const titleWrites = () => session.requests.filter((request) => request.url.pathname.endsWith('/title')).length

let root: Root
let container: HTMLDivElement
let rename: ReturnType<typeof useUpdateSessionTitle>
let mutations: ReturnType<typeof useSessionMutations>
const key = [SESSIONS_QUERY_KEY, 'user']
const chat = {
	sessionId: 'chat',
	title: 'Chat',
	createdAt: '2026-09-06',
	lastActivity: '2026-09-06',
	isActive: true,
	isPinned: false
}
function listOf(sessions: Array<typeof chat>): SessionListInfiniteData {
	return {
		pages: [{ sessions, usage: null, factCheckedUsage: null, alertsUsage: null, hasMore: false }],
		pageParams: [0]
	}
}
const sessions = () => session.client.getQueryData<SessionListInfiniteData>(key)?.pages[0]?.sessions ?? []

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {})
	replies = []
	session.serve({
		[`${AI_SERVER}/`]: (url: URL) => {
			const next = replies.shift()
			if (!next) throw new Error(`No reply queued for ${url.pathname}`)
			return next()
		}
	})
	session.client.setQueryData(key, listOf([chat]))
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})
async function mount() {
	function Harness() {
		mutations = useSessionMutations()
		rename = useUpdateSessionTitle()
		return null
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	)
}

test('branch switching rejects a successful response without an active leaf and accepts a valid one', async () => {
	replies = [() => ({ messages: [] }), () => ({ activeLeafMessageId: 'leaf', messages: [] })]
	await mount()
	await act(async () => {
		await expect(mutations.switchActiveLeaf.mutateAsync({ sessionId: 'chat', leafMessageId: 'leaf' })).rejects.toThrow(
			'missing active leaf'
		)
	})
	await act(async () => {
		await expect(mutations.switchActiveLeaf.mutateAsync({ sessionId: 'chat', leafMessageId: 'leaf' })).resolves.toEqual(
			{ activeLeafMessageId: 'leaf', messages: [] }
		)
	})
})

test('restore keeps legacy message payloads and rejects request failures', async () => {
	replies = [() => ({ conversationHistory: [{ id: 'message' }], hasMore: true, nextCursor: 5 }), offline('Offline')]
	await mount()
	await act(async () => {
		await expect(mutations.restoreSession('chat')).resolves.toMatchObject({
			messages: [{ id: 'message' }],
			pagination: { hasMore: true, cursor: 5 }
		})
		await expect(mutations.loadMoreMessages('chat', 5)).rejects.toThrow('Failed to load older messages: Offline')
	})
})

test('a failed delete does not overwrite another session rename', async () => {
	session.client.setQueryData(key, listOf([chat, { ...chat, sessionId: 'other', title: 'Original' }]))
	const deletion = held()
	replies = [deletion.respond, ok]
	await mount()
	let deleting!: Promise<unknown>
	await act(async () => {
		deleting = mutations.deleteSession.mutateAsync({ sessionId: 'chat' }).catch(() => {})
	})
	await vi.waitFor(() => expect(deletion.arrived).toBe(true))
	await act(async () => {
		await rename.mutateAsync({ sessionId: 'other', title: 'Renamed' })
	})
	await act(async () => {
		deletion.reject(new TypeError('Offline'))
		await deleting
	})
	expect(sessions().map((s) => [s.sessionId, s.title])).toEqual([
		['chat', 'Chat'],
		['other', 'Renamed']
	])
})

test('bulk deletion keeps its rows until success and preserves another renamed row', async () => {
	session.client.setQueryData(key, listOf([chat, { ...chat, sessionId: 'other', title: 'Other' }]))
	const deletion = held()
	replies = [deletion.respond, ok]
	await mount()
	let deleting!: Promise<unknown>
	await act(async () => {
		deleting = mutations.bulkDeleteSessions.mutateAsync(['chat'])
	})
	await vi.waitFor(() => expect(deletion.arrived).toBe(true))
	expect(sessions().map((s) => s.sessionId)).toEqual(['chat', 'other'])
	await act(async () => {
		await rename.mutateAsync({ sessionId: 'other', title: 'Renamed' })
	})
	await act(async () => {
		deletion.resolve()
		await deleting
	})
	expect(sessions().map((s) => [s.sessionId, s.title])).toEqual([['other', 'Renamed']])
})

test('a failed rename does not overwrite the next queued title', async () => {
	const first = held()
	replies = [first.respond, ok]
	await mount()
	let firstRename!: Promise<unknown>
	await act(async () => {
		firstRename = rename.mutateAsync({ sessionId: 'chat', title: 'First' }).catch(() => {})
	})
	await vi.waitFor(() => expect(first.arrived).toBe(true))
	let newer!: Promise<unknown>
	await act(async () => {
		newer = rename.mutateAsync({ sessionId: 'chat', title: 'Newer' })
	})
	// Title writes to one session are queued, never sent side by side.
	expect(titleWrites()).toBe(1)
	await act(async () => {
		first.reject(new TypeError('Offline'))
		await firstRename
		await newer
	})
	expect(sessions()[0]?.title).toBe('Newer')
})

test('a settled rename waits for an overlapping write before refetching', async () => {
	const deletion = held()
	replies = [deletion.respond, ok]
	await mount()
	const refreshed = listOf([{ ...chat, title: 'Renamed' }])
	const fetchSessions = vi.fn().mockResolvedValue(refreshed)
	const observer = new QueryObserver(session.client, { queryKey: key, queryFn: fetchSessions, staleTime: Infinity })
	const unsubscribe = observer.subscribe(() => {})
	try {
		let deleting!: Promise<unknown>
		await act(async () => {
			deleting = mutations.deleteSession.mutateAsync({ sessionId: 'other' })
		})
		await vi.waitFor(() => expect(deletion.arrived).toBe(true))
		await act(async () => {
			await rename.mutateAsync({ sessionId: 'chat', title: 'Renamed' })
		})
		expect(fetchSessions).not.toHaveBeenCalled()
		expect(sessions()[0]?.title).toBe('Renamed')
		await act(async () => {
			deletion.resolve()
			await deleting
		})
		await vi.waitFor(() => expect(fetchSessions).toHaveBeenCalledTimes(1))
		await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false))
		expect(observer.getCurrentResult().data).toEqual(refreshed)
	} finally {
		unsubscribe()
	}
})

test('two failed edits of the same session restore its confirmed title', async () => {
	const first = held()
	replies = [first.respond, offline('Offline again')]
	await mount()
	let firstRename!: Promise<unknown>
	let secondRename!: Promise<unknown>
	await act(async () => {
		firstRename = rename.mutateAsync({ sessionId: 'chat', title: 'First' }).catch(() => {})
	})
	await vi.waitFor(() => expect(first.arrived).toBe(true))
	await act(async () => {
		secondRename = rename.mutateAsync({ sessionId: 'chat', title: 'Second' }).catch(() => {})
	})
	expect(titleWrites()).toBe(1)
	await act(async () => {
		first.reject(new TypeError('Offline'))
		await firstRename
		await secondRename
	})
	expect(sessions()[0]?.title).toBe('Chat')
})
