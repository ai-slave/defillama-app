import {
	createSingleSeriesChartOptions,
	createTimeSeriesChartOptions
} from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import { CHART_LEGEND_RESERVE, CHART_ZOOM_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { createSignedInflowsTooltipFormatter } from '~/components/ECharts/shared/tooltip'

export const STABLECOIN_DOLLAR_CHART_OPTIONS = {
	...createTimeSeriesChartOptions('$'),
	grid: chartGrid({ bottom: CHART_ZOOM_RESERVE })
}

export const STABLECOIN_PERCENT_CHART_OPTIONS = {
	...createTimeSeriesChartOptions('%'),
	grid: chartGrid({ top: CHART_LEGEND_RESERVE, bottom: CHART_ZOOM_RESERVE })
}

export const STABLECOIN_SINGLE_UNITLESS_CHART_OPTIONS = {
	...createSingleSeriesChartOptions(''),
	grid: chartGrid({ bottom: CHART_ZOOM_RESERVE })
}

export const STABLECOIN_INFLOWS_CHART_OPTIONS = {
	tooltip: { formatter: createSignedInflowsTooltipFormatter('') },
	grid: chartGrid({ bottom: CHART_ZOOM_RESERVE })
}
