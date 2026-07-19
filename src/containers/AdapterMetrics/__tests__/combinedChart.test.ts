import { describe, expect, it } from 'vitest'
import type { MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { CHART_COLORS } from '~/constants/colors'
import { buildAdapterByChainCombinedChartPresentation } from '../combinedChart'

const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

describe('buildAdapterByChainCombinedChartPresentation', () => {
	it('keeps daily data unchanged and preserves dimension, chart, and color ordering', () => {
		const chartData: MultiSeriesChart2Dataset = {
			dimensions: ['Flow B', 'timestamp', 'Open Interest', 'Flow A'],
			source: [
				{ timestamp: toMs(2024, 1, 1), 'Flow B': 2, 'Open Interest': 100, 'Flow A': null },
				{ timestamp: toMs(2024, 1, 2), 'Flow B': 3, 'Open Interest': 110, 'Flow A': 4 }
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
				encode: { x: 'timestamp', y: 'Flow B' },
				color: CHART_COLORS[0]
			},
			{
				type: 'line',
				name: 'Open Interest',
				encode: { x: 'timestamp', y: 'Open Interest' },
				color: CHART_COLORS[1],
				yAxisIndex: 1,
				hideAreaStyle: true
			},
			{
				type: 'bar',
				name: 'Flow A',
				encode: { x: 'timestamp', y: 'Flow A' },
				color: CHART_COLORS[2]
			}
		])
	})

	it('groups mixed line and bar series in one dense row-major dataset', () => {
		const presentation = buildAdapterByChainCombinedChartPresentation({
			chartName: 'Volume',
			groupBy: 'weekly',
			chartData: {
				dimensions: ['timestamp', 'Volume', 'Open Interest'],
				source: [
					{ timestamp: toMs(2024, 1, 1), Volume: 10, 'Open Interest': 100 },
					{ timestamp: toMs(2024, 1, 2), Volume: 20, 'Open Interest': 110 },
					{ timestamp: toMs(2024, 1, 8), Volume: 7 },
					{ timestamp: toMs(2024, 1, 15), 'Open Interest': 140 }
				]
			}
		})

		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'Volume', 'Open Interest'],
			source: [
				{ timestamp: toMs(2024, 1, 7), Volume: 30, 'Open Interest': 110 },
				{ timestamp: toMs(2024, 1, 14), Volume: 7, 'Open Interest': null },
				{ timestamp: toMs(2024, 1, 21), Volume: null, 'Open Interest': 140 }
			]
		})
		expect(presentation.charts.map(({ name, type }) => ({ name, type }))).toEqual([
			{ name: 'Volume', type: 'bar' },
			{ name: 'Open Interest', type: 'line' }
		])
	})

	it('accumulates flow series while leaving sparse snapshot values unchanged', () => {
		const presentation = buildAdapterByChainCombinedChartPresentation({
			chartName: 'Volume',
			groupBy: 'cumulative',
			chartData: {
				dimensions: ['timestamp', 'Volume', 'Open Interest'],
				source: [
					{ timestamp: toMs(2024, 1, 1), Volume: 5, 'Open Interest': 100 },
					{ timestamp: toMs(2024, 1, 2), Volume: null, 'Open Interest': 110 },
					{ timestamp: toMs(2024, 1, 3), Volume: 7, 'Open Interest': 115 },
					{ timestamp: toMs(2024, 1, 3), Volume: 3, 'Open Interest': 120 }
				]
			}
		})

		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'Volume', 'Open Interest'],
			source: [
				{ timestamp: toMs(2024, 1, 1), Volume: 5, 'Open Interest': 100 },
				{ timestamp: toMs(2024, 1, 2), Volume: null, 'Open Interest': 110 },
				{ timestamp: toMs(2024, 1, 3), Volume: 15, 'Open Interest': 120 }
			]
		})
		expect(presentation.charts.map(({ name, type }) => ({ name, type }))).toEqual([
			{ name: 'Volume', type: 'line' },
			{ name: 'Open Interest', type: 'line' }
		])
	})

	it('uses last-in-bucket snapshot semantics for every series on a snapshot chart', () => {
		const presentation = buildAdapterByChainCombinedChartPresentation({
			chartName: 'Active Liquidity',
			groupBy: 'monthly',
			chartData: {
				dimensions: ['Series B', 'timestamp', 'Series A'],
				source: [
					{ timestamp: toMs(2024, 1, 1), 'Series B': 10, 'Series A': 20 },
					{ timestamp: toMs(2024, 1, 31), 'Series B': 30, 'Series A': 40 }
				]
			}
		})

		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'Series B', 'Series A'],
			source: [{ timestamp: toMs(2024, 1, 1), 'Series B': 30, 'Series A': 40 }]
		})
		expect(presentation.charts.map(({ name, type }) => ({ name, type }))).toEqual([
			{ name: 'Series B', type: 'line' },
			{ name: 'Series A', type: 'line' }
		])
	})
})
