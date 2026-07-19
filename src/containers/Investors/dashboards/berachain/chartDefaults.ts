import { formatTooltipChartDate, formatTooltipValue } from '~/components/ECharts/formatters'
import { createTimeSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'

export const AREA_CHART_EXPORTS = {
	csv: true,
	png: true,
	filename: 'chart'
} as const
export const BAR_CHART_EXPORTS = {
	csv: true,
	png: false,
	filename: 'bar-chart-data'
} as const

export function createChartOptions(valueSymbol: string, reverseSeries = false) {
	return {
		...createTimeSeriesChartOptions(valueSymbol),
		...(reverseSeries
			? {
					tooltip: {
						formatter(params: Array<{ data: Record<string, number>; seriesName: string; marker: string }>) {
							if (params.length === 0) return ''

							let content = formatTooltipChartDate(params[0].data.timestamp, 'daily')
							for (let index = params.length - 1; index >= 0; index--) {
								const item = params[index]
								const value = item.data[item.seriesName]
								if (!value) continue
								content += `<li style="list-style:none">${item.marker}${item.seriesName}&nbsp;&nbsp;${formatTooltipValue(value, valueSymbol)}</li>`
							}
							return content
						}
					}
				}
			: {})
	}
}
