import { CHART_LEGEND_RESERVE } from '../shared/chartSpacing'
import { createCategoryTooltipFormatter } from './tooltip'
import type { IMultiSeriesChartProps } from './types'

/** Match the legacy category-axis layout and tooltip when migrating BarChart callers. */
export function createCategoryChartOptions(valueSymbol: string): IMultiSeriesChartProps['chartOptions'] {
	return {
		xAxis: { type: 'category', boundaryGap: true },
		tooltip: { formatter: createCategoryTooltipFormatter(valueSymbol) },
		...(valueSymbol === '%' ? { grid: { top: CHART_LEGEND_RESERVE } } : {})
	}
}
