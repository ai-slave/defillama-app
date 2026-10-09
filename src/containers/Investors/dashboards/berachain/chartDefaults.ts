import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { formatTooltipChartDate, formatTooltipValue } from '~/components/ECharts/shared/formatters'
import {
	getPointedSeriesName,
	getTooltipAxisValue,
	getTooltipRawYValue,
	normalizeTooltipItems,
	TOOLTIP_POINTED_ROW_STYLE
} from '~/components/ECharts/shared/tooltip'

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

export function createChartOptions(valueSymbol: string, reverseSeries = false): MultiSeriesChartOptions {
	return {
		...createTimeSeriesChartOptions(valueSymbol),
		...(reverseSeries
			? {
					tooltip: {
						formatter(params: unknown) {
							const items = normalizeTooltipItems(params)
							if (items.length === 0) return ''

							const pointedName = getPointedSeriesName(items)
							let pointedRow = ''
							let rows = ''
							for (let index = items.length - 1; index >= 0; index--) {
								const item = items[index]
								const name = item.seriesName
								if (!name) continue
								const rawValue = getTooltipRawYValue(item, name)
								const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
								if (!value || !Number.isFinite(value)) continue
								const row = `${item.marker ?? ''}${name}&nbsp;&nbsp;${formatTooltipValue(value, valueSymbol)}`
								if (name === pointedName) pointedRow = `<li style="${TOOLTIP_POINTED_ROW_STYLE}">${row}</li>`
								else rows += `<li style="list-style:none">${row}</li>`
							}
							return formatTooltipChartDate(getTooltipAxisValue(items[0]), 'daily') + pointedRow + rows
						}
					}
				}
			: {})
	}
}
