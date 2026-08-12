import { describe, expect, it } from 'vitest'
import { compareSessionsByActivity } from '../sessionActivityOrder'

describe('compareSessionsByActivity', () => {
	it('puts the most recently active session first', () => {
		const sessions = [
			{ sessionId: 'stale', lastActivity: '2026-08-01T00:00:00Z' },
			{ sessionId: 'fresh', lastActivity: '2026-08-09T00:00:00Z' }
		]
		expect([...sessions].sort(compareSessionsByActivity).map((s) => s.sessionId)).toEqual(['fresh', 'stale'])
	})

	it('falls back to createdAt when a session has never been active', () => {
		const sessions = [
			{ sessionId: 'older', lastActivity: null, createdAt: '2026-07-01T00:00:00Z' },
			{ sessionId: 'newer', lastActivity: null, createdAt: '2026-07-05T00:00:00Z' }
		]
		expect([...sessions].sort(compareSessionsByActivity).map((s) => s.sessionId)).toEqual(['newer', 'older'])
	})

	it('breaks activity ties with the most recent pin', () => {
		const sessions = [
			{ sessionId: 'pinned-first', lastActivity: '2026-08-01T00:00:00Z', pinnedAt: '2026-07-01T00:00:00Z' },
			{ sessionId: 'pinned-last', lastActivity: '2026-08-01T00:00:00Z', pinnedAt: '2026-07-09T00:00:00Z' }
		]
		expect([...sessions].sort(compareSessionsByActivity).map((s) => s.sessionId)).toEqual([
			'pinned-last',
			'pinned-first'
		])
	})
})
