import { describe, expect, it } from 'vitest'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import {
	BRIDGE_VOLUME_SPLIT_CHARTS,
	buildBridgeVolumeChartData,
	getStaleBridgeVolumeTimestamp
} from '../bridgeVolumeData'

describe('buildBridgeVolumeChartData', () => {
	it('builds daily split volume rows in chronological order', () => {
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
				[1_000, 10, -3],
				[2_000, 20, -5]
			]
		})
	})

	it('keeps signed split bars out of ECharts large mode', () => {
		expect(BRIDGE_VOLUME_SPLIT_CHARTS).toEqual([
			{
				type: 'bar',
				name: 'Deposits',
				encode: { x: 0, y: 1 },
				color: '#3b82f6',
				stack: 'metric',
				large: false
			},
			{
				type: 'bar',
				name: 'Withdrawals',
				encode: { x: 0, y: 2 },
				color: '#ef4444',
				stack: 'metric',
				large: false
			}
		])
	})

	it('groups combined transaction rows by selected period', () => {
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

	it('preserves unknown volume legs and requires both for a combined value', () => {
		const result = buildBridgeVolumeChartData({
			data: [
				{ date: 1, depositUSD: 10, withdrawUSD: null, depositTxs: 2, withdrawTxs: 0 },
				{ date: 2, depositUSD: null, withdrawUSD: 5, depositTxs: 0, withdrawTxs: 1 }
			],
			timePeriod: 'daily',
			metricType: 'Volume',
			viewType: 'Combined'
		})

		expect(result.dataset.source).toEqual([
			[1_000, null],
			[2_000, null]
		])
	})

	it('uses the midpoint for combined USD volume and the sum for combined transaction counts', () => {
		const data = [{ date: 1, depositUSD: 30, withdrawUSD: 10, depositTxs: 3, withdrawTxs: 2 }]

		expect(
			buildBridgeVolumeChartData({ data, timePeriod: 'daily', metricType: 'Volume', viewType: 'Combined' }).dataset
				.source
		).toEqual([[1_000, 20]])
		expect(
			buildBridgeVolumeChartData({ data, timePeriod: 'daily', metricType: 'Transactions', viewType: 'Combined' })
				.dataset.source
		).toEqual([[1_000, 5]])
	})

	it('shows a known split leg and exact transaction counts', () => {
		const volume = buildBridgeVolumeChartData({
			data: [{ date: 1, depositUSD: 10, withdrawUSD: null, depositTxs: 0, withdrawTxs: 0 }],
			timePeriod: 'daily',
			metricType: 'Volume',
			viewType: 'Split'
		})
		const transactions = buildBridgeVolumeChartData({
			data: [{ date: 1, depositUSD: null, withdrawUSD: null, depositTxs: 2, withdrawTxs: 0 }],
			timePeriod: 'daily',
			metricType: 'Transactions',
			viewType: 'Combined'
		})

		expect(volume.dataset.source).toEqual([[1_000, 10, null]])
		expect(transactions.dataset.source).toEqual([[1_000, 2]])
	})

	it('keeps empty combined datasets dimensioned for the active view', () => {
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

	it('reports the last chart date only when bridge volume data is stale', () => {
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
