import { describe, expect, test } from 'vitest'
import {
	buildRwaPlatformEntityChart,
	buildRwaPlatformEntityCsvDataset,
	getRwaPlatformChartMetricsQuery,
	parseRwaPlatformChartMetrics,
	RWA_PLATFORM_CHART_METRICS,
	type RWAPlatformChartInputs
} from '../metrics'

const DAY = 86_400_000
const T0 = 1_700_000_000_000 - (1_700_000_000_000 % DAY)
const day = (n: number) => T0 + n * DAY
const rounded = (data: Array<[number, number | null]> | undefined) =>
	data?.map(([timestamp, value]) => [timestamp, value == null ? null : Math.round(value * 100) / 100])

const inputs: RWAPlatformChartInputs = {
	activeMcap: [
		[day(0), 100],
		[day(1), 110],
		[day(2), 120]
	],
	onChainMcap: [
		[day(0), 200],
		[day(1), 200],
		[day(2), 240]
	],
	defiActiveTvl: [
		[day(0), 10],
		[day(1), null],
		[day(2), 30]
	],
	perAsset: {
		dimensions: ['timestamp', 'Total Active AUM', 'A', 'B'],
		source: [
			[day(0), 100, 100, 0],
			[day(1), 110, 80, 30],
			[day(2), 120, 60, 60]
		]
	},
	flows: [
		{ timestamp: day(0) / 1000, netFlowUsd: 5, coverage: 1 },
		{ timestamp: day(1) / 1000, netFlowUsd: null, coverage: 0 },
		{ timestamp: day(2) / 1000, netFlowUsd: -3, coverage: 1 }
	],
	milestones: [
		{ date: '2026-05', event: 'FINRA approval' },
		{ date: null, event: 'Undated' },
		{ date: 'soon', event: 'Unparseable' }
	],
	period: 'daily'
}

describe('the metrics query', () => {
	test('opens with Active AUM alone, reads a comma list, drops unknown keys and keeps the catalogue order', () => {
		expect(parseRwaPlatformChartMetrics(undefined)).toEqual(['activeMcap'])
		expect(parseRwaPlatformChartMetrics('netFlows,activeMcap,nope')).toEqual(['activeMcap', 'netFlows'])
		expect(parseRwaPlatformChartMetrics(['events', 'utilization'])).toEqual(['utilization', 'events'])
		expect(parseRwaPlatformChartMetrics('nope')).toEqual(['activeMcap'])
	})

	test('writes the selection as a comma list and leaves the default and an empty selection out of the URL', () => {
		expect(getRwaPlatformChartMetricsQuery(['activeMcap'])).toBeUndefined()
		expect(getRwaPlatformChartMetricsQuery([])).toBeUndefined()
		expect(getRwaPlatformChartMetricsQuery(['activeMcap', 'netFlows'])).toBe('activeMcap,netFlows')
	})

	test('lists twelve metrics in five groups', () => {
		expect(RWA_PLATFORM_CHART_METRICS).toHaveLength(12)
		expect([...new Set(RWA_PLATFORM_CHART_METRICS.map((metric) => metric.group))]).toEqual([
			'Core',
			'Flows',
			'Ratios',
			'Assets',
			'Annotations'
		])
	})
})

describe('buildRwaPlatformEntityChart', () => {
	test('draws the money levels as lines on the first axis with the active AUM filled', () => {
		const chart = buildRwaPlatformEntityChart(['activeMcap', 'onChainMcap', 'defiActiveTvl'], inputs)
		expect(
			chart.series.map((series) => [series.name, series.type, series.yAxisIndex, series.hideAreaStyle ?? false])
		).toEqual([
			['Active AUM', 'line', 0, false],
			['Onchain AUM', 'line', 0, true],
			['DeFi Active TVL', 'line', 0, true]
		])
		expect(chart.series[0]?.data).toEqual([
			[day(0), 100],
			[day(1), 110],
			[day(2), 120]
		])
		expect(chart.series[2]?.data).toEqual([
			[day(0), 10],
			[day(2), 30]
		])
		expect(chart.hallmarks).toEqual([])
	})

	test('draws net flows as bars on their own axis, the signed halves as green and red bars, the cumulative as a line that skips unmeasured days', () => {
		const chart = buildRwaPlatformEntityChart(['netFlows', 'inflows', 'outflows', 'cumulativeNetFlows'], inputs)
		const byName = Object.fromEntries(chart.series.map((series) => [series.name, series]))
		expect(byName['Net Flows']?.type).toBe('bar')
		expect(byName['Net Flows']?.yAxisIndex).toBe(1)
		expect(byName['Net Flows']?.data).toEqual([
			[day(0), 5],
			[day(2), -3]
		])
		expect(byName['Inflows']?.data).toEqual([[day(0), 5]])
		expect(byName['Outflows']?.data).toEqual([[day(2), -3]])
		expect(byName['Inflows']?.color).not.toBe(byName['Outflows']?.color)
		expect(byName['Cumulative Net Flows']?.type).toBe('line')
		expect(byName['Cumulative Net Flows']?.data).toEqual([
			[day(0), 5],
			[day(2), 2]
		])
	})

	test('sums the bars per period and leaves the lines daily', () => {
		const weekly = buildRwaPlatformEntityChart(['activeMcap', 'netFlows'], { ...inputs, period: 'weekly' })
		const bars = weekly.series.find((series) => series.name === 'Net Flows')
		expect(bars?.data).toHaveLength(1)
		expect(bars?.data?.[0]?.[1]).toBe(2)
		expect(weekly.series.find((series) => series.name === 'Active AUM')?.data).toHaveLength(3)
	})

	test('draws the ratios as percent lines on the percent axis, over the days both sides have a value', () => {
		const chart = buildRwaPlatformEntityChart(['utilization', 'activeShare'], inputs)
		const byName = Object.fromEntries(chart.series.map((series) => [series.name, series]))
		expect(byName['Utilization']?.valueSymbol).toBe('%')
		expect(byName['Utilization']?.yAxisIndex).toBe(2)
		expect(byName['Utilization']?.data).toEqual([
			[day(0), 10],
			[day(2), 25]
		])
		expect(rounded(byName['Active / Onchain']?.data)).toEqual([
			[day(0), 50],
			[day(1), 55],
			[day(2), 50]
		])
	})

	test('counts the live assets per day and the top asset share from the asset columns, never the Total', () => {
		const chart = buildRwaPlatformEntityChart(['liveAssets', 'topAssetShare'], inputs)
		const byName = Object.fromEntries(chart.series.map((series) => [series.name, series]))
		expect(byName['Live Assets']?.yAxisIndex).toBe(3)
		expect(byName['Live Assets']?.valueSymbol).toBe('')
		expect(byName['Live Assets']?.data).toEqual([
			[day(0), 1],
			[day(1), 2],
			[day(2), 2]
		])
		expect(rounded(byName['Top Asset Share']?.data)).toEqual([
			[day(0), 100],
			[day(1), 72.73],
			[day(2), 50]
		])
		expect(buildRwaPlatformEntityChart(['liveAssets'], { ...inputs, perAsset: null }).series).toEqual([])
	})

	test('turns the dated milestones into hallmarks and skips the rest', () => {
		const chart = buildRwaPlatformEntityChart(['activeMcap', 'events'], inputs)
		expect(chart.hallmarks).toEqual([[Date.UTC(2026, 4, 1), 'FINRA approval']])
		expect(chart.series).toHaveLength(1)
	})

	test('writes the csv as one wide table over the union of timestamps', () => {
		const chart = buildRwaPlatformEntityChart(['defiActiveTvl', 'netFlows'], inputs)
		expect(buildRwaPlatformEntityCsvDataset(chart.series)).toEqual({
			dimensions: ['timestamp', 'DeFi Active TVL', 'Net Flows'],
			source: [
				[day(0), 10, 5],
				[day(2), 30, -3]
			]
		})
	})
})
