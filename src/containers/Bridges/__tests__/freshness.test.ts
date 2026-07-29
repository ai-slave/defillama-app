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

	it('counts an omitted producer day as zero activity in a rolling total', () => {
		const chart = [day('2026-07-11', 5), day('2026-07-13', 20), day('2026-07-14', 1)]
		expect(getCompletedBridgeVolumeTotal(chart, 3, false, NOW)).toBe(25)
	})

	it('treats omitted recent rows in a successful sparse response as zero activity', () => {
		const chart = [day('2026-06-10', 5), day('2026-06-11', 20)]

		expect(getCompletedBridgeVolumePair(chart, NOW)).toEqual({ current: 0, previous: 0 })
		expect(getCompletedBridgeVolumeTotals(chart, [1, 7, 30], false, NOW)).toEqual(
			new Map([
				[1, 0],
				[7, 0],
				[30, 0]
			])
		)
	})

	it('distinguishes a successful empty response from an unavailable response', () => {
		expect(getCompletedBridgeVolumeTotals([], [7], false, NOW)).toEqual(new Map([[7, 0]]))
		expect(getCompletedBridgeVolumeTotals(null, [7], false, NOW)).toEqual(new Map([[7, null]]))
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

	it('keeps exact completed windows when a zero-activity day is omitted', () => {
		const chart = Array.from({ length: 7 }, (_, index) => ({
			date: new Date(Date.parse('2026-07-07T00:00:00Z') + index * 86_400_000).toISOString(),
			Deposits: 10,
			Withdrawals: -2
		})).filter((point) => !point.date.startsWith('2026-07-10'))

		expect(getCompletedBridgeVolumeTotals(chart, [1, 7, 30], true, NOW)).toEqual(
			new Map([
				[1, 12],
				[7, 72],
				[30, 72]
			])
		)
	})

	it('keeps explicit null volume legs unknown', () => {
		const chart = [
			{ date: '2026-07-12T00:00:00Z', Deposits: 5, Withdrawals: -2 },
			{ date: '2026-07-13T00:00:00Z', Deposits: null, Withdrawals: -3 }
		]
		expect(getCompletedBridgeVolumeTotal(chart, 2, true, NOW)).toBeNull()
	})

	it('does not present a completed daily chart point as rolling 24h data', () => {
		const rows = formatChainsData({
			chains: [{ name: 'Test Chain' }],
			chartDataByChain: [[{ date: '1', depositUSD: 10, withdrawUSD: null }]],
			chainToChartDataIndex: { 'Test Chain': 0 }
		})

		expect(rows).toEqual([
			{
				name: 'Test Chain',
				prevDayUsdDeposits: null,
				prevDayUsdWithdrawals: null,
				prevWeekUsdDeposits: 0,
				prevWeekUsdWithdrawals: 0,
				topTokenDepositedSymbol: null,
				topTokenDepositedUsd: null,
				topTokenWithdrawnSymbol: null,
				topTokenWithdrawnUsd: null,
				prevDayNetFlow: null,
				prevWeekNetFlow: 0
			}
		])
	})

	it('indexes chain stats with the existing exact and case-insensitive matching rules', () => {
		const charts = Array.from({ length: 8 }, (_, index) => ({
			date: String((NOW - (8 - index) * 86_400_000) / 1e3),
			depositUSD: index + 1,
			withdrawUSD: index
		}))
		const prevDay = (name: string, symbol: string, usdValue: number) => ({
			name,
			date: 1,
			totalDepositedUSD: 0,
			totalWithdrawnUSD: 0,
			totalDepositTxs: 0,
			totalWithdrawalTxs: 0,
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
				{ chain: 'eThErEuM', depositedUsd: 100, withdrawnUsd: 40, netFlow: 60 },
				{ chain: 'ethereum', depositedUsd: 999, withdrawnUsd: 999, netFlow: 0 }
			],
			netflowsDataWeek: [{ chain: 'ETHEREUM', depositedUsd: 700, withdrawnUsd: 350, netFlow: 350 }],
			currentTimeMs: NOW
		}
		const original = structuredClone(inputs)

		expect(formatChainsData(inputs)).toEqual([
			{
				name: 'Ethereum',
				prevDayUsdDeposits: 100,
				prevDayUsdWithdrawals: 40,
				prevWeekUsdDeposits: 700,
				prevWeekUsdWithdrawals: 350,
				topTokenDepositedSymbol: 'FIRST',
				topTokenDepositedUsd: 10,
				topTokenWithdrawnSymbol: null,
				topTokenWithdrawnUsd: 0,
				prevDayNetFlow: 60,
				prevWeekNetFlow: 350
			},
			{
				name: 'ethereum',
				prevDayUsdDeposits: 100,
				prevDayUsdWithdrawals: 40,
				prevWeekUsdDeposits: 700,
				prevWeekUsdWithdrawals: 350,
				topTokenDepositedSymbol: null,
				topTokenDepositedUsd: null,
				topTokenWithdrawnSymbol: null,
				topTokenWithdrawnUsd: null,
				prevDayNetFlow: 60,
				prevWeekNetFlow: 350
			}
		])
		expect(inputs).toEqual(original)
	})

	it('uses only seven exact completed UTC days for a missing weekly netflow response', () => {
		const charts = [
			{ date: String(Date.parse('2026-07-13T18:00:00Z') / 1e3), depositUSD: 80, withdrawUSD: 30 },
			...Array.from({ length: 6 }, (_, index) => ({
				date: String(Date.parse('2026-07-07T00:00:00Z') / 1e3 + index * 86_400),
				depositUSD: 10,
				withdrawUSD: 2
			})),
			{ date: String(Date.parse('2026-07-14T00:00:00Z') / 1e3), depositUSD: 999, withdrawUSD: 999 },
			{ date: String(Date.parse('2026-07-13T00:00:00Z') / 1e3), depositUSD: 1, withdrawUSD: 1 }
		]

		expect(
			formatChainsData({
				chains: [{ name: 'Ethereum' }],
				chartDataByChain: [charts],
				chainToChartDataIndex: { Ethereum: 0 },
				netflowsDataWeek: [],
				currentTimeMs: NOW
			})[0]
		).toMatchObject({
			prevDayUsdDeposits: null,
			prevDayUsdWithdrawals: null,
			prevDayNetFlow: null,
			prevWeekUsdDeposits: 140,
			prevWeekUsdWithdrawals: 42,
			prevWeekNetFlow: 98
		})
	})

	it('treats an omitted completed UTC day as zero activity in the weekly fallback', () => {
		const charts = Array.from({ length: 7 }, (_, index) => ({
			date: String(Date.parse('2026-07-07T00:00:00Z') / 1e3 + index * 86_400),
			depositUSD: 10,
			withdrawUSD: 2
		})).filter((point) => point.date !== String(Date.parse('2026-07-10T00:00:00Z') / 1e3))

		expect(
			formatChainsData({
				chains: [{ name: 'Ethereum' }],
				chartDataByChain: [charts],
				chainToChartDataIndex: { Ethereum: 0 },
				currentTimeMs: NOW
			})[0]
		).toMatchObject({
			prevWeekUsdDeposits: 60,
			prevWeekUsdWithdrawals: 12,
			prevWeekNetFlow: 48
		})
	})

	it('uses exact completed-day volumes on the global bridge overview', () => {
		const chart = [day('2026-07-12', 20), day('2026-07-13', 30), day('2026-07-14', 1_000)]
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
			lastDailyVolume: 30,
			dayBeforeLastVolume: 20,
			weeklyVolume: 50,
			monthlyVolume: 50,
			change_1d: 50
		})
	})

	it('derives fallback transactions from the latest completed UTC day', () => {
		const { bridges } = formatBridgesData({
			bridges: [{ name: 'test-bridge', displayName: 'Test Bridge', chains: ['Ethereum'] }],
			chartDataByBridge: [
				[
					{ date: '2026-07-13T01:00:00Z', txs: 20 },
					{ date: '2026-07-14T00:00:00Z', txs: 999 },
					{ date: '2026-07-13T23:00:00Z', txs: 30 }
				]
			],
			bridgeNameToChartDataIndex: { 'Test Bridge': 0 },
			currentTimeMs: NOW
		})

		expect(bridges[0]?.txsPrevDay).toBe(30)
	})

	it('distinguishes a sparse zero-transaction day from an unavailable chart', () => {
		const bridge = { name: 'test-bridge', displayName: 'Test Bridge', chains: ['Ethereum'] }
		const successful = formatBridgesData({
			bridges: [bridge],
			chartDataByBridge: [[{ date: '2026-07-12T00:00:00Z', txs: 10 }]],
			bridgeNameToChartDataIndex: { 'Test Bridge': 0 },
			currentTimeMs: NOW
		})
		const unavailable = formatBridgesData({
			bridges: [bridge],
			chartDataByBridge: [null],
			bridgeNameToChartDataIndex: { 'Test Bridge': 0 },
			currentTimeMs: NOW
		})

		expect(successful.bridges[0]?.txsPrevDay).toBe(0)
		expect(unavailable.bridges[0]?.txsPrevDay).toBeNull()
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

	it('keeps exact sparse totals when a longer completed window omits a zero-activity day', () => {
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
			weeklyVolume: 162,
			monthlyVolume: 438
		})
	})
})
