import { describe, expect, test } from 'vitest'
import type { ChartBuilderCsvRequest } from '~/containers/ProDashboard/chartBuilderCsvContract'
import { buildChartBuilderCsvPayload } from '../csvData'

describe('buildChartBuilderCsvPayload', () => {
	const weeklyRequest = (metric: ChartBuilderCsvRequest['config']['metric']): ChartBuilderCsvRequest => ({
		config: {
			metric,
			mode: 'protocol',
			chainFilterMode: 'include',
			categoryFilterMode: 'include',
			chainCategoryFilterMode: 'include',
			protocolCategoryFilterMode: 'include',
			chains: [],
			categories: [],
			groupBy: 'protocol',
			limit: 10,
			chartType: 'stackedBar',
			displayAs: 'timeSeries'
		},
		grouping: 'week',
		timePeriod: 'all',
		customTimePeriod: null,
		filename: `${metric}.csv`
	})
	// Mon Sep 14 to Mon Sep 21, 2026: one full Monday-to-Sunday week plus the next week's first day.
	const days = Array.from({ length: 8 }, (_, index) => Date.UTC(2026, 8, 14 + index) / 1e3)

	test('names both ends of each week and sums flow metrics across it', () => {
		const payload = buildChartBuilderCsvPayload(weeklyRequest('fees'), [
			{ name: 'Ethereum', data: days.map((day, index) => [day, index + 1]), color: '#000' }
		])

		expect(payload.rows).toEqual([
			['Week start', 'Week end', 'Ethereum'],
			// 1 + 2 + … + 7
			['2026-09-14', '2026-09-20', 28],
			['2026-09-21', '2026-09-27', 8]
		])
	})

	test('keeps the final daily snapshot of each week for snapshot metrics', () => {
		const payload = buildChartBuilderCsvPayload(weeklyRequest('tvl'), [
			{ name: 'Ethereum', data: days.map((day, index) => [day, 100 + index]), color: '#000' }
		])

		expect(payload.rows).toEqual([
			['Week start', 'Week end', 'Ethereum'],
			['2026-09-14', '2026-09-20', 106],
			['2026-09-21', '2026-09-27', 107]
		])
	})

	test('exports a treemap as one row per entity using the selected calculation', () => {
		const request: ChartBuilderCsvRequest = {
			config: {
				metric: 'perps',
				mode: 'protocol',
				chainFilterMode: 'include',
				categoryFilterMode: 'include',
				chainCategoryFilterMode: 'include',
				protocolCategoryFilterMode: 'include',
				chains: [],
				categories: [],
				groupBy: 'protocol',
				limit: 10,
				chartType: 'treemap',
				treemapValue: 'sum7d',
				displayAs: 'timeSeries'
			},
			grouping: 'day',
			timePeriod: 'all',
			customTimePeriod: null,
			filename: 'perps.csv'
		}
		// Nine daily points, so the last 7 days (3..9 = 42) differ from the latest day (9) and the full sum (45).
		const nineDays = Array.from({ length: 9 }, (_, index) => (index + 1) * 86_400)
		const payload = buildChartBuilderCsvPayload(request, [
			{ name: 'Ethereum', data: nineDays.map((day, index): [number, number] => [day, index + 1]), color: '#000' },
			{ name: 'Solana', data: nineDays.map((day): [number, number] => [day, 1]), color: '#000' }
		])

		expect(payload.rows).toEqual([
			['Name', 'Sum 7d'],
			['Ethereum', 42],
			['Solana', 7]
		])
	})
})
