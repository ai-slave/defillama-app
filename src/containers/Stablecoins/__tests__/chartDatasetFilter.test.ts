import { describe, expect, it } from 'vitest'
import { filterStablecoinDatasetByTimePeriod } from '~/containers/ProDashboard/components/datasets/stablecoinChartUtils'

describe('filterStablecoinDatasetByTimePeriod', () => {
	it('filters canonical USD inflow rows with second-based dashboard bounds', () => {
		const dataset = {
			dimensions: ['timestamp', 'USD Inflows'],
			source: [
				{ timestamp: 1704067200000, 'USD Inflows': 10 },
				{ timestamp: 1704153600000, 'USD Inflows': -5 },
				{ timestamp: 1704240000000, 'USD Inflows': 20 }
			]
		}

		expect(
			filterStablecoinDatasetByTimePeriod(dataset, 'custom', {
				type: 'absolute',
				startDate: 1704153600,
				endDate: 1704153600
			}).source
		).toEqual([{ timestamp: 1704153600000, 'USD Inflows': -5 }])
	})
})
