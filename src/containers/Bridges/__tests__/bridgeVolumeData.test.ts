import { describe, expect, it } from 'vitest'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import {
	BRIDGE_VOLUME_COMBINED_CHARTS,
	BRIDGE_VOLUME_SPLIT_CHARTS,
	buildBridgeVolumeChartData,
	getStaleBridgeVolumeTimestamp
} from '../bridgeVolumeData'

describe('buildBridgeVolumeChartData', () => {
	it('builds daily split volume rows in chronological order', () => {
		const result = buildBridgeVolumeChartData({
			data: [
				{ date: '1', depositUSD: 10, withdrawUSD: 3, depositTxs: 1, withdrawTxs: 1 },
				{ date: '2', depositUSD: 20, withdrawUSD: 5, depositTxs: 2, withdrawTxs: 1 }
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
		expect(result.charts).toBe(BRIDGE_VOLUME_SPLIT_CHARTS)
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
				{ date: String(day1), depositUSD: 30, withdrawUSD: 10, depositTxs: 3, withdrawTxs: 1 },
				{ date: String(day2), depositUSD: 70, withdrawUSD: 20, depositTxs: 7, withdrawTxs: 2 },
				{ date: String(day9), depositUSD: 40, withdrawUSD: 30, depositTxs: 4, withdrawTxs: 3 }
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
		expect(result.charts).toBe(BRIDGE_VOLUME_COMBINED_CHARTS)
	})

	it('treats omitted raw bridge metric sides as zero', () => {
		const result = buildBridgeVolumeChartData({
			data: [
				{ date: '1', depositUSD: 10, depositTxs: 2 },
				{ date: '2', withdrawUSD: 5, withdrawTxs: 1 }
			],
			timePeriod: 'daily',
			metricType: 'Volume',
			viewType: 'Combined'
		})

		expect(result.dataset.source).toEqual([
			[1_000, 10],
			[2_000, 5]
		])
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
			date: String(Date.parse(`${date}T00:00:00Z`) / 1e3),
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
