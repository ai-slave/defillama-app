import { describe, expect, test } from 'vitest'
import type { MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import { buildAdapterByChainCombinedChartPresentation } from '../combinedChart'

const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

describe('buildAdapterByChainCombinedChartPresentation', () => {
	test('treats a series named timestamp as the second positional dimension', () => {
		const chartData: MultiSeriesTimeSeriesDataset = {
			dimensions: ['timestamp', 'timestamp'],
			source: [[toMs(2024, 1, 1), 42]]
		}

		const presentation = buildAdapterByChainCombinedChartPresentation({
			chartData,
			chartName: 'Volume',
			groupBy: 'daily'
		})

		expect(presentation.dataset).toBe(chartData)
		expect(presentation.charts).toEqual([
			{
				type: 'bar',
				name: 'timestamp',
				encode: { x: 0, y: 1 },
				color: CHART_COLORS[0]
			}
		])
	})

	test('keeps daily data unchanged and preserves dimension, chart, and color ordering', () => {
		const chartData: MultiSeriesTimeSeriesDataset = {
			dimensions: ['timestamp', 'Flow B', 'Open Interest', 'Flow A'],
			source: [
				[toMs(2024, 1, 1), 2, 100, null],
				[toMs(2024, 1, 2), 3, 110, 4]
			]
		}

		const presentation = buildAdapterByChainCombinedChartPresentation({
			chartData,
			chartName: 'Volume',
			groupBy: 'daily'
		})

		expect(presentation.dataset).toBe(chartData)
		expect(presentation.charts).toEqual([
			{
				type: 'bar',
				name: 'Flow B',
				encode: { x: 0, y: 1 },
				color: CHART_COLORS[0]
			},
			{
				type: 'line',
				name: 'Open Interest',
				encode: { x: 0, y: 2 },
				color: CHART_COLORS[1],
				yAxisIndex: 1,
				hideAreaStyle: true
			},
			{
				type: 'bar',
				name: 'Flow A',
				encode: { x: 0, y: 3 },
				color: CHART_COLORS[2]
			}
		])
	})

	test('groups mixed line and bar series in one dense row-major dataset', () => {
		const presentation = buildAdapterByChainCombinedChartPresentation({
			chartName: 'Volume',
			groupBy: 'weekly',
			chartData: {
				dimensions: ['timestamp', 'Volume', 'Open Interest'],
				source: [
					[toMs(2024, 1, 1), 10, 100],
					[toMs(2024, 1, 2), 20, 110],
					[toMs(2024, 1, 8), 7],
					[toMs(2024, 1, 15), undefined, 140]
				]
			}
		})

		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'Volume', 'Open Interest'],
			source: [
				[toMs(2024, 1, 7), 30, 110],
				[toMs(2024, 1, 14), 7, null],
				[toMs(2024, 1, 21), null, 140]
			]
		})
		expect(presentation.charts.map(({ name, type }) => ({ name, type }))).toEqual([
			{ name: 'Volume', type: 'bar' },
			{ name: 'Open Interest', type: 'line' }
		])
	})

	test('accumulates flow series while leaving sparse snapshot values unchanged', () => {
		const presentation = buildAdapterByChainCombinedChartPresentation({
			chartName: 'Volume',
			groupBy: 'cumulative',
			chartData: {
				dimensions: ['timestamp', 'Volume', 'Open Interest'],
				source: [
					[toMs(2024, 1, 1), 5, 100],
					[toMs(2024, 1, 2), null, 110],
					[toMs(2024, 1, 3), 7, 115],
					[toMs(2024, 1, 3), 3, 120]
				]
			}
		})

		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'Volume', 'Open Interest'],
			source: [
				[toMs(2024, 1, 1), 5, 100],
				[toMs(2024, 1, 2), 5, 110],
				[toMs(2024, 1, 3), 15, 120]
			]
		})
		expect(presentation.charts.map(({ name, type }) => ({ name, type }))).toEqual([
			{ name: 'Volume', type: 'line' },
			{ name: 'Open Interest', type: 'line' }
		])
	})

	test('uses last-in-bucket snapshot semantics for every series on a snapshot chart', () => {
		const presentation = buildAdapterByChainCombinedChartPresentation({
			chartName: 'Active Liquidity',
			groupBy: 'monthly',
			chartData: {
				dimensions: ['timestamp', 'Series B', 'Series A'],
				source: [
					[toMs(2024, 1, 1), 10, 20],
					[toMs(2024, 1, 31), 30, 40]
				]
			}
		})

		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'Series B', 'Series A'],
			source: [[toMs(2024, 1, 1), 30, 40]]
		})
		expect(presentation.charts.map(({ name, type }) => ({ name, type }))).toEqual([
			{ name: 'Series B', type: 'line' },
			{ name: 'Series A', type: 'line' }
		])
	})
})
