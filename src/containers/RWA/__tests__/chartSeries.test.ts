import { describe, expect, test } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import { buildRwaPerpsChartSeries, buildRwaTimeSeriesCharts } from '../chartSeries'

describe('buildRwaTimeSeriesCharts', () => {
	test('draws the Total line first without a fill or a tooltip sum, then the groups from the third colour', () => {
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
