import { describe, expect, test } from 'vitest'
import { CHART_COLORS, CHART_SERIES_LIMIT } from '~/constants/colors'
import type { RWAPositionalChartDataset } from '../chartDataset'
import {
	buildRwaPerpsChartSeries,
	buildRwaPerpsTimeSeriesChart,
	buildRwaShareChart,
	buildRwaTimeSeriesCharts
} from '../chartSeries'

describe('buildRwaTimeSeriesCharts', () => {
	test('draws the Total line first without a fill or a tooltip sum, then the groups from the third color', () => {
		expect(buildRwaTimeSeriesCharts({ dimensions: ['timestamp', 'Bonds', 'Total Onchain AUM'], source: [] })).toEqual([
			{
				name: 'Total Onchain AUM',
				type: 'line',
				encode: { x: 'timestamp', y: 'Total Onchain AUM' },
				color: CHART_COLORS[0],
				hideAreaStyle: true,
				excludeFromTooltipTotal: true
			},
			{
				name: 'Bonds',
				type: 'line',
				encode: { x: 'timestamp', y: 'Bonds' },
				color: CHART_COLORS[2]
			}
		])
	})
})

describe('buildRwaPerpsChartSeries', () => {
	test('draws volume as stacked bars per group with no Total series', () => {
		expect(
			buildRwaPerpsChartSeries({ dimensions: ['timestamp', 'Hyperliquid', 'Others'], source: [[1, 2, 1]] })
		).toEqual([
			{
				name: 'Hyperliquid',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'Hyperliquid' },
				color: CHART_COLORS[0]
			},
			{
				name: 'Others',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'Others' },
				color: CHART_COLORS[1]
			}
		])
	})
})

const DAY = 86_400_000
/* Two venues past the series cap, V1..Vn, whose latest value is their number, so Vn is the largest, and an upstream
   Others. The first two days fall in the week the Sunday of 4 Jan 1970 keys. */
const names = Array.from({ length: CHART_SERIES_LIMIT + 2 }, (_, index) => `V${index + 1}`)
const largest = names[names.length - 1]
const pastCap: RWAPositionalChartDataset = {
	dimensions: ['timestamp', ...names, 'Others'],
	source: [
		[DAY, ...names.map(() => 1), 2],
		[2 * DAY, ...names.map((_, index) => index + 1), 3]
	]
}
const top = names.slice(2).reverse()
const largestFirst = [...names].reverse()
// Every member's latest value plus the upstream Others.
const latestTotal = (names.length * (names.length + 1)) / 2 + 3
const chartNames = (charts: Array<{ name: string }>) => charts.map((chart) => chart.name)

describe('buildRwaShareChart', () => {
	test('measures each pick against every member and the upstream Others, and folds everything else into Others', () => {
		const share = buildRwaShareChart({
			dataset: {
				dimensions: ['timestamp', 'Total Open Interest', 'A', 'B', 'C', 'Others'],
				source: [[DAY, 999, 50, 30, 10, 10]]
			},
			picked: ['B'],
			groupBy: 'daily',
			buildCharts: buildRwaTimeSeriesCharts
		})
		expect(share.dataset).toEqual({ dimensions: ['timestamp', 'B', 'Others'], source: [[DAY, 30, 70]] })
		expect(chartNames(share.charts)).toEqual(['B', 'Others'])
	})

	test('the Others share counts the picks past the cap and the upstream Others against every member', () => {
		const share = buildRwaShareChart({
			dataset: pastCap,
			picked: names,
			groupBy: 'daily',
			buildCharts: buildRwaTimeSeriesCharts
		})
		expect(share.dataset.source[1]?.at(-1)).toBeCloseTo(((2 + 1 + 3) / latestTotal) * 100)
	})

	test('nothing picked draws nothing', () => {
		const share = buildRwaShareChart({
			dataset: pastCap,
			picked: [],
			groupBy: 'daily',
			buildCharts: buildRwaTimeSeriesCharts
		})
		expect(share.charts).toEqual([])
		expect(share.dataset.dimensions).toEqual(['timestamp'])
	})
})

describe('buildRwaPerpsTimeSeriesChart', () => {
	test('open interest draws the picks under a Total of every market on the page', () => {
		const chart = buildRwaPerpsTimeSeriesChart({
			dataset: pastCap,
			metric: 'openInterest',
			view: 'timeSeries',
			period: 'daily',
			picked: ['V1', largest]
		})
		expect(chart.dataset).toEqual({
			dimensions: ['timestamp', 'Total Open Interest', largest, 'V1'],
			source: [
				[DAY, names.length + 2, 1, 1],
				[2 * DAY, latestTotal, names.length, 1]
			]
		})
		expect(chartNames(chart.charts)).toEqual(['Total Open Interest', largest, 'V1'])
	})

	test('volume stacks only the picks, summed by the period, with no Others', () => {
		const chart = buildRwaPerpsTimeSeriesChart({
			dataset: pastCap,
			metric: 'volume',
			view: 'timeSeries',
			period: 'weekly',
			picked: ['V1', largest]
		})
		expect(chart.dataset).toEqual({
			dimensions: ['timestamp', largest, 'V1'],
			source: [[3 * DAY, names.length + 1, 2]]
		})
		expect(chartNames(chart.charts)).toEqual([largest, 'V1'])
	})

	test('the csv lists every pick in its own column, with the upstream Others the chart draws, on the period', () => {
		const chart = buildRwaPerpsTimeSeriesChart({
			dataset: pastCap,
			metric: 'volume',
			view: 'timeSeries',
			period: 'weekly',
			picked: names
		})
		expect(chartNames(chart.charts)).toEqual([...top, 'Others'])
		// Each venue's week sums its two days, 1 and its number; the upstream Others sums 2 and 3.
		expect(chart.csv()).toEqual({
			dimensions: ['timestamp', ...largestFirst, 'Others'],
			source: [[3 * DAY, ...largestFirst.map((_, index) => names.length + 1 - index), 5]],
			groupBy: 'weekly'
		})
	})

	test('the share view exports every pick in its own column, on the period', () => {
		const chart = buildRwaPerpsTimeSeriesChart({
			dataset: pastCap,
			metric: 'volume',
			view: 'share',
			period: 'weekly',
			picked: names
		})
		expect(chartNames(chart.charts)).toEqual([...top, 'Others'])
		const csv = chart.csv()
		expect(csv.dimensions).toEqual(['timestamp', ...largestFirst, 'Others'])
		expect(csv.groupBy).toBe('weekly')
	})

	test('nothing picked draws nothing, not even the Total', () => {
		const chart = buildRwaPerpsTimeSeriesChart({
			dataset: pastCap,
			metric: 'openInterest',
			view: 'timeSeries',
			period: 'daily',
			picked: []
		})
		expect(chart.charts).toEqual([])
	})
})
