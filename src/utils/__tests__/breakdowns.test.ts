import { describe, expect, test } from 'vitest'
import { normalizeDailyPairs } from '../breakdowns'

describe('normalizeDailyPairs', () => {
	const firstDay = 86_400

	test('sums same-day flow observations', () => {
		expect(
			normalizeDailyPairs(
				[
					[firstDay + 60, 4],
					[firstDay + 120, 6]
				],
				'sum'
			)
		).toEqual([[firstDay, 10]])
	})

	test('keeps the last same-day stock observation', () => {
		expect(
			normalizeDailyPairs(
				[
					[firstDay + 60, 4],
					[firstDay + 120, 6]
				],
				'last'
			)
		).toEqual([[firstDay, 6]])
	})
})
