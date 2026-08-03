import { describe, expect, it } from 'vitest'
import { orderVisibleProjectSessions } from '../sessionOrdering'
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
	it('returns empty list when sessions are missing', () => {
		expect(orderVisibleProjectSessions(undefined, null, 5)).toEqual([])
	})

	it('sorts pinned sessions above unpinned ones', () => {
		const sessions = [
			session({ sessionId: 'a' }),
			session({ sessionId: 'b', isPinned: true, pinnedAt: '2026-07-01T00:00:00Z' }),
			session({ sessionId: 'c' }),
			session({ sessionId: 'd', isPinned: true, pinnedAt: '2026-07-02T00:00:00Z' })
		]
		const result = orderVisibleProjectSessions(sessions, null, 5)
		expect(result.map((s) => s.sessionId)).toEqual(['d', 'b', 'a', 'c'])
	})

	it('keeps unpinned sessions in their original order after the pinned block', () => {
		const sessions = [
			session({ sessionId: 'newest' }),
			session({ sessionId: 'older' }),
			session({ sessionId: 'pinned', isPinned: true, pinnedAt: '2026-06-01T00:00:00Z' })
		]
		const result = orderVisibleProjectSessions(sessions, null, 5)
		expect(result.map((s) => s.sessionId)).toEqual(['pinned', 'newest', 'older'])
	})

	it('slices to the limit after sorting so pins beyond the cut still surface', () => {
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

	it('appends the current session when it falls outside the visible slice', () => {
		const sessions = [
			session({ sessionId: 'u1' }),
			session({ sessionId: 'u2' }),
			session({ sessionId: 'u3' }),
			session({ sessionId: 'u4' }),
			session({ sessionId: 'u5' }),
			session({ sessionId: 'current' })
		]
		const result = orderVisibleProjectSessions(sessions, 'current', 5)
		expect(result.map((s) => s.sessionId)).toEqual(['u1', 'u2', 'u3', 'u4', 'current'])
	})

	it('returns the slice untouched when the current session is already visible', () => {
		const sessions = [session({ sessionId: 'u1' }), session({ sessionId: 'u2' })]
		const result = orderVisibleProjectSessions(sessions, 'u2', 5)
		expect(result.map((s) => s.sessionId)).toEqual(['u1', 'u2'])
	})
})
