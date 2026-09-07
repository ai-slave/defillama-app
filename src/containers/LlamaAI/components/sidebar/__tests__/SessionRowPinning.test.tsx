// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SESSIONS_QUERY_KEY, type SessionListInfiniteData } from '~/containers/LlamaAI/hooks/sessionListCache'
import { AgenticSessionItem } from '../AgenticSessionItem'
const api = vi.hoisted(() => ({ request: vi.fn(), toastError: vi.fn() }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ user: { id: 'user' }, authorizedFetch: vi.fn() }) }))
vi.mock('~/containers/LlamaAI/api/transport', () => ({ llamaAIRequest: api.request }))
vi.mock('react-hot-toast', () => ({ default: { error: api.toastError } }))
vi.mock('~/containers/LlamaAI/chrome', () => ({ useLlamaAIChrome: () => ({ hideSidebar: vi.fn() }) }))
vi.mock('~/containers/LlamaAI/hooks/useClearUnseenCompletion', () => ({ useClearUnseenCompletion: () => vi.fn() }))
vi.mock('~/containers/LlamaAI/projects/MoveToProjectMenu', () => ({ MoveToProjectMenuItem: () => null }))
vi.mock('~/utils/analytics/umami', () => ({ trackUmamiEvent: vi.fn() }))
let root: Root
let container: HTMLDivElement
let client: QueryClient
const key = [SESSIONS_QUERY_KEY, 'user']
const session = (sessionId: string) => ({
	sessionId,
	title: sessionId,
	createdAt: '2026-09-06',
	lastActivity: '2026-09-06',
	isActive: false,
	isPinned: false
})
const initial: SessionListInfiniteData = {
	pages: [
		{
			sessions: [session('chat')],
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
})
const settle = () =>
	act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0))
	})
async function render() {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AgenticSessionItem
					session={session('chat')}
					isActive={false}
					onSessionSelect={vi.fn()}
					onDelete={vi.fn()}
					onUpdateTitle={vi.fn()}
					isRestoring={false}
					isDeleting={false}
					isUpdatingTitle={false}
				/>
			</QueryClientProvider>
		)
	)
}
// The menu mounts its items only while open, and clicking one hides it again.
async function pinItem() {
	await act(async () =>
		[...document.querySelectorAll<HTMLElement>('button')]
			.find((button) => button.textContent?.includes('Open menu'))!
			.click()
	)
	const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter((item) =>
		item.textContent?.includes('Pin to Top')
	)
	expect(items).toHaveLength(1)
	return items[0]
}
const isPinned = (sessionId: string) =>
	client.getQueryData<SessionListInfiniteData>(key)!.pages[0].sessions.find((item) => item.sessionId === sessionId)!
		.isPinned

test('a failed pin restores the cached session, reports the failure, and can retry', async () => {
	let reject!: (error: Error) => void
	api.request
		.mockImplementationOnce(
			() =>
				new Promise((_, fail) => {
					reject = fail
				})
		)
		.mockResolvedValueOnce({})
	await render()
	await act(async () => (await pinItem()).click())
	await settle()
	expect(isPinned('chat')).toBe(true)
	await act(async () => reject(new Error('Unavailable')))
	await settle()
	expect(client.getQueryData(key)).toEqual(initial)
	expect(api.toastError).toHaveBeenCalledExactlyOnceWith('Failed to toggle pin: Unavailable')
	await act(async () => (await pinItem()).click())
	await settle()
	expect(isPinned('chat')).toBe(true)
})
