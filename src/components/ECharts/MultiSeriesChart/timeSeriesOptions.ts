import { CHART_INSET, CHART_LEGEND_RESERVE } from '../shared/chartSpacing'
import { formatTooltipValue } from '../shared/formatters'
import { createSingleSeriesTooltipFormatter } from './tooltip'
import type { MultiSeriesChartOptions } from './types'

export function createTimeSeriesChartOptions(valueSymbol: string): MultiSeriesChartOptions {
	return valueSymbol === '%' ? { grid: { top: CHART_LEGEND_RESERVE } } : {}
}

export function createSingleSeriesChartOptions(valueSymbol: string): MultiSeriesChartOptions {
	return {
		tooltip: { formatter: createSingleSeriesTooltipFormatter(valueSymbol) },
		xAxis: { axisLabel: { hideOverlap: false } },
		yAxis: {
			min: undefined,
			axisLabel: { formatter: (value: number) => formatTooltipValue(value, valueSymbol) }
		},
		grid: { top: CHART_INSET }
	}
}
