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
