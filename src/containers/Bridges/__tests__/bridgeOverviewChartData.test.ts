import { describe, expect, test } from 'vitest'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import {
	buildBridgeOverviewActiveChart,
	getBridgeOverviewSummaryTotals,
	type BridgeOverviewChartType
} from '../bridgeOverviewChartData'
import { formatBridgeOverviewVolumeData, normalizeBridgeVolumeResponse } from '../bridgeOverviewVolumeData'

const chainVolumeData = [
	{ date: 1, Deposits: 10, Withdrawals: -4 },
	{ date: 2, Deposits: 0, Withdrawals: 0 }
]

describe('buildBridgeOverviewActiveChart', () => {
	test('builds net flow from the production raw bridge-volume contract', () => {
		const formatted = formatBridgeOverviewVolumeData(
			normalizeBridgeVolumeResponse([
				{ date: '1', depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 },
				{ date: '2', depositUSD: 5, withdrawUSD: null, depositTxs: 1, withdrawTxs: 0 }
			])
		)
		expect(formatted).toEqual([
			{ date: 1, Deposits: 10, Withdrawals: -4 },
			{ date: 2, Deposits: 5, Withdrawals: null }
		])

		expect(
			buildBridgeOverviewActiveChart({ selectedChain: 'Ethereum', chartType: 'Net Flow', chainVolumeData: formatted })
		).toEqual({
			kind: 'Net Flow',
			dataset: {
				dimensions: ['timestamp', 'Net Flow'],
				source: [
					[1000, 6],
					[2000, null]
				]
			}
		})
	})

	test('sums the completed bridge rows for global summary totals', () => {
		const nowSec = Date.parse('2026-07-14T12:00:00Z') / 1e3
		const aggregate = Array.from({ length: 30 }, (_, index) => ({
			date: (Date.parse('2026-06-14T00:00:00Z') + index * 86_400_000) / 1e3,
			volume: index + 1,
			Deposits: null,
			Withdrawals: null
		}))
		expect(
			getBridgeOverviewSummaryTotals({
				selectedChain: 'All',
				bridges: [
					{ lastDailyVolume: 3, weeklyVolume: 30, monthlyVolume: 300 },
					{ lastDailyVolume: 2, weeklyVolume: 20, monthlyVolume: 200 }
				],
				chainVolumeData: aggregate,
				nowSec
			})
		).toEqual({ dayTotalVolume: 5, weekTotalVolume: 50, monthTotalVolume: 500 })
	})

	test('keeps active bridge totals when another successful bridge has no completed activity', () => {
		expect(
			getBridgeOverviewSummaryTotals({
				selectedChain: 'All',
				bridges: [
					{ lastDailyVolume: 5, weeklyVolume: 20, monthlyVolume: 80 },
					{ lastDailyVolume: 0, weeklyVolume: 0, monthlyVolume: 0 }
				],
				chainVolumeData: [],
				nowSec: Date.parse('2026-07-14T12:00:00Z') / 1e3
			})
		).toEqual({ dayTotalVolume: 5, weekTotalVolume: 20, monthTotalVolume: 80 })
	})

	test('uses normalized chain-wide aggregate totals on a chain overview', () => {
		const nowSec = Date.parse('2026-07-14T12:00:00Z') / 1e3
		const aggregate = Array.from({ length: 30 }, (_, index) => ({
			date: (Date.parse('2026-06-14T00:00:00Z') + index * 86_400_000) / 1e3,
			Deposits: 10,
			Withdrawals: -2
		}))

		expect(
			getBridgeOverviewSummaryTotals({
				selectedChain: 'Ethereum',
				bridges: [{ lastDailyVolume: 3 }, { lastDailyVolume: 2 }],
				chainVolumeData: aggregate,
				nowSec
			})
		).toEqual({ dayTotalVolume: 6, weekTotalVolume: 42, monthTotalVolume: 180 })
	})

	test('moves the chain overview day total to the next completed day at UTC midnight', () => {
		const volumes = [
			{ date: Date.parse('2026-07-13T00:00:00Z') / 1e3, Deposits: 10, Withdrawals: -2 },
			{ date: Date.parse('2026-07-14T00:00:00Z') / 1e3, Deposits: 40, Withdrawals: -20 }
		]
		const dayTotalAt = (iso: string) =>
			getBridgeOverviewSummaryTotals({
				selectedChain: 'Ethereum',
				bridges: [],
				chainVolumeData: volumes,
				nowSec: Date.parse(iso) / 1e3
			}).dayTotalVolume

		expect(dayTotalAt('2026-07-14T23:59:59Z')).toBe(6)
		expect(dayTotalAt('2026-07-15T00:00:00Z')).toBe(30)
	})

	test('skips derived construction for overview and raw volume views', () => {
		for (const [selectedChain, chartType] of [
			['All', 'Net Flow'],
			['Ethereum', 'Bridge Volume']
		] as Array<[string, BridgeOverviewChartType]>) {
			expect(buildBridgeOverviewActiveChart({ selectedChain, chartType, chainVolumeData })).toBeNull()
		}
	})

	test('builds the selected time-series view with unchanged values', () => {
		expect(
			buildBridgeOverviewActiveChart({ selectedChain: 'Ethereum', chartType: 'Net Flow', chainVolumeData })
		).toEqual({
			kind: 'Net Flow',
			dataset: {
				dimensions: ['timestamp', 'Net Flow'],
				source: [
					[1000, 6],
					[2000, 0]
				]
			}
		})

		expect(
			buildBridgeOverviewActiveChart({ selectedChain: 'Ethereum', chartType: 'Net Flow (%)', chainVolumeData })
		).toEqual({
			kind: 'Net Flow (%)',
			dataset: {
				dimensions: ['timestamp', 'Inflows', 'Outflows'],
				source: [
					[1000, (10 / 14) * 100, (4 / 14) * 100],
					[2000, null, null]
				]
			}
		})

		expect(
			buildBridgeOverviewActiveChart({ selectedChain: 'Ethereum', chartType: 'Inflows', chainVolumeData })
		).toEqual({
			kind: 'Inflows',
			dataset: {
				dimensions: ['timestamp', 'Deposits', 'Withdrawals'],
				source: [
					[1000, 10, -4],
					[2000, 0, 0]
				]
			}
		})
	})

	test('distinguishes unavailable token stats from a known-empty token map', () => {
		expect(
			buildBridgeOverviewActiveChart({
				selectedChain: 'Ethereum',
				chartType: '24h Tokens Deposited',
				chainVolumeData
			})
		).toBeNull()

		const knownEmpty = buildBridgeOverviewActiveChart({
			selectedChain: 'Ethereum',
			chartType: '24h Tokens Deposited',
			chainVolumeData,
			bridgeStatsCurrentDay: { totalTokensDeposited: {}, totalTokensWithdrawn: {} }
		})
		expect(knownEmpty?.kind).toBe('24h Tokens Deposited')
		if (knownEmpty?.kind !== '24h Tokens Deposited') return
		expect(knownEmpty.series.peers).toEqual([])
	})

	test('preserves exact token identities and limits only the selected token direction', () => {
		const totalTokensDeposited = Object.fromEntries(
			Array.from({ length: 12 }, (_, index) => [
				`deposit-${index}`,
				{ symbol: index < 2 ? 'USDC' : `D${index}`, usdValue: 12 - index }
			])
		)
		const result = buildBridgeOverviewActiveChart({
			selectedChain: 'Ethereum',
			chartType: '24h Tokens Deposited',
			chainVolumeData,
			bridgeStatsCurrentDay: {
				totalTokensDeposited,
				totalTokensWithdrawn: { withdrawal: { symbol: 'ETH', usdValue: 100 } }
			}
		})

		expect(result?.kind).toBe('24h Tokens Deposited')
		if (result?.kind !== '24h Tokens Deposited') return
		expect(result.series.peers).toHaveLength(12)
		const chartData = buildRuntimePieChartPresentation({ series: result.series }).chartData
		expect(chartData.slice(0, 2)).toEqual([
			{ name: 'USDC · deposit-0', value: 12 },
			{ name: 'USDC · deposit-1', value: 11 }
		])
		expect(chartData.at(-1)).toEqual({ name: 'Others', value: 3 })
	})

	test('builds the selected token direction when the opposite direction is known empty', () => {
		const result = buildBridgeOverviewActiveChart({
			selectedChain: 'Ethereum',
			chartType: '24h Tokens Deposited',
			chainVolumeData,
			bridgeStatsCurrentDay: {
				totalTokensDeposited: { deposit: { symbol: 'USDC', usdValue: 10 } },
				totalTokensWithdrawn: {}
			}
		})
		expect(result?.kind).toBe('24h Tokens Deposited')
		if (result?.kind !== '24h Tokens Deposited') return
		expect(buildRuntimePieChartPresentation({ series: result.series }).chartData).toEqual([{ name: 'USDC', value: 10 }])
	})

	test('does not render a partial token pie when any USD value is unknown', () => {
		expect(
			buildBridgeOverviewActiveChart({
				selectedChain: 'Ethereum',
				chartType: '24h Tokens Deposited',
				chainVolumeData,
				bridgeStatsCurrentDay: {
					totalTokensDeposited: {
						known: { symbol: 'USDC', usdValue: 10 },
						unknown: { symbol: 'ETH', usdValue: null }
					},
					totalTokensWithdrawn: {}
				}
			})
		).toBeNull()
	})

	test('keeps a source Others slice at the end', () => {
		const result = buildBridgeOverviewActiveChart({
			selectedChain: 'Ethereum',
			chartType: '24h Tokens Deposited',
			chainVolumeData,
			bridgeStatsCurrentDay: {
				totalTokensDeposited: {
					other: { symbol: 'Others', usdValue: 20 },
					usdc: { symbol: 'USDC', usdValue: 10 }
				},
				totalTokensWithdrawn: {}
			}
		})
		expect(result?.kind).toBe('24h Tokens Deposited')
		if (result?.kind !== '24h Tokens Deposited') return
		expect(buildRuntimePieChartPresentation({ series: result.series }).chartData).toEqual([
			{ name: 'USDC', value: 10 },
			{ name: 'Others', value: 20 }
		])
	})
})
