import { describe, expect, test } from 'vitest'
import { getPrevTvlFromChart } from '../tvlChart'

describe('getPrevTvlFromChart', () => {
	test('returns the latest chart value for day zero', () => {
		expect(
			getPrevTvlFromChart(
				[
					[1_774_483_200, 100],
					[1_774_526_400, 110]
				],
				0,
				new Date('2026-03-25T12:00:00Z').getTime()
			)
		).toBe(110)
	})

	test('returns the point closest to the 24h target within tolerance', () => {
		expect(
			getPrevTvlFromChart(
				[
					[new Date('2026-03-26T00:02:00Z').getTime(), 100],
					[new Date('2026-03-26T00:04:00Z').getTime(), 110],
					[new Date('2026-03-27T00:05:00Z').getTime(), 120]
				],
				1,
				new Date('2026-03-27T12:00:00Z').getTime()
			)
		).toBe(110)
	})

	test('returns null when the latest chart point is stale', () => {
		expect(
			getPrevTvlFromChart(
				[
					[1_774_396_800, 90],
					[1_774_483_200, 100]
				],
				1,
				new Date('2026-03-27T12:00:00Z').getTime()
			)
		).toBeNull()
	})

	test('returns null when no point is close enough to the 24h target', () => {
		expect(
			getPrevTvlFromChart(
				[
					[new Date('2026-03-26T12:00:00Z').getTime(), 90],
					[new Date('2026-03-27T00:05:00Z').getTime(), 120]
				],
				1,
				new Date('2026-03-27T12:00:00Z').getTime()
			)
		).toBeNull()
	})
})
