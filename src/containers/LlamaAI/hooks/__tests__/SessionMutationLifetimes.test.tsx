// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SESSIONS_QUERY_KEY, type SessionListInfiniteData } from '../sessionListCache'
import { useSessionMutations } from '../useSessionMutations'
const api = vi.hoisted(() => ({ request: vi.fn(), toastError: vi.fn() }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ user: { id: 'user' }, authorizedFetch: vi.fn() }) }))
vi.mock('~/containers/LlamaAI/api/transport', () => ({ llamaAIRequest: api.request }))
vi.mock('react-hot-toast', () => ({ default: { error: api.toastError } }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
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
	vi.clearAllMocks()
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
