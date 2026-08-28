import { describe, expect, it } from 'vitest'
import type { IEquitiesDimensionsResponse } from '../api.types'
import { buildEquitiesDimensionsChart, buildIntradayPriceHistoryChart, buildPriceHistoryChart } from '../chartData'

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
	},
	basicSharesOutstanding: {
		annual: [
			['2025-12-31', 2_400_000_000],
			['2024-12-31', 2_500_000_000]
		],
		quarterly: [['2025-06-30', 2_450_000_000]]
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

	it('labels shares outstanding without a currency symbol', () => {
		const chart = buildEquitiesDimensionsChart(dimensions, 'basicSharesOutstanding', 'annual')
		expect(chart.dataset).toEqual({
			source: [
				[Date.parse('2024-12-31T00:00:00Z'), 2_500_000_000],
				[Date.parse('2025-12-31T00:00:00Z'), 2_400_000_000]
			],
			dimensions: ['timestamp', 'Shares Outstanding']
		})
		expect(chart.charts[0].valueSymbol).toBe('')
		expect(buildEquitiesDimensionsChart(dimensions, 'revenue', 'annual').charts[0].valueSymbol).toBe('$')
	})

	it('preserves measured zero in price and dimension charts', () => {
		expect(buildPriceHistoryChart([['2025-01-01', 0]]).dataset.source).toEqual([[Date.parse('2025-01-01'), 0]])
		expect(
			buildEquitiesDimensionsChart(
				{
					...dimensions,
					earnings: { ...dimensions.earnings, quarterly: [['2025-06-30', 0]] }
				},
				'earnings',
				'quarterly'
			).dataset.source
		).toEqual([[Date.parse('2025-06-30T00:00:00Z'), 0]])
	})
})

describe('intraday price history', () => {
	// Two sessions, newest-first as the API returns them. 17 hours of closed market sit
	// between 20:00 on the 26th and 13:30 on the 27th.
	const intraday: Array<[string, number]> = [
		['2026-08-27T13:35:00Z', 223],
		['2026-08-27T13:30:00Z', 222],
		['2026-08-26T19:55:00Z', 210],
		['2026-08-26T19:50:00Z', 209]
	]

	it('plots sessions as adjacent categories so closed hours are compressed out', () => {
		const chart = buildIntradayPriceHistoryChart(intraday, '1W')
		expect(chart.dataset.dimensions).toEqual(['session', 'Close'])
		expect(chart.dataset.source).toEqual([
			['26 Aug 19:50', 209],
			['26 Aug 19:55', 210],
			['27 Aug 13:30', 222],
			['27 Aug 13:35', 223]
		])
	})

	it('keeps machine timestamps for CSV export while the axis shows labels', () => {
		const chart = buildIntradayPriceHistoryChart(intraday, '1W')
		expect(chart.csvDataset.dimensions).toEqual(['timestamp', 'Close'])
		expect(chart.csvDataset.source).toEqual([
			[Date.parse('2026-08-26T19:50:00Z'), 209],
			[Date.parse('2026-08-26T19:55:00Z'), 210],
			[Date.parse('2026-08-27T13:30:00Z'), 222],
			[Date.parse('2026-08-27T13:35:00Z'), 223]
		])
	})
})
