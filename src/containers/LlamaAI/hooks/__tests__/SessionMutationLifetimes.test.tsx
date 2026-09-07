// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SESSIONS_QUERY_KEY, type SessionListInfiniteData } from '../sessionListCache'
import { useSessionMutations } from '../useSessionMutations'
import { useUpdateSessionTitle } from '../useUpdateSessionTitle'
const api = vi.hoisted(() => ({ request: vi.fn(), toastError: vi.fn() }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ user: { id: 'user' }, authorizedFetch: vi.fn() }) }))
vi.mock('~/containers/LlamaAI/api/transport', () => ({ llamaAIRequest: api.request }))
vi.mock('react-hot-toast', () => ({ default: { error: api.toastError } }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
let rename: ReturnType<typeof useUpdateSessionTitle>
let mutations: ReturnType<typeof useSessionMutations>
const key = [SESSIONS_QUERY_KEY, 'user']
const initial: SessionListInfiniteData = {
	pages: [
		{
			sessions: [
				{
					sessionId: 'chat',
					title: 'Chat',
					createdAt: '2026-09-06',
					lastActivity: '2026-09-06',
					isActive: true,
					isPinned: false
				}
			],
			usage: null,
			factCheckedUsage: null,
			alertsUsage: null,
			hasMore: false
		}
	],
	pageParams: [0]
}
beforeEach(() => {
	vi.resetAllMocks()
	vi.spyOn(console, 'error').mockImplementation(() => {})
	client = new QueryClient()
	client.setQueryData(key, initial)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
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
			<QueryClientProvider client={client}>
				<Harness />
			</QueryClientProvider>
		)
	)
}
test('branch switching still rejects malformed successful responses and accepts valid responses', async () => {
	api.request
		.mockResolvedValueOnce({ messages: [] })
		.mockResolvedValueOnce({ activeLeafMessageId: 'leaf', messages: [] })
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
	api.request
		.mockResolvedValueOnce({ conversationHistory: [{ id: 'message' }], hasMore: true, nextCursor: 5 })
		.mockRejectedValueOnce(new Error('Offline'))
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
	const other = { ...initial.pages[0].sessions[0], sessionId: 'other', title: 'Original' }
	client.setQueryData(key, {
		...initial,
		pages: [{ ...initial.pages[0], sessions: [...initial.pages[0].sessions, other] }]
	})
	let rejectDelete!: (error: Error) => void
	api.request.mockImplementation((_auth: unknown, path: string) =>
		path.endsWith('/title')
			? Promise.resolve()
			: new Promise((_, reject) => {
					rejectDelete = reject
				})
	)
	await mount()
	let deletion!: Promise<unknown>
	await act(async () => {
		deletion = mutations.deleteSession.mutateAsync({ sessionId: 'chat' }).catch(() => {})
	})
	await vi.waitFor(() => expect(rejectDelete).toBeTypeOf('function'))
	await act(async () => {
		await rename.mutateAsync({ sessionId: 'other', title: 'Renamed' })
	})
	await act(async () => {
		rejectDelete(new Error('Offline'))
		await deletion
	})
	expect(
		client.getQueryData<SessionListInfiniteData>(key)?.pages[0].sessions.find((s) => s.sessionId === 'other')?.title
	).toBe('Renamed')
	expect(client.getQueryData<SessionListInfiniteData>(key)?.pages[0].sessions.some((s) => s.sessionId === 'chat')).toBe(
		true
	)
})

test('bulk deletion keeps its rows until success and preserves another renamed row', async () => {
	client.setQueryData(key, {
		...initial,
		pages: [
			{
				...initial.pages[0],
				sessions: [
					...initial.pages[0].sessions,
					{ ...initial.pages[0].sessions[0], sessionId: 'other', title: 'Other' }
				]
			}
		]
	})
	let finish!: () => void
	api.request.mockImplementation((_auth: unknown, path: string) =>
		path.endsWith('/title')
			? Promise.resolve()
			: new Promise<void>((resolve) => {
					finish = resolve
				})
	)
	await mount()
	let deletion!: Promise<unknown>
	await act(async () => {
		deletion = mutations.bulkDeleteSessions.mutateAsync(['chat'])
	})
	await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
	expect(client.getQueryData<SessionListInfiniteData>(key)?.pages[0].sessions.map((s) => s.sessionId)).toEqual([
		'chat',
		'other'
	])
	await act(async () => {
		await rename.mutateAsync({ sessionId: 'other', title: 'Renamed' })
	})
	await act(async () => {
		finish()
		await deletion
	})
	expect(
		client.getQueryData<SessionListInfiniteData>(key)?.pages[0].sessions.map((s) => [s.sessionId, s.title])
	).toEqual([['other', 'Renamed']])
})

test('a failed rename does not overwrite the next queued title', async () => {
	let reject!: (error: Error) => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockResolvedValue({})
	await mount()
	let first!: Promise<unknown>
	await act(async () => {
		first = rename.mutateAsync({ sessionId: 'chat', title: 'First' }).catch(() => {})
	})
	await vi.waitFor(() => expect(reject).toBeTypeOf('function'))
	let newer!: Promise<unknown>
	await act(async () => {
		newer = rename.mutateAsync({ sessionId: 'chat', title: 'Newer' })
	})
	expect(api.request).toHaveBeenCalledTimes(1)
	await act(async () => {
		reject(new Error('Offline'))
		await first
		await newer
	})
	expect(client.getQueryData<SessionListInfiniteData>(key)?.pages[0].sessions[0].title).toBe('Newer')
})

test('a settled rename waits for an overlapping write before refetching', async () => {
	let finish!: () => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve
				})
		)
		.mockResolvedValue({})
	await mount()
	const refreshed = {
		...initial,
		pages: [{ ...initial.pages[0], sessions: [{ ...initial.pages[0].sessions[0], title: 'Renamed' }] }]
	}
	const fetchSessions = vi.fn().mockResolvedValue(refreshed)
	const observer = new QueryObserver(client, { queryKey: key, queryFn: fetchSessions, staleTime: Infinity })
	const unsubscribe = observer.subscribe(() => {})
	try {
		let deletion!: Promise<unknown>
		await act(async () => {
			deletion = mutations.deleteSession.mutateAsync({ sessionId: 'other' })
		})
		await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
		await act(async () => {
			await rename.mutateAsync({ sessionId: 'chat', title: 'Renamed' })
		})
		expect(fetchSessions).not.toHaveBeenCalled()
		expect(client.getQueryData<SessionListInfiniteData>(key)?.pages[0].sessions[0].title).toBe('Renamed')
		await act(async () => {
			finish()
			await deletion
		})
		await vi.waitFor(() => expect(fetchSessions).toHaveBeenCalledTimes(1))
		await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false))
		expect(observer.getCurrentResult().data).toEqual(refreshed)
	} finally {
		unsubscribe()
	}
})

test('two failed edits of the same session restore its confirmed title', async () => {
	let reject!: (error: Error) => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockRejectedValue(new Error('Offline again'))
	await mount()
	let first!: Promise<unknown>
	let second!: Promise<unknown>
	await act(async () => {
		first = rename.mutateAsync({ sessionId: 'chat', title: 'First' }).catch(() => {})
	})
	await vi.waitFor(() => expect(reject).toBeTypeOf('function'))
	await act(async () => {
		second = rename.mutateAsync({ sessionId: 'chat', title: 'Second' }).catch(() => {})
	})
	expect(api.request).toHaveBeenCalledTimes(1)
	await act(async () => {
		reject(new Error('Offline'))
		await first
		await second
	})
	expect(client.getQueryData<SessionListInfiniteData>(key)?.pages[0].sessions[0].title).toBe('Chat')
})
