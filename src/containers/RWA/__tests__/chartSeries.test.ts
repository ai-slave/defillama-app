import { describe, expect, test } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import type { RWAPositionalChartDataset } from '../chartDataset'
import { buildRwaPerpsChartSeries, buildRwaTimeSeriesCharts, RWA_PERPS_OI_TOTAL_LABEL } from '../chartSeries'

describe('buildRwaTimeSeriesCharts', () => {
	test('draws the Total line first without a fill or a tooltip sum, then the groups from the third colour', () => {
		expect(buildRwaTimeSeriesCharts({ dimensions: ['timestamp', 'Bonds', 'Total Onchain Mcap'], source: [] })).toEqual([
			{
				name: 'Total Onchain Mcap',
				type: 'line',
				encode: { x: 'timestamp', y: 'Total Onchain Mcap' },
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

const dataset: RWAPositionalChartDataset = {
	dimensions: ['timestamp', RWA_PERPS_OI_TOTAL_LABEL, 'Hyperliquid', 'Others'],
	source: [[1, 3, 2, 1]]
}

describe('buildRwaPerpsChartSeries', () => {
	test('draws open interest as the site time series: a Total line on top and lines with a soft fill', () => {
		expect(buildRwaPerpsChartSeries(dataset, 'openInterest')).toEqual([
			{
				name: RWA_PERPS_OI_TOTAL_LABEL,
				type: 'line',
				encode: { x: 'timestamp', y: RWA_PERPS_OI_TOTAL_LABEL },
				color: CHART_COLORS[0],
				hideAreaStyle: true,
				excludeFromTooltipTotal: true
			},
			{ name: 'Hyperliquid', type: 'line', encode: { x: 'timestamp', y: 'Hyperliquid' }, color: CHART_COLORS[2] },
			{ name: 'Others', type: 'line', encode: { x: 'timestamp', y: 'Others' }, color: CHART_COLORS[3] }
		])
	})

	test('draws volume as stacked bars per group with no Total series', () => {
		expect(
			buildRwaPerpsChartSeries({ dimensions: ['timestamp', 'Hyperliquid', 'Others'], source: [[1, 2, 1]] }, 'volume')
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
