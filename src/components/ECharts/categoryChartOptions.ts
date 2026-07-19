import { CHART_LEGEND_RESERVE } from './chartSpacing'
import { createCategoryTooltipFormatter } from './formatters'
import type { IMultiSeriesChart2Props } from './types'

/** Match the legacy category-axis layout and tooltip when migrating BarChart callers. */
export function createCategoryChartOptions(valueSymbol: string): IMultiSeriesChart2Props['chartOptions'] {
	return {
		xAxis: { type: 'category', boundaryGap: true },
		tooltip: { formatter: createCategoryTooltipFormatter(valueSymbol) },
		...(valueSymbol === '%' ? { grid: { top: CHART_LEGEND_RESERVE } } : {})
	}
}
