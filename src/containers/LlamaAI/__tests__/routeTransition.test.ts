import { describe, expect, test } from 'vitest'
import {
	isSameAgenticRouteTransition,
	shouldSkipCurrentSessionRouteRestore,
	toAgenticRouteTransition
} from '../routeTransition'

describe('routeTransition', () => {
	test('maps page routes to chat transitions and ignores unknown routes', () => {
		expect(toAgenticRouteTransition({ kind: 'chat-new' }, (id) => id)).toEqual({ kind: 'new-chat' })
		expect(
			toAgenticRouteTransition({ kind: 'chat-session', sessionId: 'alias-1', aroundMessageId: 'message-a' }, (id) =>
				id === 'alias-1' ? 'session-1' : id
			)
		).toEqual({ kind: 'session', sessionId: 'session-1', aroundMessageId: 'message-a' })
		expect(toAgenticRouteTransition({ kind: 'project-list' }, (id) => id)).toEqual({ kind: 'project-list' })
		expect(
			toAgenticRouteTransition({ kind: 'project', projectId: 'project-1', initialTab: 'chats' }, (id) => id)
		).toEqual({ kind: 'project', projectId: 'project-1' })
		expect(toAgenticRouteTransition({ kind: 'unknown' }, (id) => id)).toBeNull()
	})

	test('compares new-chat and project transitions by kind and identity', () => {
		expect(isSameAgenticRouteTransition({ kind: 'new-chat' }, { kind: 'new-chat' })).toBe(true)
		expect(
			isSameAgenticRouteTransition(
				{ kind: 'project', projectId: 'project-1' },
				{ kind: 'project', projectId: 'project-1' }
			)
		).toBe(true)
		expect(
			isSameAgenticRouteTransition(
				{ kind: 'project', projectId: 'project-1' },
				{ kind: 'project', projectId: 'project-2' }
			)
		).toBe(false)
		expect(isSameAgenticRouteTransition({ kind: 'new-chat' }, { kind: 'project', projectId: 'project-1' })).toBe(false)
	})

	test('treats message anchors as part of session route identity', () => {
		expect(
			isSameAgenticRouteTransition(
				{ kind: 'session', sessionId: 'session-1', aroundMessageId: 'message-a' },
				{ kind: 'session', sessionId: 'session-1', aroundMessageId: 'message-b' }
			)
		).toBe(false)

		expect(
			isSameAgenticRouteTransition(
				{ kind: 'session', sessionId: 'session-1', aroundMessageId: 'message-a' },
				{ kind: 'session', sessionId: 'session-1', aroundMessageId: 'message-a' }
			)
		).toBe(true)
	})

	test('skips redundant current-session restores without anchors', () => {
		expect(
			shouldSkipCurrentSessionRouteRestore(
				{ kind: 'session', sessionId: 'session-1' },
				{ kind: 'session', sessionId: 'session-1' },
				'session-1'
			)
		).toBe(true)
	})

	test('does not skip restore without a previous transition', () => {
		expect(shouldSkipCurrentSessionRouteRestore({ kind: 'session', sessionId: 'session-1' }, null, 'session-1')).toBe(
			false
		)
	})

	test('does not skip restore for a different current session', () => {
		expect(
			shouldSkipCurrentSessionRouteRestore(
				{ kind: 'session', sessionId: 'session-1' },
				{ kind: 'session', sessionId: 'session-2' },
				'session-1'
			)
		).toBe(false)
	})

	test('restores when removing a same-session message anchor', () => {
		expect(
			shouldSkipCurrentSessionRouteRestore(
				{ kind: 'session', sessionId: 'session-1' },
				{ kind: 'session', sessionId: 'session-1', aroundMessageId: 'message-a' },
				'session-1'
			)
		).toBe(false)
	})

	test('restores when adding a same-session message anchor', () => {
		expect(
			shouldSkipCurrentSessionRouteRestore(
				{ kind: 'session', sessionId: 'session-1', aroundMessageId: 'message-a' },
				{ kind: 'session', sessionId: 'session-1' },
				'session-1'
			)
		).toBe(false)
	})
})
