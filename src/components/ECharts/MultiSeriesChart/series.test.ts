import type { ECharts } from 'echarts'
import { describe, expect, it } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import { getChartTheme } from '../shared/chartTheme'
import { buildMultiSeries } from './series'

const chartTheme = getChartTheme(false)

describe('MultiSeriesChart series construction', () => {
	it('keeps stacked bars out of ECharts large mode and normalizes explicit axes', () => {
		const series = buildMultiSeries({
			charts: [
				{ name: 'Bars', type: 'bar', stack: 'total', encode: { x: 'timestamp', y: 'Bars' } },
				{ name: 'Rate', type: 'line', yAxisIndex: 1, encode: { x: 'timestamp', y: 'Rate' } }
			],
			selectedCharts: undefined,
			expandTo100Percent: false,
			solidChartAreaStyle: false,
			chartTheme
		})

		expect(series[0]).toMatchObject({ large: false, stack: 'total', yAxisIndex: 0 })
		expect(series[1]).toMatchObject({ yAxisIndex: 1 })
	})

	it('uses TBD presentation when inconsistent external metadata marks both projection states', () => {
		const [series] = buildMultiSeries({
			charts: [
				{
					name: 'Projection',
					type: 'line',
					encode: { x: 'timestamp', y: 'Projection' },
					isTBD: true,
					isForecast: true
				}
			],
			selectedCharts: undefined,
			expandTo100Percent: false,
			solidChartAreaStyle: false,
			chartTheme
		})

		if (series.type !== 'line') throw new Error('Expected a line series')
		expect(series.endLabel).toMatchObject({ formatter: 'TBD', offset: [-40, 10] })
	})

	it('styles forecast series and hides only end labels that are too short to fit', () => {
		const chartRef: { current: ECharts | null } = {
			current: {
				isDisposed: () => false,
				convertToPixel: (_finder: unknown, value: number) => value * 2
			} as unknown as ECharts
		}
		const [series] = buildMultiSeries({
			charts: [
				{
					name: 'Forecast',
					type: 'line',
					encode: { x: 0, y: 1 },
					isForecast: true
				}
			],
			selectedCharts: undefined,
			expandTo100Percent: false,
			solidChartAreaStyle: false,
			chartTheme,
			chartRef
		})

		if (series.type !== 'line') throw new Error('Expected a line series')
		expect(series.itemStyle).toMatchObject({ opacity: 0.5 })
		expect(series.lineStyle).toMatchObject({ type: 'dashed', opacity: 0.5 })
		expect(series.endLabel).toMatchObject({ offset: [-80, 15] })
		const formatter = series.endLabel?.formatter
		if (typeof formatter !== 'function') throw new Error('Expected a projection label formatter')
		expect(formatter({ value: [0, 7] } as never)).toBe('')
		expect(formatter({ value: [0, 8] } as never)).toBe('Forecast')
	})

	it('keeps fallback colors stable when an earlier series is filtered out', () => {
		const [series] = buildMultiSeries({
			charts: [
				{ name: 'First', type: 'line', encode: { x: 0, y: 1 } },
				{ name: 'Second', type: 'line', encode: { x: 0, y: 2 } }
			],
			selectedCharts: new Set(['Second']),
			expandTo100Percent: false,
			solidChartAreaStyle: false,
			chartTheme
		})

		expect(series.itemStyle).toMatchObject({ color: CHART_COLORS[1] })
	})
})
