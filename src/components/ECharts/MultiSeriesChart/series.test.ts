import type { ECharts } from 'echarts'
import * as echarts from 'echarts/core'
import { describe, expect, it } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import { getChartTheme } from '../shared/chartTheme'
import { buildMultiSeries } from './series'

const chartTheme = getChartTheme(false)

function requireSeries(series: ReturnType<typeof buildMultiSeries>[number] | undefined) {
	if (!series) throw new Error('Expected a chart series')
	return series
}

function requireLineSeries(series: ReturnType<typeof buildMultiSeries>[number] | undefined) {
	if (!series || series.type !== 'line') throw new Error('Expected a line series')
	return series
}

describe('MultiSeriesChart series construction', () => {
	it('brightens emphasized series without dimming their peers', () => {
		const series = buildMultiSeries({
			charts: [
				{ name: 'First', type: 'bar', stack: 'total', encode: { x: 'timestamp', y: 'First' } },
				{ name: 'Second', type: 'bar', stack: 'total', encode: { x: 'timestamp', y: 'Second' } }
			],
			selectedCharts: undefined,
			expandTo100Percent: false,
			solidChartAreaStyle: false,
			chartTheme
		})

		expect(series[0]?.emphasis).toEqual({ itemStyle: { color: echarts.color.lift(CHART_COLORS[0]!, 0.25) } })
		expect(series[1]?.emphasis).toEqual({ itemStyle: { color: echarts.color.lift(CHART_COLORS[1]!, 0.25) } })
		expect(series[0]?.blur).toBeUndefined()
		expect(series[1]?.blur).toBeUndefined()
	})

	it('keeps line emphasis local to visible point symbols', () => {
		const series = requireLineSeries(
			buildMultiSeries({
				charts: [{ name: 'Line', type: 'line', encode: { x: 'timestamp', y: 'Line' } }],
				selectedCharts: undefined,
				expandTo100Percent: false,
				solidChartAreaStyle: false,
				chartTheme
			})[0]
		)

		const emphasisColor = echarts.color.lift(CHART_COLORS[0]!, 0.25)
		expect(series.emphasis).toEqual({ itemStyle: { color: emphasisColor } })
		expect(series.blur).toBeUndefined()
	})

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
		const series = requireLineSeries(
			buildMultiSeries({
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
			})[0]
		)

		expect(series.endLabel).toMatchObject({ formatter: 'TBD', offset: [-40, 10] })
	})

	it('styles forecast series and hides only end labels that are too short to fit', () => {
		const chartRef: { current: ECharts | null } = {
			current: {
				isDisposed: () => false,
				convertToPixel: (_finder: unknown, value: number) => value * 2
			} as unknown as ECharts
		}
		const series = requireLineSeries(
			buildMultiSeries({
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
			})[0]
		)

		expect(series.itemStyle).toMatchObject({ opacity: 0.5 })
		expect(series.lineStyle).toMatchObject({ type: 'dashed', opacity: 0.5 })
		expect(series.endLabel).toMatchObject({ offset: [-80, 15] })
		const formatter = series.endLabel?.formatter
		if (typeof formatter !== 'function') throw new Error('Expected a projection label formatter')
		expect(formatter({ value: [0, 7] } as never)).toBe('')
		expect(formatter({ value: [0, 8] } as never)).toBe('Forecast')
	})

	it('keeps fallback colors stable when an earlier series is filtered out', () => {
		const series = requireSeries(
			buildMultiSeries({
				charts: [
					{ name: 'First', type: 'line', encode: { x: 0, y: 1 } },
					{ name: 'Second', type: 'line', encode: { x: 0, y: 2 } }
				],
				selectedCharts: new Set(['Second']),
				expandTo100Percent: false,
				solidChartAreaStyle: false,
				chartTheme
			})[0]
		)

		expect(series.itemStyle).toMatchObject({ color: CHART_COLORS[1] })
	})

	it('passes a typed step mode to line series', () => {
		const series = requireLineSeries(
			buildMultiSeries({
				charts: [{ name: 'Rounds', type: 'line', encode: { x: 0, y: 1 }, step: 'end' }],
				selectedCharts: undefined,
				expandTo100Percent: false,
				solidChartAreaStyle: false,
				chartTheme
			})[0]
		)

		expect(series).toMatchObject({ type: 'line', step: 'end' })
	})
})
