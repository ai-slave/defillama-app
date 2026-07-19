import { describe, expect, it } from 'vitest'
import {
	formatBridgesData,
	formatChainsData,
	getCompletedBridgeVolumePair,
	getCompletedBridgeVolumeTotal,
	getCompletedBridgeVolumeTotals
} from '../utils'

const NOW = Date.parse('2026-07-14T12:00:00Z')
const day = (date: string, volume: number) => ({ date: `${date}T00:00:00Z`, volume })

describe('bridge volume freshness', () => {
	it('uses yesterday as the latest complete daily bucket', () => {
		const chart = [day('2026-07-12', 10), day('2026-07-13', 20), day('2026-07-14', 5)]
		expect(getCompletedBridgeVolumePair(chart, NOW)).toEqual({ current: 20, previous: 10 })
	})

	it('returns null for a rolling total when any expected daily bucket is missing', () => {
		const chart = [day('2026-07-11', 5), day('2026-07-13', 20), day('2026-07-14', 1)]
		expect(getCompletedBridgeVolumeTotal(chart, 3, false, NOW)).toBeNull()
	})

	it('sums complete deposit and withdrawal volume windows', () => {
		const chart = [
			{ date: '2026-07-12T00:00:00Z', Deposits: 5, Withdrawals: -2 },
			{ date: '2026-07-13T00:00:00Z', Deposits: 10, Withdrawals: -3 }
		]
		expect(getCompletedBridgeVolumeTotal(chart, 2, true, NOW)).toBe(20)
	})

	it('calculates multiple completed windows in one daily-series pass', () => {
		const chart = Array.from({ length: 30 }, (_, index) => ({
			date: new Date(Date.parse('2026-06-14T00:00:00Z') + index * 86_400_000).toISOString(),
			Deposits: 10,
			Withdrawals: -2
		}))
		expect(getCompletedBridgeVolumeTotals(chart, [1, 7, 30], true, NOW)).toEqual(
			new Map([
				[1, 12],
				[7, 84],
				[30, 360]
			])
		)
	})

	it('keeps shorter completed windows when a longer window has a missing day', () => {
		const chart = Array.from({ length: 7 }, (_, index) => ({
			date: new Date(Date.parse('2026-07-07T00:00:00Z') + index * 86_400_000).toISOString(),
			Deposits: 10,
			Withdrawals: -2
		})).filter((point) => !point.date.startsWith('2026-07-10'))

		expect(getCompletedBridgeVolumeTotals(chart, [1, 7, 30], true, NOW)).toEqual(
			new Map([
				[1, 12],
				[7, null],
				[30, null]
			])
		)
	})

	it('treats an omitted chain-volume direction as zero', () => {
		expect(
			formatChainsData({
				chains: [{ name: 'Test Chain' }],
				chartDataByChain: [[{ date: '1', depositUSD: 10 }]],
				chainToChartDataIndex: { 'Test Chain': 0 }
			})
		).toMatchObject([{ prevDayUsdDeposits: 10, prevDayUsdWithdrawals: 0, prevDayNetFlow: 10 }])
	})

	it('keeps backend rolling volumes on the global bridge overview', () => {
		const chart = [day('2026-07-12', 20), day('2026-07-13', 30)]
		const { bridges } = formatBridgesData({
			bridges: [
				{
					name: 'test-bridge',
					displayName: 'Test Bridge',
					chains: ['Ethereum'],
					last24hVolume: 100,
					lastDailyVolume: 90,
					dayBeforeLastVolume: 80,
					weeklyVolume: 700,
					monthlyVolume: 3_000,
					txsPrevDay: 10
				}
			],
			chartDataByBridge: [chart],
			bridgeNameToChartDataIndex: { 'Test Bridge': 0 },
			currentTimeMs: NOW
		})

		expect(bridges[0]).toMatchObject({
			lastDailyVolume: 100,
			weeklyVolume: 700,
			monthlyVolume: 3_000,
			change_1d: 50
		})
	})

	it('uses exact completed-day volumes on a chain bridge overview', () => {
		const chart = Array.from({ length: 30 }, (_, index) =>
			day(new Date(Date.parse('2026-06-14T00:00:00Z') + index * 86_400_000).toISOString().slice(0, 10), index + 1)
		)
		const { bridges } = formatBridgesData({
			chain: 'Ethereum',
			bridges: [
				{
					name: 'test-bridge',
					displayName: 'Test Bridge',
					chains: ['Ethereum'],
					last24hVolume: 100,
					lastDailyVolume: 90,
					dayBeforeLastVolume: 80,
					weeklyVolume: 700,
					monthlyVolume: 3_000,
					txsPrevDay: 10
				}
			],
			chartDataByBridge: [chart],
			bridgeNameToChartDataIndex: { 'Test Bridge': 0 },
			currentTimeMs: NOW
		})

		expect(bridges[0]).toMatchObject({
			lastDailyVolume: 30,
			weeklyVolume: 189,
			monthlyVolume: 465
		})
	})
})
