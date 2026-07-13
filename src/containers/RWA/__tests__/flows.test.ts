import { describe, expect, it } from 'vitest'
import type { IRWAAssetsOverview, IRWAFlowAggregatePoint, IRWAFlowOverviewSplitPoint } from '../api.types'
import {
	aggregateRWAFlowRows,
	buildRWAFilteredFlowBreakdown,
	buildRWAFlowChart,
	buildRWAFlowRotationChart,
	formatSignedRWAFlow,
	getRWAFlowChartOptions,
	getRWAFlowDefaultStartTimestamp,
	getRWAFlowVsPriceSummary,
	parseRWAFlowMode
} from '../flows'

const day = (year: number, month: number, date: number) => Date.UTC(year, month, date)
const aggregatePoint = (timestamp: number, netFlowUsd: number | null, coverage = 1): IRWAFlowAggregatePoint => ({
	timestamp,
	netFlowUsd,
	coverage
})

describe('RWA flow chart data', () => {
	it('keeps unknown flow distinct from a measured zero', () => {
		expect(formatSignedRWAFlow(null)).toBe('-')
		expect(formatSignedRWAFlow(0)).toBe('$0')
	})

	it('parses only flow modes supported by the current chart', () => {
		expect(parseRWAFlowMode('cumulative', false)).toBe('cumulative')
		expect(parseRWAFlowMode('flowVsPrice', true)).toBe('flowVsPrice')
		expect(parseRWAFlowMode('flowVsPrice', false)).toBe('daily')
		expect(parseRWAFlowMode('unknown', true)).toBe('daily')
	})

	it('sorts daily flows, normalizes timestamps, and keeps inflows separate from outflows', () => {
		const jan1 = day(2026, 0, 1)
		const jan2 = day(2026, 0, 2)
		const mcapByTimestamp = new Map([
			[jan1, 100],
			[jan2, 90]
		])

		const chart = buildRWAFlowChart({
			points: [aggregatePoint(jan2 / 1e3, -4), aggregatePoint(jan1 / 1e3, 6)],
			mode: 'daily',
			mcapByTimestamp
		})

		expect(chart.dataset.source).toEqual([
			{ timestamp: jan1, Inflows: 6, Outflows: null, 'Onchain Mcap': 100 },
			{ timestamp: jan2, Inflows: null, Outflows: -4, 'Onchain Mcap': 90 }
		])
	})

	it('uses independent flow and marketcap axes', () => {
		const chartOptions = getRWAFlowChartOptions({ showMcapOverlay: true })
		if (!Array.isArray(chartOptions.yAxis)) throw new Error('Expected separate flow and marketcap axes')
		expect(chartOptions.yAxis).toHaveLength(2)
		expect(chartOptions.yAxis[1]).toMatchObject({ min: 0 })
	})

	it('defaults an overview flow chart to the trailing requested number of days', () => {
		const latest = day(2026, 6, 1)
		const points = [aggregatePoint(day(2025, 0, 1), 1), aggregatePoint(latest, 2)]
		expect(getRWAFlowDefaultStartTimestamp(points, 365)).toBe(latest - 365 * 86_400_000)
		expect(getRWAFlowDefaultStartTimestamp(points, undefined)).toBeUndefined()
	})

	it('carries the cumulative total across days with missing flow coverage', () => {
		const jan1 = day(2026, 0, 1)
		const jan2 = day(2026, 0, 2)
		const jan3 = day(2026, 0, 3)
		const chart = buildRWAFlowChart({
			points: [aggregatePoint(jan3, -3), aggregatePoint(jan1, 10), aggregatePoint(jan2, null)],
			mode: 'cumulative',
			showMcapOverlay: false
		})

		expect(chart.dataset.source).toEqual([
			{ timestamp: jan1, 'Cumulative Net Flows': 10 },
			{ timestamp: jan2, 'Cumulative Net Flows': 10 },
			{ timestamp: jan3, 'Cumulative Net Flows': 7 }
		])
	})

	it('decomposes monthly market-cap change into net capital and price effects', () => {
		const points = [
			aggregatePoint(day(2026, 0, 10), 10),
			aggregatePoint(day(2026, 0, 31), 5),
			aggregatePoint(day(2026, 1, 28), 20)
		]
		const mcapByTimestamp = new Map([
			[day(2026, 0, 10), 100],
			[day(2026, 0, 31), 110],
			[day(2026, 1, 28), 160]
		])

		expect(getRWAFlowVsPriceSummary(points, mcapByTimestamp)).toEqual({
			mcapChange: 50,
			netCapital: 20,
			price: 30,
			flowDrivenPct: 40
		})
	})

	it('sums rotation series by month without treating an absent series as zero', () => {
		const points: IRWAFlowOverviewSplitPoint[] = [
			{ timestamp: day(2026, 0, 5) / 1e3, Bonds: 10, Credit: -5 },
			{ timestamp: day(2026, 0, 20) / 1e3, Bonds: -3, Credit: 2 },
			{ timestamp: day(2026, 1, 5) / 1e3, Bonds: 4 }
		]

		const chart = buildRWAFlowRotationChart(points, 'monthly')

		expect(chart.dataset).toEqual({
			dimensions: ['timestamp', 'Bonds', 'Credit'],
			source: [
				{ timestamp: day(2026, 0, 1), Bonds: 7, Credit: -3 },
				{ timestamp: day(2026, 1, 1), Bonds: 4, Credit: null }
			]
		})
	})

	it('orders rotation series by recent absolute net flow independently of chart frequency', () => {
		const latest = day(2026, 2, 31)
		const points: IRWAFlowOverviewSplitPoint[] = [
			{ timestamp: latest / 1e3, 'Recent Inflow': 80, 'Recent Outflow': -100 },
			{ timestamp: (latest - 10 * 86_400_000) / 1e3, 'Older Big': 1_000, 'Older Small': -50 },
			{ timestamp: (latest - 40 * 86_400_000) / 1e3, 'No Recent Flow': 10_000 }
		]

		const weekly = buildRWAFlowRotationChart(points, 'weekly')
		const monthly = buildRWAFlowRotationChart(points, 'monthly')
		const expectedOrder = ['timestamp', 'Recent Outflow', 'Recent Inflow', 'Older Big', 'Older Small', 'No Recent Flow']

		expect(weekly.dataset.dimensions).toEqual(expectedOrder)
		expect(monthly.dataset.dimensions).toEqual(expectedOrder)
		expect(weekly.charts.map((chart) => chart.name)).toEqual(expectedOrder.slice(1))
		expect(monthly.charts.map((chart) => chart.name)).toEqual(expectedOrder.slice(1))
	})

	it('aggregates only the assets left by the page filters and preserves missing days', () => {
		const assets = [
			{ kind: 'spot', canonicalMarketId: 'bond-a' },
			{ kind: 'spot', canonicalMarketId: 'bond-b' }
		] as IRWAAssetsOverview['assets']

		expect(
			aggregateRWAFlowRows(
				[
					{ timestamp: 1, 'bond-a': 10, 'bond-b': -4, excluded: 100 },
					{ timestamp: 2, excluded: 20 }
				],
				assets
			)
		).toEqual([
			{ timestamp: 1, netFlowUsd: 6, coverage: 1 },
			{ timestamp: 2, netFlowUsd: null, coverage: 0 }
		])
	})

	it('builds filtered platform and chain rotation without double-counting multi-platform assets', () => {
		const assets = [
			{
				kind: 'spot',
				canonicalMarketId: 'bond-a',
				parentPlatform: ['Platform A', 'Platform B'],
				chain: ['Ethereum', 'Solana']
			},
			{ kind: 'spot', canonicalMarketId: 'no-platform' }
		] as IRWAAssetsOverview['assets']
		const rows = [
			{
				timestamp: 1,
				'bond-a': 10,
				'chain:bond-a:Ethereum': 7,
				'chain:bond-a:Solana': 3,
				'no-platform': 8,
				excluded: 100
			}
		]

		expect(buildRWAFilteredFlowBreakdown(rows, assets, 'platform')).toEqual([
			{ timestamp: 1, 'Platform A': 5, 'Platform B': 5 }
		])
		expect(buildRWAFilteredFlowBreakdown(rows, assets, 'chain')).toEqual([{ timestamp: 1, Ethereum: 7, Solana: 3 }])
	})
})
