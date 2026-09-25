import { describe, expect, test } from 'vitest'
import {
	aggregateBreakdown,
	buildRevenueChartModels,
	channelsToBars,
	filterTimeSeries,
	lastSeriesValue,
	singleSeriesDataset,
	timeframeStartIndex
} from '../chartData'

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

	test('keeps the last seven days as Unix-second points', () => {
		const dates = Array.from({ length: 9 }, (_, index) => `2026-01-0${index + 1}`)
		const values = [1, 2, 3, 4, 5, 6, 7, 8, 9]

		expect(filterTimeSeries(dates, values, '7d')).toEqual([
			[1_767_398_400, 3],
			[1_767_484_800, 4],
			[1_767_571_200, 5],
			[1_767_657_600, 6],
			[1_767_744_000, 7],
			[1_767_830_400, 8],
			[1_767_916_800, 9]
		])
	})

	test('starts YTD at January 1 instead of estimating a trailing day count', () => {
		const year = new Date().getUTCFullYear()
		expect(timeframeStartIndex([`${year - 1}-12-31`, `${year}-01-01`, `${year}-01-02`], 'ytd')).toBe(1)
	})
})

describe('NEAR revenue charts', () => {
	// Mon Sep 14 to Tue Sep 22, 2026: one full week and two days of the next.
	const dates = Array.from({ length: 9 }, (_, index) => `2026-09-${String(14 + index).padStart(2, '0')}`)
	const series = {
		feesDates: dates,
		cumulativeFees: dates.map((_, index) => 100 + index),
		protocolFeesSeries: dates.map(() => 1),
		intentFeesSeries: dates.map(() => 2),
		revenueDates: dates,
		cumulativeRevenue: dates.map((_, index) => 10 + index),
		burnRevenueSeries: dates.map(() => 3),
		intentsRevenueSeries: dates.map(() => 4)
	}

	test('sums each week into its Sunday and keeps the cumulative value at the end of that week', () => {
		const { feesModel } = buildRevenueChartModels(series, 'all', 'weekly')

		expect(feesModel.dataset.dimensions).toEqual(['timestamp', 'Cumulative Fees', 'Protocol Fees', 'Intent Fees'])
		expect(feesModel.dataset.source).toEqual([
			[Date.UTC(2026, 8, 20), 106, 7, 14],
			// The current week so far: two days, and the latest cumulative value.
			[Date.UTC(2026, 8, 27), 108, 2, 4]
		])
	})

	test('keeps the cumulative line out of the tooltip total of the fee sources', () => {
		const { feesModel, revenueModel } = buildRevenueChartModels(series, 'all', 'weekly')
		const excluded = [...feesModel.charts, ...revenueModel.charts]
			.filter((chart) => chart.excludeFromTooltipTotal)
			.map((chart) => chart.name)

		expect(excluded).toEqual(['Cumulative Fees', 'Cumulative Revenue'])
	})

	test('leaves daily values as they are', () => {
		const { revenueModel } = buildRevenueChartModels(series, 'all', 'daily')

		expect(revenueModel.dataset.source).toHaveLength(9)
		expect(revenueModel.dataset.source[0]).toEqual([Date.UTC(2026, 8, 14), 10, 3, 4])
	})
})
