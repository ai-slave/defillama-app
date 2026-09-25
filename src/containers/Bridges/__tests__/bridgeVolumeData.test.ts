import { describe, expect, test } from 'vitest'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import { buildBridgeVolumeChartData, getStaleBridgeVolumeTimestamp } from '../bridgeVolumeData'

describe('buildBridgeVolumeChartData', () => {
	test('builds daily split volume rows in chronological order', () => {
		const result = buildBridgeVolumeChartData({
			data: [
				{ date: 1, depositUSD: 10, withdrawUSD: 3, depositTxs: 1, withdrawTxs: 1 },
				{ date: 2, depositUSD: 20, withdrawUSD: 5, depositTxs: 2, withdrawTxs: 1 }
			],
			timePeriod: 'daily',
			metricType: 'Volume',
			viewType: 'Split'
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Deposits', 'Withdrawals'],
			source: [
				[1000, 10, -3],
				[2000, 20, -5]
			]
		})
	})

	test('groups combined transaction rows by selected period', () => {
		const day1 = 1_704_067_200
		const day2 = 1_704_153_600
		const day9 = day1 + 8 * 86_400
		const bucket = getBucketTimestampSec(day1, 'weekly')
		const nextBucket = getBucketTimestampSec(day9, 'weekly')
		const result = buildBridgeVolumeChartData({
			data: [
				{ date: day1, depositUSD: 30, withdrawUSD: 10, depositTxs: 3, withdrawTxs: 1 },
				{ date: day2, depositUSD: 70, withdrawUSD: 20, depositTxs: 7, withdrawTxs: 2 },
				{ date: day9, depositUSD: 40, withdrawUSD: 30, depositTxs: 4, withdrawTxs: 3 }
			],
			timePeriod: 'weekly',
			metricType: 'Transactions',
			viewType: 'Combined'
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Total'],
			source: [
				[bucket * 1e3, 13],
				[nextBucket * 1e3, 7]
			]
		})
	})

	test('preserves unknown volume legs, requires both for a combined value, and still counts transactions', () => {
		const data = [
			{ date: 1, depositUSD: 10, withdrawUSD: null, depositTxs: 2, withdrawTxs: 0 },
			{ date: 2, depositUSD: null, withdrawUSD: 5, depositTxs: 0, withdrawTxs: 1 }
		]

		expect(
			buildBridgeVolumeChartData({ data, timePeriod: 'daily', metricType: 'Volume', viewType: 'Split' }).dataset.source
		).toEqual([
			[1000, 10, null],
			[2000, null, -5]
		])
		expect(
			buildBridgeVolumeChartData({ data, timePeriod: 'daily', metricType: 'Volume', viewType: 'Combined' }).dataset
				.source
		).toEqual([
			[1000, null],
			[2000, null]
		])
		expect(
			buildBridgeVolumeChartData({ data, timePeriod: 'daily', metricType: 'Transactions', viewType: 'Combined' })
				.dataset.source
		).toEqual([
			[1000, 2],
			[2000, 1]
		])
	})

	test('uses the midpoint for combined USD volume and the sum for combined transaction counts', () => {
		const data = [{ date: 1, depositUSD: 30, withdrawUSD: 10, depositTxs: 3, withdrawTxs: 2 }]

		expect(
			buildBridgeVolumeChartData({ data, timePeriod: 'daily', metricType: 'Volume', viewType: 'Combined' }).dataset
				.source
		).toEqual([[1000, 20]])
		expect(
			buildBridgeVolumeChartData({ data, timePeriod: 'daily', metricType: 'Transactions', viewType: 'Combined' })
				.dataset.source
		).toEqual([[1000, 5]])
	})

	test('keeps empty combined datasets dimensioned for the active view', () => {
		const result = buildBridgeVolumeChartData({
			data: [],
			timePeriod: 'monthly',
			metricType: 'Volume',
			viewType: 'Combined'
		})

		expect(result.dataset).toEqual({
			dimensions: ['timestamp', 'Total'],
			source: []
		})
	})

	test('reports the last chart date only when bridge volume data is stale', () => {
		const currentTimeMs = Date.parse('2026-07-14T12:00:00Z')
		const point = (date: string) => ({
			date: Date.parse(`${date}T00:00:00Z`) / 1e3,
			depositUSD: 1,
			withdrawUSD: 1,
			depositTxs: 1,
			withdrawTxs: 1
		})

		expect(getStaleBridgeVolumeTimestamp([point('2026-07-13')], currentTimeMs)).toBeNull()
		expect(getStaleBridgeVolumeTimestamp([point('2026-05-15')], currentTimeMs)).toBe(
			Date.parse('2026-05-15T00:00:00Z') / 1e3
		)
	})
})
