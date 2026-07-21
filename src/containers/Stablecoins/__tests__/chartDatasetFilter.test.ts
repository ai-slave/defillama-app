import { describe, expect, it } from 'vitest'
import { filterStablecoinDatasetByTimePeriod } from '~/containers/ProDashboard/components/datasets/stablecoinChartUtils'

describe('filterStablecoinDatasetByTimePeriod', () => {
	it('filters canonical USD inflow rows with second-based dashboard bounds', () => {
		const dataset = {
			dimensions: ['timestamp', 'USD Inflows'],
			source: [
				[1704067200000, 10],
				[1704153600000, -5],
				[1704240000000, 20]
			]
		}

		expect(
			filterStablecoinDatasetByTimePeriod(dataset, 'custom', {
				type: 'absolute',
				startDate: 1704153600,
				endDate: 1704153600
			}).source
		).toEqual([[1704153600000, -5]])
	})
})
