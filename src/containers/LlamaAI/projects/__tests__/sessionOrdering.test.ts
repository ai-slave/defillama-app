import { describe, expect, test } from 'vitest'
import { bumpProjectSessionActivity, orderVisibleProjectSessions } from '../sessionOrdering'
import type { ProjectChatSession } from '../types'

function session(overrides: Partial<ProjectChatSession> & { sessionId: string }): ProjectChatSession {
	return {
		title: overrides.sessionId,
		createdAt: '2026-01-01T00:00:00Z',
		lastActivity: null,
		isPinned: false,
		pinnedAt: null,
		isPublic: false,
		shareToken: null,
		...overrides
	}
}

describe('orderVisibleProjectSessions', () => {
	test('returns empty list when sessions are missing', () => {
		expect(orderVisibleProjectSessions(undefined, null, 5)).toEqual([])
	})

	test('sorts pinned sessions above unpinned ones', () => {
		const sessions = [
			session({ sessionId: 'a' }),
			session({ sessionId: 'b', isPinned: true, pinnedAt: '2026-07-01T00:00:00Z' }),
			session({ sessionId: 'c' }),
			session({ sessionId: 'd', isPinned: true, pinnedAt: '2026-07-02T00:00:00Z' })
		]
		const result = orderVisibleProjectSessions(sessions, null, 5)
		expect(result.map((s) => s.sessionId)).toEqual(['d', 'b', 'a', 'c'])
	})

	test('keeps unpinned sessions in their original order after the pinned block', () => {
		const sessions = [
			session({ sessionId: 'newest' }),
			session({ sessionId: 'older' }),
			session({ sessionId: 'pinned', isPinned: true, pinnedAt: '2026-06-01T00:00:00Z' })
		]
		const result = orderVisibleProjectSessions(sessions, null, 5)
		expect(result.map((s) => s.sessionId)).toEqual(['pinned', 'newest', 'older'])
	})

	test('slices to the limit after sorting so pins beyond the cut still surface', () => {
		const sessions = [
			session({ sessionId: 'u1' }),
			session({ sessionId: 'u2' }),
			session({ sessionId: 'u3' }),
			session({ sessionId: 'u4' }),
			session({ sessionId: 'u5' }),
			session({ sessionId: 'pinned-late', isPinned: true, pinnedAt: '2026-07-01T00:00:00Z' })
		]
		const result = orderVisibleProjectSessions(sessions, null, 5)
		expect(result.map((s) => s.sessionId)).toEqual(['pinned-late', 'u1', 'u2', 'u3', 'u4'])
	})

	test('shows every pinned session even when pins alone exceed the limit', () => {
		const sessions = [
			session({ sessionId: 'p1', isPinned: true, pinnedAt: '2026-07-06T00:00:00Z' }),
			session({ sessionId: 'p2', isPinned: true, pinnedAt: '2026-07-05T00:00:00Z' }),
			session({ sessionId: 'p3', isPinned: true, pinnedAt: '2026-07-04T00:00:00Z' }),
			session({ sessionId: 'p4', isPinned: true, pinnedAt: '2026-07-03T00:00:00Z' }),
			session({ sessionId: 'p5', isPinned: true, pinnedAt: '2026-07-02T00:00:00Z' }),
			session({ sessionId: 'p6', isPinned: true, pinnedAt: '2026-07-01T00:00:00Z' })
		]
		const result = orderVisibleProjectSessions(sessions, null, 5)
		expect(result.map((s) => s.sessionId)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'])
	})

	test('keeps at least two recency slots when pins fill the limit', () => {
		const sessions = [
			session({ sessionId: 'recent1' }),
			session({ sessionId: 'recent2' }),
			session({ sessionId: 'recent3' }),
			session({ sessionId: 'p1', isPinned: true, pinnedAt: '2026-07-05T00:00:00Z' }),
			session({ sessionId: 'p2', isPinned: true, pinnedAt: '2026-07-04T00:00:00Z' }),
			session({ sessionId: 'p3', isPinned: true, pinnedAt: '2026-07-03T00:00:00Z' }),
			session({ sessionId: 'p4', isPinned: true, pinnedAt: '2026-07-02T00:00:00Z' }),
			session({ sessionId: 'p5', isPinned: true, pinnedAt: '2026-07-01T00:00:00Z' })
		]
		const result = orderVisibleProjectSessions(sessions, null, 5)
		expect(result.map((s) => s.sessionId)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'recent1', 'recent2'])
	})

	test('appends the current session when it falls outside the visible slice', () => {
		const sessions = [
			session({ sessionId: 'u1' }),
			session({ sessionId: 'u2' }),
			session({ sessionId: 'u3' }),
			session({ sessionId: 'u4' }),
			session({ sessionId: 'u5' }),
			session({ sessionId: 'current' })
		]
		const result = orderVisibleProjectSessions(sessions, 'current', 5)
		expect(result.map((s) => s.sessionId)).toEqual(['u1', 'u2', 'u3', 'u4', 'u5', 'current'])
	})

	test('returns the slice untouched when the current session is already visible', () => {
		const sessions = [session({ sessionId: 'u1' }), session({ sessionId: 'u2' })]
		const result = orderVisibleProjectSessions(sessions, 'u2', 5)
		expect(result.map((s) => s.sessionId)).toEqual(['u1', 'u2'])
	})
})

describe('orderVisibleProjectSessions activity ordering', () => {
	test('lifts the most recently used chat to the top of the pinned block', () => {
		const sessions = [
			session({
				sessionId: 'pinned-recently',
				isPinned: true,
				pinnedAt: '2026-07-09T00:00:00Z',
				lastActivity: '2026-08-01T00:00:00Z'
			}),
			session({
				sessionId: 'just-used',
				isPinned: true,
				pinnedAt: '2026-07-01T00:00:00Z',
				lastActivity: '2026-08-09T00:00:00Z'
			})
		]
		const result = orderVisibleProjectSessions(sessions, null, 5)
		expect(result.map((s) => s.sessionId)).toEqual(['just-used', 'pinned-recently'])
	})

	test('orders unpinned sessions by activity regardless of server order', () => {
		const sessions = [
			session({ sessionId: 'stale', lastActivity: '2026-08-01T00:00:00Z' }),
			session({ sessionId: 'fresh', lastActivity: '2026-08-09T00:00:00Z' })
		]
		const result = orderVisibleProjectSessions(sessions, null, 5)
		expect(result.map((s) => s.sessionId)).toEqual(['fresh', 'stale'])
	})
})

describe('bumpProjectSessionActivity', () => {
	test('stamps the bumped session with the new activity time', () => {
		const sessions = [
			session({ sessionId: 'a', lastActivity: '2026-08-01T00:00:00Z' }),
			session({ sessionId: 'b', lastActivity: '2026-08-02T00:00:00Z' })
		]
		const result = bumpProjectSessionActivity(sessions, 'a', '2026-08-09T00:00:00Z')
		expect(result?.find((s) => s.sessionId === 'a')?.lastActivity).toBe('2026-08-09T00:00:00Z')
		expect(result?.find((s) => s.sessionId === 'b')?.lastActivity).toBe('2026-08-02T00:00:00Z')
	})

	test('leaves the list untouched when the session is not in it', () => {
		const sessions = [session({ sessionId: 'a' })]
		expect(bumpProjectSessionActivity(sessions, 'missing', '2026-08-09T00:00:00Z')).toBe(sessions)
	})

	test('returns undefined when there is no cached list', () => {
		expect(bumpProjectSessionActivity(undefined, 'a', '2026-08-09T00:00:00Z')).toBeUndefined()
	})
})
