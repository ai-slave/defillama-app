// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
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
import { installSubscriberSession } from '~/utils/testing/subscriberSession'

const session = installSubscriberSession('user-1')

const view = {
	visibilityState: 'visible' as DocumentVisibilityState,
	hasFocus: true,
	sessionId: 'session-1' as string | null,
	uncovered: true,
	hasUnseenCompletion: true,
	projectId: 'project-1' as string | null
}

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
	let result: ReturnType<typeof useClearUnseenCompletion>

	function Harness() {
		result = useClearUnseenCompletion({
			attention: {
				uncovered: view.uncovered,
				sessionId: view.sessionId,
				visibleMessageIds: new Set(['message-1'])
			} satisfies ChatAttention,
			projectId: view.projectId,
			hasUnseenCompletion: view.hasUnseenCompletion
		})
		return null
	}

	function seedSessions(sessions: Array<ChatSession>) {
		session.client.setQueryData(
			[SESSIONS_QUERY_KEY, 'user-1'],
			createSessionListInfiniteData({
				sessions,
				usage: null,
				factCheckedUsage: null,
				alertsUsage: null,
				hasMore: false
			})
		)
	}

	async function render(node = <Harness />) {
		await act(async () => root.render(<session.Wrapper>{node}</session.Wrapper>))
	}

	/** A new completion lands for the attended session, the only moment the hook decides to clear. */
	async function completionArrives() {
		view.hasUnseenCompletion = false
		await render()
		seedSessions([chatSession()])
		view.hasUnseenCompletion = true
		await render()
	}

	function unseen(sessionId = 'session-1') {
		const data = session.client.getQueryData<SessionListInfiniteData>([SESSIONS_QUERY_KEY, 'user-1'])
		return data?.pages[0]?.sessions.find((row) => row.sessionId === sessionId)?.hasUnseenCompletion
	}

	function projectUnseen(sessionId = 'session-1') {
		const data = session.client.getQueryData<Array<ProjectChatSession>>(projectSessionsKey('project-1'))
		return data?.find((row) => row.sessionId === sessionId)?.hasUnseenCompletion
	}

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		vi.clearAllMocks()
		view.visibilityState = 'visible'
		view.hasFocus = true
		view.sessionId = 'session-1'
		view.uncovered = true
		view.hasUnseenCompletion = true
		view.projectId = 'project-1'
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => view.visibilityState
		})
		vi.spyOn(document, 'hasFocus').mockImplementation(() => view.hasFocus)
		seedSessions([chatSession(), chatSession({ sessionId: 'session-2', title: 'Other' })])
		session.client.setQueryData(projectSessionsKey('project-1'), [
			projectSession(),
			projectSession({ sessionId: 'session-2', title: 'Other' })
		])
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await render()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		vi.restoreAllMocks()
	})

	test('clears the attended session when the user is looking at it', () => {
		expect(unseen('session-1')).toBe(false)
		expect(projectUnseen('session-1')).toBe(false)
		expect(unseen('session-2')).toBe(true)
	})

	test('holds the badge while the tab is hidden', async () => {
		view.visibilityState = 'hidden'
		view.hasFocus = false
		await completionArrives()
		expect(unseen()).toBe(true)
	})

	test('holds the badge while another window has focus over the visible tab', async () => {
		view.hasFocus = false
		await completionArrives()
		expect(unseen()).toBe(true)
	})

	test('holds the badge while chat chrome covers the conversation', async () => {
		view.uncovered = false
		seedSessions([chatSession()])
		await render()
		expect(unseen()).toBe(true)
	})

	test('clears the badge when the user returns focus to the attended chat', async () => {
		view.visibilityState = 'hidden'
		view.hasFocus = false
		await completionArrives()
		expect(unseen()).toBe(true)

		view.visibilityState = 'visible'
		view.hasFocus = true
		await act(async () => window.dispatchEvent(new Event('focus')))
		expect(unseen()).toBe(false)
	})

	test('still clears on an explicit sidebar click', async () => {
		view.hasUnseenCompletion = false
		view.sessionId = null
		seedSessions([chatSession({ sessionId: 'session-2' })])
		await render()
		act(() => result('session-2', 'project-1'))
		expect(unseen('session-2')).toBe(false)
	})

	test('still clears on an explicit sidebar click with no attention options', async () => {
		function ClickHarness() {
			result = useClearUnseenCompletion()
			return null
		}

		seedSessions([chatSession({ sessionId: 'session-2' })])
		await render(<ClickHarness />)
		act(() => result('session-2', 'project-1'))
		expect(unseen('session-2')).toBe(false)
	})

	test('clears again after a refetch restores the unseen flag', async () => {
		expect(unseen()).toBe(false)

		await completionArrives()
		expect(unseen()).toBe(false)
	})
})
