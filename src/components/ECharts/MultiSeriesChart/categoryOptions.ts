import { CHART_LEGEND_RESERVE } from '../shared/chartSpacing'
import { createCategoryTooltipFormatter } from './tooltip'
import type { IMultiSeriesChartProps } from './types'

/**
 * Category x-axis for MultiSeriesChart: one slot per label (proposals, buckets, assets) instead of a
 * time scale. The dataset's first dimension holds the labels; pass your own `tooltip.formatter` to
 * show more than the label and the series values.
 */
export function createCategoryChartOptions(valueSymbol: string): IMultiSeriesChartProps['chartOptions'] {
	return {
		xAxis: { type: 'category', boundaryGap: true },
		tooltip: { formatter: createCategoryTooltipFormatter(valueSymbol) },
		...(valueSymbol === '%' ? { grid: { top: CHART_LEGEND_RESERVE } } : {})
	}
}
