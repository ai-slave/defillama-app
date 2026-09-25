import { describe, expect, test } from 'vitest'
import { filterChartDatasetByTimePeriod } from './filterChartDataset'

const dataset = {
	dimensions: ['timestamp', 'Value'],
	source: [
		[1_704_067_200_000, 1],
		[1_704_153_600_000, 2],
		[1_704_240_000_000, 3]
	]
}

describe('filterChartDatasetByTimePeriod', () => {
	test('uses inclusive second-based custom bounds on millisecond rows', () => {
		const filtered = filterChartDatasetByTimePeriod(dataset, 'custom', {
			type: 'absolute',
			startDate: 1_704_153_600,
			endDate: 1_704_153_600
		})

		expect(filtered.source).toEqual([[1_704_153_600_000, 2]])
		expect(filtered.source[0]).toBe(dataset.source[1])
	})
})
