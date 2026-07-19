import { CHART_INSET, CHART_LEGEND_RESERVE } from './chartSpacing'
import { createSingleSeriesTooltipFormatter, formatTooltipValue } from './formatters'
import type { IMultiSeriesChart2Props } from './types'

export function createTimeSeriesChartOptions(valueSymbol: string): IMultiSeriesChart2Props['chartOptions'] {
	return valueSymbol === '%' ? { grid: { top: CHART_LEGEND_RESERVE } } : {}
}

export function createSingleSeriesChartOptions(valueSymbol: string): IMultiSeriesChart2Props['chartOptions'] {
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
