import { describe, expect, test } from 'vitest'
import {
	aggregateBreakdown,
	aggregateTimeSeries,
	channelsToBars,
	filterTimeSeries,
	lastSeriesValue,
	singleSeriesDataset,
	timeframeStartIndex
} from './chartData'

describe('NEAR chart data', () => {
	test('uses API series values under the configured chart dimension', () => {
		const chart = {
			title: 'Transactions',
			dates: ['2026-01-01', '2026-01-02'],
			series: [{ name: 'txs', data: [1, 2] }]
		}
		expect(singleSeriesDataset(chart, 'Daily Transactions')).toEqual({
			dimensions: ['timestamp', 'Daily Transactions'],
			source: [
				[Date.parse('2026-01-01T00:00:00Z'), 1],
				[Date.parse('2026-01-02T00:00:00Z'), 2]
			]
		})
	})

	test('groups breakdowns and referral channels deterministically', () => {
		const breakdown = {
			title: 'Tokens',
			dates: ['2026-01-01'],
			series: [
				{ name: 'A', data: [5] },
				{ name: 'B', data: [3] },
				{ name: 'C', data: [2] }
			]
		}
		expect(aggregateBreakdown(breakdown, 2)).toEqual([
			{ name: 'A', value: 5 },
			{ name: 'B', value: 3 },
			{ name: 'Others', value: 2 }
		])
		expect(
			channelsToBars({
				title: 'Channels',
				total: 5,
				totalFormatted: '$5',
				channels: [
					{ referral: '', fees: 2, feesFormatted: '$2', sharePct: 40, shareFormatted: '40%' },
					{ referral: 'wallet', fees: 3, feesFormatted: '$3', sharePct: 60, shareFormatted: '60%' }
				]
			})
		).toEqual({ categories: ['wallet', 'unknown'], values: [3, 2] })
		expect(lastSeriesValue({ ...breakdown, series: [{ name: 'A', data: [1, Number.NaN, 4] }] }, 'A')).toBe(4)
	})

	test('filters daily values and aggregates weekly values in seconds', () => {
		const dates = ['2026-01-05', '2026-01-06', '2026-01-12']
		const values = [1, 2, 4]
		expect(filterTimeSeries(dates, values, '7d')).toEqual(
			dates.map((date, i) => [Date.parse(`${date}T00:00:00Z`) / 1e3, values[i]])
		)
		expect(aggregateTimeSeries(dates, values, 'all', 'weekly')).toEqual([
			[Date.parse('2026-01-05T00:00:00Z') / 1e3, 3],
			[Date.parse('2026-01-12T00:00:00Z') / 1e3, 4]
		])
	})

	test('starts YTD at January 1 instead of estimating a trailing day count', () => {
		const year = new Date().getUTCFullYear()
		expect(timeframeStartIndex([`${year - 1}-12-31`, `${year}-01-01`, `${year}-01-02`], 'ytd')).toBe(1)
	})
})
