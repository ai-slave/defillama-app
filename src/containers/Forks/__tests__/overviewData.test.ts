import { describe, expect, test } from 'vitest'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { CHART_COLORS } from '~/constants/colors'
import { buildForksOverviewDisplayData, mergeForkOverviewChartData } from '../overviewData'
import type { ForkOverviewPageData } from '../types'

const basePageData = {
	forks: ['Uniswap', 'Curve'],
	forkColors: { Uniswap: '#111111', Curve: '#222222' },
	baseTableData: [
		{ name: 'Uniswap', tvl: 80, forkedProtocols: 3, parentTvl: 1000, ftot: 8 },
		{ name: 'Curve', tvl: 120, forkedProtocols: 2, parentTvl: 400, ftot: 30 }
	],
	chartData: [
		{ timestamp: 10, Uniswap: 100, Curve: 50, EmptyFork: 0 },
		{ timestamp: 20, Uniswap: 80, Curve: 120, NewFork: 30 }
	]
} satisfies Pick<ForkOverviewPageData, 'forks' | 'forkColors'> & {
	baseTableData: ForkOverviewPageData['tableData']
	chartData: ForkOverviewPageData['chartData']
}

describe('mergeForkOverviewChartData', () => {
	test('returns base chart data without successful extra measurements', () => {
		expect(
			mergeForkOverviewChartData({
				chartData: basePageData.chartData,
				extraBreakdownByTimestamp: new Map()
			})
		).toBe(basePageData.chartData)
	})

	test('merges extra values by timestamp and keeps extra-only timestamps sorted', () => {
		const merged = mergeForkOverviewChartData({
			chartData: basePageData.chartData,
			extraBreakdownByTimestamp: new Map([
				[20, { Uniswap: 5, Curve: 10 }],
				[15, { ExtraOnly: 7 }]
			])
		})

		expect(merged).toEqual([
			{ timestamp: 10, Uniswap: 100, Curve: 50, EmptyFork: 0 },
			{ timestamp: 15, ExtraOnly: 7 },
			{ timestamp: 20, Uniswap: 85, Curve: 130, NewFork: 30 }
		])
		expect(basePageData.chartData.at(1)?.Uniswap).toBe(80)
	})
})

describe('buildForksOverviewDisplayData', () => {
	test('builds table, pie, colors, and dominance data from latest chart values', () => {
		const display = buildForksOverviewDisplayData(basePageData)

		expect(display.tableData).toEqual([
			{ name: 'Curve', forkedProtocols: 2, parentTvl: 400, tvl: 120, ftot: 30 },
			{
				name: 'Uniswap',
				forkedProtocols: 3,
				parentTvl: 1000,
				tvl: 80,
				ftot: 8
			},
			{
				name: 'NewFork',
				forkedProtocols: 0,
				parentTvl: null,
				tvl: 30,
				ftot: null
			},
			{
				name: 'EmptyFork',
				forkedProtocols: 0,
				parentTvl: null,
				tvl: 0,
				ftot: null
			}
		])

		expect(buildRuntimePieChartPresentation({ series: display.pieSeries }).chartData).toEqual([
			{ name: 'Curve', value: 120 },
			{ name: 'Uniswap', value: 80 },
			{ name: 'NewFork', value: 30 }
		])

		expect(display.chartColors).toMatchObject({
			Uniswap: '#111111',
			Curve: '#222222',
			NewFork: CHART_COLORS[2],
			EmptyFork: CHART_COLORS[3]
		})

		expect(display.dominanceDataset.dimensions).toEqual(['timestamp', 'Curve', 'Uniswap', 'NewFork', 'EmptyFork'])
		expect(display.dominanceDataset.source[0]).toEqual([10_000, 50, 100, undefined, 0])
		expect(display.dominanceDataset.source[1]).toEqual([20_000, 120, 80, 30, 0])
		expect(display.dominanceCharts.map((chart) => chart.name)).toEqual(['Curve', 'Uniswap', 'NewFork', 'EmptyFork'])
	})

	test('uses zero for explicit and omitted values in the successful latest snapshot', () => {
		const display = buildForksOverviewDisplayData({
			...basePageData,
			chartData: [{ timestamp: 10, Uniswap: 100, ZeroFork: 0 }]
		})

		expect(display.tableData).toEqual([
			{
				name: 'Uniswap',
				forkedProtocols: 3,
				parentTvl: 1000,
				tvl: 100,
				ftot: 10
			},
			{
				name: 'Curve',
				forkedProtocols: 2,
				parentTvl: 400,
				tvl: 0,
				ftot: 0
			},
			{
				name: 'ZeroFork',
				forkedProtocols: 0,
				parentTvl: null,
				tvl: 0,
				ftot: null
			}
		])
		expect(buildRuntimePieChartPresentation({ series: display.pieSeries }).chartData).toEqual([
			{ name: 'Uniswap', value: 100 }
		])
		expect(display.dominanceDataset.source).toEqual([[10_000, 100, 0, 0]])
	})

	test('uses zero current TVL when the successful chart is empty', () => {
		const display = buildForksOverviewDisplayData({
			...basePageData,
			chartData: []
		})

		expect(display.tableData).toEqual([
			{
				name: 'Uniswap',
				forkedProtocols: 3,
				parentTvl: 1000,
				tvl: 0,
				ftot: 0
			},
			{
				name: 'Curve',
				forkedProtocols: 2,
				parentTvl: 400,
				tvl: 0,
				ftot: 0
			}
		])
		expect(buildRuntimePieChartPresentation({ series: display.pieSeries }).chartData).toEqual([])
		expect(display.dominanceDataset).toEqual({
			source: [],
			dimensions: ['timestamp', 'Uniswap', 'Curve']
		})
	})
})
