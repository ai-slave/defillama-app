import { describe, expect, it } from 'vitest'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import {
	buildBridgeOverviewActiveChart,
	getBridgeOverviewSummaryTotals,
	type BridgeOverviewChartType
} from '../bridgeOverviewChartData'
import { formatBridgeOverviewVolumeData } from '../bridgeOverviewVolumeData'

const chainVolumeData = [
	{ date: 1, Deposits: 10, Withdrawals: -4 },
	{ date: 2, Deposits: 0, Withdrawals: 0 }
]

describe('buildBridgeOverviewActiveChart', () => {
	it('builds net flow from the production raw bridge-volume contract', () => {
		const formatted = formatBridgeOverviewVolumeData([
			{ date: '1', depositUSD: 10, withdrawUSD: 4, depositTxs: 2, withdrawTxs: 1 },
			{ date: '2', depositUSD: 5, depositTxs: 1 }
		])

		expect(
			buildBridgeOverviewActiveChart({ selectedChain: 'Ethereum', chartType: 'Net Flow', chainVolumeData: formatted })
		).toEqual({
			kind: 'Net Flow',
			dataset: {
				dimensions: ['timestamp', 'Net Flow'],
				source: [
					[1_000, 6],
					[2_000, 5]
				]
			}
		})
	})

	it('preserves filtered row totals on the all-chains overview', () => {
		expect(
			getBridgeOverviewSummaryTotals({
				selectedChain: 'All',
				bridges: [{ lastDailyVolume: 3, weeklyVolume: 12, monthlyVolume: 40 }],
				chainVolumeData: []
			})
		).toEqual({ dayTotalVolume: 3, weekTotalVolume: 12, monthTotalVolume: 40 })
	})

	it('uses normalized chain-wide aggregate totals on a chain overview', () => {
		const currentTimeMs = Date.parse('2026-07-14T12:00:00Z')
		const aggregate = [
			...Array.from({ length: 30 }, (_, index) => ({
				date: new Date(Date.parse('2026-06-14T00:00:00Z') + index * 86_400_000).toISOString(),
				Deposits: 10,
				Withdrawals: -2
			}))
		]

		expect(
			getBridgeOverviewSummaryTotals({
				selectedChain: 'Ethereum',
				bridges: [
					{ lastDailyVolume: 3, weeklyVolume: 12, monthlyVolume: 40 },
					{ lastDailyVolume: 2, weeklyVolume: null, monthlyVolume: null }
				],
				chainVolumeData: aggregate,
				currentTimeMs
			})
		).toEqual({ dayTotalVolume: 6, weekTotalVolume: 42, monthTotalVolume: 180 })
	})

	it('skips derived construction for overview and raw volume views', () => {
		for (const [selectedChain, chartType] of [
			['All', 'Net Flow'],
			['Ethereum', 'Bridge Volume']
		] as Array<[string, BridgeOverviewChartType]>) {
			expect(buildBridgeOverviewActiveChart({ selectedChain, chartType, chainVolumeData })).toBeNull()
		}
	})

	it('builds the selected time-series view with unchanged values', () => {
		expect(
			buildBridgeOverviewActiveChart({ selectedChain: 'Ethereum', chartType: 'Net Flow', chainVolumeData })
		).toEqual({
			kind: 'Net Flow',
			dataset: {
				dimensions: ['timestamp', 'Net Flow'],
				source: [
					[1_000, 6],
					[2_000, 0]
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
					[1_000, (10 / 14) * 100, (4 / 14) * 100],
					[2_000, 0, 0]
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
					[1_000, 10, -4],
					[2_000, 0, 0]
				]
			}
		})
	})

	it('groups and limits only the selected token direction', () => {
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
		expect(result.series.peers).toHaveLength(11)
		const chartData = buildRuntimePieChartPresentation({ series: result.series }).chartData
		expect(chartData[0]).toEqual({ name: 'USDC', value: 23 })
		expect(chartData.at(-1)).toEqual({ name: 'Others', value: 1 })
	})

	it('builds the selected token direction when the opposite direction is unavailable', () => {
		const result = buildBridgeOverviewActiveChart({
			selectedChain: 'Ethereum',
			chartType: '24h Tokens Deposited',
			chainVolumeData,
			bridgeStatsCurrentDay: {
				totalTokensDeposited: { deposit: { symbol: 'USDC', usdValue: 10 } }
			}
		})
		expect(result?.kind).toBe('24h Tokens Deposited')
		if (result?.kind !== '24h Tokens Deposited') return
		expect(buildRuntimePieChartPresentation({ series: result.series }).chartData).toEqual([{ name: 'USDC', value: 10 }])
	})

	it('keeps a source Others slice at the end', () => {
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

	it('preserves integer-like symbol ordering when values tie', () => {
		const result = buildBridgeOverviewActiveChart({
			selectedChain: 'Ethereum',
			chartType: '24h Tokens Deposited',
			chainVolumeData,
			bridgeStatsCurrentDay: {
				totalTokensDeposited: {
					first: { symbol: '10', usdValue: 5 },
					second: { symbol: '2', usdValue: 5 }
				},
				totalTokensWithdrawn: {}
			}
		})

		expect(result?.kind).toBe('24h Tokens Deposited')
		if (result?.kind !== '24h Tokens Deposited') return
		expect(buildRuntimePieChartPresentation({ series: result.series }).chartData).toEqual([
			{ name: '2', value: 5 },
			{ name: '10', value: 5 }
		])
	})
})
