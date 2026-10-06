import { describe, expect, test } from 'vitest'
import { filterChartDatasetByTimePeriod } from '~/containers/ProDashboard/components/datasets/filterChartDataset'

describe('filterStablecoinDatasetByTimePeriod', () => {
	test('filters canonical USD inflow rows with second-based dashboard bounds', () => {
		const dataset = {
			dimensions: ['timestamp', 'USD Inflows'],
			source: [
				[1_704_067_200_000, 10],
				[1_704_153_600_000, -5],
				[1_704_240_000_000, 20]
			]
		}

		expect(
			filterChartDatasetByTimePeriod(dataset, 'custom', {
				type: 'absolute',
				startDate: 1_704_153_600,
				endDate: 1_704_153_600
			}).source
		).toEqual([[1_704_153_600_000, -5]])
	})
})
