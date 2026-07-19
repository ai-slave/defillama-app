import { CHART_INSET } from '~/components/ECharts/chartSpacing'
import { createTimeSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import type { IMultiSeriesChart2Props, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'

export const AREA_EXPORT = { csv: true, png: true, filename: 'chart', pngTitle: '' } as const
export const BAR_EXPORT = { csv: true, png: false, filename: 'bar-chart-data' } as const
export const HIDDEN_EXPORT = 'hidden' as const

function chartOptions(valueSymbol: string, scrollLegend: boolean) {
	return {
		...createTimeSeriesChartOptions(valueSymbol),
		...(scrollLegend ? { legend: { type: 'scroll' as const, orient: 'horizontal' as const, top: CHART_INSET } } : {})
	} satisfies IMultiSeriesChart2Props['chartOptions']
}

export const DOLLAR_CHART_OPTIONS = chartOptions('$', false)
export const DOLLAR_STACKED_CHART_OPTIONS = chartOptions('$', false)
export const DOLLAR_SCROLL_CHART_OPTIONS = chartOptions('$', true)
export const DOLLAR_STACKED_SCROLL_CHART_OPTIONS = chartOptions('$', true)
export const UNITLESS_CHART_OPTIONS = chartOptions('', false)
export const UNITLESS_STACKED_SCROLL_CHART_OPTIONS = chartOptions('', true)

export function createSeriesConfigs(
	names: readonly string[],
	type: MultiSeriesChart2SeriesConfig['type'],
	colors?: Record<string, string>,
	stack?: string,
	firstColor?: string
): MultiSeriesChart2SeriesConfig[] {
	const charts = new Array<MultiSeriesChart2SeriesConfig>(names.length)
	for (let i = 0; i < names.length; i++) {
		const name = names[i]
		const color = colors?.[name] ?? (i === 0 ? firstColor : undefined)
		charts[i] = {
			type,
			name,
			encode: { x: 'timestamp', y: name },
			...(color ? { color } : {}),
			...(stack ? { stack } : {}),
			...(type === 'line' && !stack && i > 0 && !color ? { hideAreaStyle: true } : {})
		}
	}
	return charts
}
