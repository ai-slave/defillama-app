// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatAttention } from '~/containers/LlamaAI/chatAttention'
import {
	createSessionListInfiniteData,
	SESSIONS_QUERY_KEY,
	type SessionListInfiniteData
} from '~/containers/LlamaAI/hooks/sessionListCache'
import { useClearUnseenCompletion } from '~/containers/LlamaAI/hooks/useClearUnseenCompletion'
import { projectSessionsKey } from '~/containers/LlamaAI/projects/queryKeys'
import type { ProjectChatSession } from '~/containers/LlamaAI/projects/types'
import type { ChatSession } from '~/containers/LlamaAI/types'

const mocks = vi.hoisted(() => ({
	userId: 'user-1' as string | null,
	visibilityState: 'visible' as DocumentVisibilityState,
	hasFocus: true,
	sessionId: 'session-1' as string | null,
	uncovered: true,
	hasUnseenCompletion: true,
	projectId: 'project-1' as string | null
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		user: mocks.userId ? { id: mocks.userId } : null
	})
}))

function chatSession(overrides: Partial<ChatSession> = {}): ChatSession {
	return {
		sessionId: 'session-1',
		title: 'Chat',
		createdAt: '2026-01-01',
		lastActivity: '2026-01-01',
		isActive: true,
		projectId: 'project-1',
		hasUnseenCompletion: true,
		...overrides
	}
}

function projectSession(overrides: Partial<ProjectChatSession> = {}): ProjectChatSession {
	return {
		sessionId: 'session-1',
		title: 'Chat',
		createdAt: '2026-01-01',
		lastActivity: '2026-01-01',
		isPinned: false,
		pinnedAt: null,
		isPublic: false,
		shareToken: null,
		hasUnseenCompletion: true,
		...overrides
	}
}

describe('useClearUnseenCompletion', () => {
	let container: HTMLDivElement
	let root: Root
	let queryClient: QueryClient
	let result: ReturnType<typeof useClearUnseenCompletion>

	function Harness() {
		result = useClearUnseenCompletion({
			attention: {
				uncovered: mocks.uncovered,
				sessionId: mocks.sessionId,
				visibleMessageIds: new Set(['message-1'])
			} satisfies ChatAttention,
			projectId: mocks.projectId,
			hasUnseenCompletion: mocks.hasUnseenCompletion
		})
		return null
	}

	function unseen(sessionId = 'session-1') {
		const data = queryClient.getQueryData<SessionListInfiniteData>([SESSIONS_QUERY_KEY, 'user-1'])
		return data?.pages[0]?.sessions.find((session) => session.sessionId === sessionId)?.hasUnseenCompletion
	}

	function projectUnseen(sessionId = 'session-1') {
		const data = queryClient.getQueryData<ProjectChatSession[]>(projectSessionsKey('project-1'))
		return data?.find((session) => session.sessionId === sessionId)?.hasUnseenCompletion
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		mocks.userId = 'user-1'
		mocks.visibilityState = 'visible'
		mocks.hasFocus = true
		mocks.sessionId = 'session-1'
		mocks.uncovered = true
		mocks.hasUnseenCompletion = true
		mocks.projectId = 'project-1'
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => mocks.visibilityState
		})
		vi.spyOn(document, 'hasFocus').mockImplementation(() => mocks.hasFocus)
		queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
		queryClient.setQueryData(
			[SESSIONS_QUERY_KEY, 'user-1'],
			createSessionListInfiniteData({
				sessions: [chatSession(), chatSession({ sessionId: 'session-2', title: 'Other' })],
				usage: null,
				factCheckedUsage: null,
				alertsUsage: null,
				hasMore: false
			})
		)
		queryClient.setQueryData(projectSessionsKey('project-1'), [
			projectSession(),
			projectSession({ sessionId: 'session-2', title: 'Other' })
		])
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		queryClient.clear()
		container.remove()
		vi.restoreAllMocks()
	})

	it('clears the attended session when the user is looking at it', () => {
		expect(unseen('session-1')).toBe(false)
		expect(projectUnseen('session-1')).toBe(false)
		expect(unseen('session-2')).toBe(true)
	})

	it('holds the badge while the tab is hidden', async () => {
		mocks.visibilityState = 'hidden'
		mocks.hasFocus = false
		queryClient.setQueryData(
			[SESSIONS_QUERY_KEY, 'user-1'],
			createSessionListInfiniteData({
				sessions: [chatSession()],
				usage: null,
				factCheckedUsage: null,
				alertsUsage: null,
				hasMore: false
			})
		)
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})
		expect(unseen()).toBe(true)
	})

	it('holds the badge while chat chrome covers the conversation', async () => {
		mocks.uncovered = false
		queryClient.setQueryData(
			[SESSIONS_QUERY_KEY, 'user-1'],
			createSessionListInfiniteData({
				sessions: [chatSession()],
				usage: null,
				factCheckedUsage: null,
				alertsUsage: null,
				hasMore: false
			})
		)
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})
		expect(unseen()).toBe(true)
	})

	it('clears the badge when the user returns focus to the attended chat', async () => {
		mocks.visibilityState = 'hidden'
		mocks.hasFocus = false
		queryClient.setQueryData(
			[SESSIONS_QUERY_KEY, 'user-1'],
			createSessionListInfiniteData({
				sessions: [chatSession()],
				usage: null,
				factCheckedUsage: null,
				alertsUsage: null,
				hasMore: false
			})
		)
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})
		expect(unseen()).toBe(true)

		mocks.visibilityState = 'visible'
		mocks.hasFocus = true
		await act(async () => window.dispatchEvent(new Event('focus')))
		expect(unseen()).toBe(false)
	})

	it('still clears on an explicit sidebar click', async () => {
		mocks.hasUnseenCompletion = false
		mocks.sessionId = null
		queryClient.setQueryData(
			[SESSIONS_QUERY_KEY, 'user-1'],
			createSessionListInfiniteData({
				sessions: [chatSession({ sessionId: 'session-2' })],
				usage: null,
				factCheckedUsage: null,
				alertsUsage: null,
				hasMore: false
			})
		)
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})
		act(() => result('session-2', 'project-1'))
		expect(unseen('session-2')).toBe(false)
	})

	it('still clears on an explicit sidebar click with no attention options', async () => {
		function ClickHarness() {
			result = useClearUnseenCompletion()
			return null
		}

		queryClient.setQueryData(
			[SESSIONS_QUERY_KEY, 'user-1'],
			createSessionListInfiniteData({
				sessions: [chatSession({ sessionId: 'session-2' })],
				usage: null,
				factCheckedUsage: null,
				alertsUsage: null,
				hasMore: false
			})
		)
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<ClickHarness />
				</QueryClientProvider>
			)
		})
		act(() => result('session-2', 'project-1'))
		expect(unseen('session-2')).toBe(false)
	})

	it('clears again after a refetch restores the unseen flag', async () => {
		expect(unseen()).toBe(false)

		mocks.hasUnseenCompletion = false
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})

		queryClient.setQueryData(
			[SESSIONS_QUERY_KEY, 'user-1'],
			createSessionListInfiniteData({
				sessions: [chatSession()],
				usage: null,
				factCheckedUsage: null,
				alertsUsage: null,
				hasMore: false
			})
		)
		mocks.hasUnseenCompletion = true
		await act(async () => {
			root.render(
				<QueryClientProvider client={queryClient}>
					<Harness />
				</QueryClientProvider>
			)
		})
		expect(unseen()).toBe(false)
	})
})
