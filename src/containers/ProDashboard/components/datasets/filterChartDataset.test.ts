import { describe, expect, it } from 'vitest'
import { filterChartDatasetByTimePeriod } from './filterChartDataset'

const dataset = {
	dimensions: ['timestamp', 'Value'],
	source: [
		{ timestamp: 1_704_067_200_000, Value: 1 },
		{ timestamp: 1_704_153_600_000, Value: 2 },
		{ timestamp: 1_704_240_000_000, Value: 3 }
	]
}

describe('filterChartDatasetByTimePeriod', () => {
	it('uses inclusive second-based custom bounds on millisecond rows', () => {
		const filtered = filterChartDatasetByTimePeriod(dataset, 'custom', {
			type: 'absolute',
			startDate: 1_704_153_600,
			endDate: 1_704_153_600
		})

		expect(filtered.source).toEqual([{ timestamp: 1_704_153_600_000, Value: 2 }])
		expect(filtered.source[0]).toBe(dataset.source[1])
	})

	it('returns the original dataset when all rows remain', () => {
		expect(filterChartDatasetByTimePeriod(dataset, 'all')).toBe(dataset)
	})
})
