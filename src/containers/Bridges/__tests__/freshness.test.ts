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

	it('uses the latest point in a duplicated UTC day even when input is out of order', () => {
		const chart = [
			{ date: '2026-07-13T23:00:00Z', volume: 30 },
			{ date: '2026-07-12T12:00:00Z', volume: 10 },
			{ date: '2026-07-13T01:00:00Z', volume: 20 }
		]

		expect(getCompletedBridgeVolumePair(chart, NOW)).toEqual({ current: 30, previous: 10 })
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

	it('indexes chain stats with the existing exact and case-insensitive matching rules', () => {
		const charts = Array.from({ length: 8 }, (_, index) => ({
			date: String(index),
			depositUSD: index + 1,
			withdrawUSD: index
		}))
		const prevDay = (name: string, symbol: string, usdValue: number) => ({
			name,
			date: 1,
			totalTokensDeposited: {
				first: { symbol, usdValue, amount: 1, decimals: 18 },
				tie: { symbol: 'TIE', usdValue, amount: 1, decimals: 18 }
			},
			totalTokensWithdrawn: {},
			totalAddressDeposited: {},
			totalAddressWithdrawn: {}
		})
		const inputs = {
			chains: [{ name: 'Ethereum' }, { name: 'ethereum' }],
			chartDataByChain: [charts, charts],
			chainToChartDataIndex: { Ethereum: 0, ethereum: 1 },
			prevDayDataByChain: [prevDay('Ethereum', 'FIRST', 10), prevDay('Ethereum', 'LAST', 20)],
			netflowsDataDay: [
				{ chain: 'eThErEuM', deposited_usd: '100', withdrawn_usd: '40' },
				{ chain: 'ethereum', deposited_usd: '999', withdrawn_usd: '999', net_flow: '0' }
			],
			netflowsDataWeek: [{ chain: 'ETHEREUM', deposited_usd: '700' }]
		}
		const original = structuredClone(inputs)

		expect(formatChainsData(inputs)).toEqual([
			{
				name: 'Ethereum',
				prevDayUsdDeposits: 100,
				prevDayUsdWithdrawals: 40,
				prevWeekUsdDeposits: 700,
				prevWeekUsdWithdrawals: 0,
				topTokenDepositedSymbol: 'FIRST',
				topTokenDepositedUsd: 10,
				topTokenWithdrawnSymbol: null,
				topTokenWithdrawnUsd: 0,
				prevDayNetFlow: 60,
				prevWeekNetFlow: 700
			},
			{
				name: 'ethereum',
				prevDayUsdDeposits: 100,
				prevDayUsdWithdrawals: 40,
				prevWeekUsdDeposits: 700,
				prevWeekUsdWithdrawals: 0,
				topTokenDepositedSymbol: null,
				topTokenDepositedUsd: 0,
				topTokenWithdrawnSymbol: null,
				topTokenWithdrawnUsd: 0,
				prevDayNetFlow: 60,
				prevWeekNetFlow: 700
			}
		])
		expect(inputs).toEqual(original)
	})

	it('preserves chart fallbacks when day or week netflow fields are absent', () => {
		const charts = Array.from({ length: 8 }, (_, index) => ({
			date: String(index),
			depositUSD: index === 7 ? 80 : 10,
			withdrawUSD: index === 7 ? 30 : undefined
		}))

		expect(
			formatChainsData({
				chains: [{ name: 'Ethereum' }],
				chartDataByChain: [charts],
				chainToChartDataIndex: { Ethereum: 0 },
				netflowsDataDay: [{ chain: 'ethereum', net_flow: '25' }],
				netflowsDataWeek: []
			})[0]
		).toMatchObject({
			prevDayUsdDeposits: 80,
			prevDayUsdWithdrawals: 30,
			prevDayNetFlow: 25,
			prevWeekUsdDeposits: 70,
			prevWeekUsdWithdrawals: 0,
			prevWeekNetFlow: 70
		})
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

	it('keeps current and previous chain volumes when a longer completed window has a gap', () => {
		const chart = Array.from({ length: 30 }, (_, index) =>
			day(new Date(Date.parse('2026-06-14T00:00:00Z') + index * 86_400_000).toISOString().slice(0, 10), index + 1)
		).filter((point) => !point.date.startsWith('2026-07-10'))
		const { bridges } = formatBridgesData({
			chain: 'Ethereum',
			bridges: [
				{
					name: 'test-bridge',
					displayName: 'Test Bridge',
					chains: ['Ethereum'],
					last24hVolume: 100,
					txsPrevDay: 10
				}
			],
			chartDataByBridge: [chart],
			bridgeNameToChartDataIndex: { 'Test Bridge': 0 },
			currentTimeMs: NOW
		})

		expect(bridges[0]).toMatchObject({
			lastDailyVolume: 30,
			dayBeforeLastVolume: 29,
			weeklyVolume: null,
			monthlyVolume: null
		})
	})
})
