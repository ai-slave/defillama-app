import { CHART_INSET, CHART_LEGEND_RESERVE } from '../shared/chartSpacing'
import { formatTooltipValue } from '../shared/formatters'
import { createSingleSeriesTooltipFormatter } from './tooltip'
import type { IMultiSeriesChartProps } from './types'

export function createTimeSeriesChartOptions(valueSymbol: string): IMultiSeriesChartProps['chartOptions'] {
	return valueSymbol === '%' ? { grid: { top: CHART_LEGEND_RESERVE } } : {}
}

export function createSingleSeriesChartOptions(valueSymbol: string): IMultiSeriesChartProps['chartOptions'] {
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
