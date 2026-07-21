import { describe, expect, it } from 'vitest'
import type { IEquitiesDimensionsResponse } from '../api.types'
import { buildEquitiesDimensionsChart, buildPriceHistoryChart } from '../chartData'

const dimensions: IEquitiesDimensionsResponse = {
	revenue: {
		annual: [
			['2025-12-31', 300],
			['2024-12-31', 200]
		],
		quarterly: [
			['2025-06-30', 120],
			['2025-03-31', 100]
		]
	},
	holdersRevenue: {
		annual: [
			['2025-12-31', 40],
			['2024-12-31', 35]
		],
		quarterly: [['2025-06-30', 10]]
	},
	earnings: {
		annual: [['2025-12-31', 80]],
		quarterly: [['2025-06-30', 20]]
	}
}

describe('equities chart data', () => {
	it('reverses newest-first price history without sorting', () => {
		expect(
			buildPriceHistoryChart([
				['2025-01-02', 20],
				['2025-01-01', 10]
			]).dataset.source
		).toEqual([
			[Date.parse('2025-01-01'), 10],
			[Date.parse('2025-01-02'), 20]
		])
	})

	it('reverses the newest-first API response into a chronological dataset', () => {
		expect(buildEquitiesDimensionsChart(dimensions, 'holdersRevenue', 'annual').dataset).toEqual({
			source: [
				[Date.parse('2024-12-31T00:00:00Z'), 35],
				[Date.parse('2025-12-31T00:00:00Z'), 40]
			],
			dimensions: ['timestamp', 'Holders Revenue']
		})
	})
})
