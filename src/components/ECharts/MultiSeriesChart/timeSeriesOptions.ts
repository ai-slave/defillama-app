import { CHART_INSET, CHART_LEGEND_RESERVE } from '../shared/chartSpacing'
import { formatTooltipValue, type TooltipGroupBy } from '../shared/formatters'
import { createSingleSeriesTooltipFormatter } from './tooltip'
import type { MultiSeriesChartOptions } from './types'

export function createTimeSeriesChartOptions(valueSymbol: string): MultiSeriesChartOptions {
	return valueSymbol === '%' ? { grid: { top: CHART_LEGEND_RESERVE } } : {}
}

export function createSingleSeriesChartOptions(
	valueSymbol: string,
	groupBy: TooltipGroupBy = 'daily'
): MultiSeriesChartOptions {
	return {
		tooltip: { formatter: createSingleSeriesTooltipFormatter(valueSymbol, groupBy) },
		xAxis: { axisLabel: { hideOverlap: false } },
		yAxis: {
			min: undefined,
			axisLabel: { formatter: (value: number) => formatTooltipValue(value, valueSymbol) }
		},
		grid: { top: CHART_INSET }
	}
}
