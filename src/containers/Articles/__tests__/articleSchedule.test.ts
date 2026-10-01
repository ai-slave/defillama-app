import { describe, expect, test } from 'vitest'
import { isScheduled } from '../articleSchedule'

const NOW = Date.parse('2026-01-01T12:00:00.000Z')

describe('isScheduled', () => {
	test('a draft whose go-live time is ahead is scheduled', () => {
		expect(isScheduled({ status: 'draft', goLiveAt: '2026-06-01T09:00:00.000Z' }, NOW)).toBe(true)
	})

	test('a published article is not scheduled', () => {
		expect(isScheduled({ status: 'published', goLiveAt: '2026-06-01T09:00:00.000Z' }, NOW)).toBe(false)
	})

	test('a draft whose go-live time has passed is not scheduled', () => {
		expect(isScheduled({ status: 'draft', goLiveAt: '2025-12-01T09:00:00.000Z' }, NOW)).toBe(false)
	})
})
