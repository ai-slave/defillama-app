import dayjs from 'dayjs'
import { describe, expect, test } from 'vitest'
import { aggregateMetricValues, partitionMetricWindows } from '../useMetricData'

describe('metric card aggregation', () => {
	test('partitions current and comparison windows in one pass', () => {
		const reference = dayjs.unix(21 * 86_400)
		const series: Array<[number, number]> = [
			[6 * 86_400, 1],
			[7 * 86_400, 2],
			[13 * 86_400, 3],
			[14 * 86_400, 4],
			[21 * 86_400, 5]
		]

		expect(partitionMetricWindows(series, '7d', reference)).toEqual({
			current: [
				[14 * 86_400, 4],
				[21 * 86_400, 5]
			],
			currentValues: [4, 5],
			previousValues: [2, 3]
		})
	})

	test('year to date splits at the UTC new year west of UTC', () => {
		const originalTimeZone = process.env.TZ
		// Los Angeles is behind UTC, so a local new year lands mid-morning on the UTC Jan 1 point.
		process.env.TZ = 'America/Los_Angeles'
		try {
			const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 1000
			const series: Array<[number, number]> = [
				[day('2024-12-31'), 1],
				[day('2025-01-01'), 2],
				[day('2025-12-31'), 3],
				[day('2026-01-01'), 4],
				[day('2026-06-01'), 5]
			]

			expect(partitionMetricWindows(series, 'ytd', dayjs('2026-10-01T02:56:00Z'))).toEqual({
				current: [
					[day('2026-01-01'), 4],
					[day('2026-06-01'), 5]
				],
				currentValues: [4, 5],
				previousValues: [2, 3]
			})
		} finally {
			// Assigning undefined to an env var stores the string "undefined".
			if (originalTimeZone === undefined) delete process.env.TZ
			else process.env.TZ = originalTimeZone
		}
	})

	test('preserves repeated non-zero values for growth', () => {
		expect(aggregateMetricValues([5, 5], 'growth', '7d')).toBe(0)
		expect(aggregateMetricValues([0, 5], 'growth', '7d')).toBeNull()
	})

	test('aggregates large value arrays without spreading them as function arguments', () => {
		const values = Array.from({ length: 200_000 }, (_, index) => index)
		expect(aggregateMetricValues(values, 'max', 'all')).toBe(199_999)
		expect(aggregateMetricValues(values, 'min', 'all')).toBe(0)
	})
})
