import { describe, expect, test } from 'vitest'
import { parseLlamaAIRoute } from '../llamaAIRoute'

describe.each(['/ai/chat/[[...sessionId]]', '/ai/terminal/[[...sessionId]]'])('%s', (pathname) => {
	const route = { isReady: true, pathname, asPath: '/ai/chat' }

	test('opens New Chat without a session segment', () => {
		expect(parseLlamaAIRoute({ ...route, query: {} })).toEqual({ kind: 'chat-new' })
	})
	test('carries a deep-linked prompt into New Chat', () => {
		expect(parseLlamaAIRoute({ ...route, query: { prompt: 'Explain lending' } })).toEqual({
			kind: 'chat-new',
			initialPrompt: 'Explain lending'
		})
	})
	test('selects the conversation in the URL', () => {
		expect(parseLlamaAIRoute({ ...route, query: { sessionId: ['session-a'] } })).toEqual({
			kind: 'chat-session',
			sessionId: 'session-a'
		})
	})
	test('carries a shared prompt into an existing conversation', () => {
		expect(
			parseLlamaAIRoute({
				...route,
				query: { sessionId: ['session-a'], prompt: 'Explain lending', shareToken: 'share-a' }
			})
		).toEqual({
			kind: 'chat-session',
			sessionId: 'session-a',
			initialPrompt: 'Explain lending',
			shareToken: 'share-a'
		})
	})
	test('targets the message named by the URL anchor', () => {
		expect(
			parseLlamaAIRoute({ ...route, asPath: '/ai/chat/session-a#msg-message-1', query: { sessionId: ['session-a'] } })
		).toEqual({
			kind: 'chat-session',
			sessionId: 'session-a',
			aroundMessageId: 'message-1'
		})
	})
	test('rejects extra path segments as a conversation', () => {
		expect(parseLlamaAIRoute({ ...route, query: { sessionId: ['session-a', 'extra'] } })).toEqual({ kind: 'unknown' })
	})
	test('waits for the router before selecting a conversation', () => {
		expect(parseLlamaAIRoute({ ...route, isReady: false, query: { sessionId: ['session-a'] } })).toEqual({
			kind: 'unknown'
		})
	})
})

test('opens the requested project sources tab', () => {
	expect(
		parseLlamaAIRoute({
			isReady: true,
			pathname: '/ai/projects/[id]',
			asPath: '/ai/projects/project-a?tab=sources',
			query: { id: 'project-a', tab: 'sources' }
		})
	).toEqual({ kind: 'project', projectId: 'project-a', initialTab: 'sources' })
})

test('opens project chats when no tab is requested', () => {
	expect(
		parseLlamaAIRoute({
			isReady: true,
			pathname: '/ai/projects/[id]',
			asPath: '/ai/projects/project-a',
			query: { id: 'project-a' }
		})
	).toEqual({ kind: 'project', projectId: 'project-a', initialTab: 'chats' })
})

test('leaves public shared links outside private conversation routing', () => {
	expect(
		parseLlamaAIRoute({
			isReady: true,
			pathname: '/ai/chat/shared/[shareToken]',
			asPath: '/ai/chat/shared/share-a',
			query: { shareToken: 'share-a' }
		})
	).toEqual({ kind: 'unknown' })
})
