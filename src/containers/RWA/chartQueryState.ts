import type { NextRouter } from 'next/router'
import { readSingleQueryValue } from '~/utils/routerQuery'
import { getRwaChartTotalLabel } from './chartAggregation'
import {
	getRwaChartViewOptions,
	getRwaPerpsChartMetricOptions,
	getRwaTreemapParentGrouping,
	parseRwaPerpsChartMetric,
	type RWAOverviewChartMetric,
	type RWAPerpsChartMetric,
	type RwaChartAxis
} from './chartBreakdown'
import { RWA_PERPS_OI_TOTAL_LABEL } from './chartSeries'
import {
	getChartMetricOptions,
	parseRwaChartState,
	type RWAChartMetricAvailability,
	type RWAChartState,
	type RWAChartView
} from './chartState'
import { definitions } from './definitions'
import { parseRWAFlowQueryState, type RWAFlowQueryState } from './flows'
import type { RWAGroupBy } from './table/groupBy'

export type RwaChartQueryState = {
	flowQueryState: RWAFlowQueryState
	perpsChartMetric: RWAPerpsChartMetric
	treemapParentGrouping: RwaChartAxis
	chartState: RWAChartState
	selectedChartMetric: RWAOverviewChartMetric
	chartView: RWAChartView
	chartTotalLabel: string
}

/** The chart state the URL and the page settle; a view the selected metric cannot draw falls back to the time series. */
export function resolveRwaChartQueryState(
	query: NextRouter['query'],
	{
		isPerpsView,
		isPlatformMode,
		groupBy,
		availability
	}: { isPerpsView: boolean; isPlatformMode: boolean; groupBy: RWAGroupBy; availability: RWAChartMetricAvailability }
): RwaChartQueryState {
	const chartTypeQuery = readSingleQueryValue(query.chartType)
	const flowModeQuery = readSingleQueryValue(query.flowMode)
	/* Flows are an asset metric; the Perps view reads the period control for its volume bars instead. */
	const flowQueryState = parseRWAFlowQueryState(isPerpsView ? undefined : chartTypeQuery, flowModeQuery, isPlatformMode)
	const perpsChartMetric = parseRwaPerpsChartMetric(chartTypeQuery)
	const treemapParentGrouping = getRwaTreemapParentGrouping(groupBy)
	const chartState = parseRwaChartState(query, { treemapParentGrouping, availability })
	const selectedChartMetric: RWAOverviewChartMetric = isPerpsView
		? perpsChartMetric
		: flowQueryState.view === 'flowVsPrice'
			? 'flowVsPrice'
			: flowQueryState.view != null
				? 'flows'
				: chartState.metric
	const chartView: RWAChartView = getRwaChartViewOptions(selectedChartMetric).some(
		(option) => option.key === chartState.view
	)
		? chartState.view
		: 'timeSeries'
	const chartTotalLabel = isPerpsView ? RWA_PERPS_OI_TOTAL_LABEL : getRwaChartTotalLabel(chartState.metric)
	return {
		flowQueryState,
		perpsChartMetric,
		treemapParentGrouping,
		chartState,
		selectedChartMetric,
		chartView,
		chartTotalLabel
	}
}

/** The chart type switch: open interest and volume in the Perps view; the tracked asset metrics plus flows otherwise. */
export function getRwaOverviewChartMetricOptions({
	isPerpsView,
	isPlatformMode,
	availability
}: {
	isPerpsView: boolean
	isPlatformMode: boolean
	availability: RWAChartMetricAvailability
}): ReadonlyArray<{ key: RWAOverviewChartMetric; label: string }> {
	if (isPerpsView) return getRwaPerpsChartMetricOptions()
	return [
		...getChartMetricOptions(availability),
		{ key: 'flows' as const, label: definitions.flows.overviewNetFlows.label },
		...(isPlatformMode ? [{ key: 'flowVsPrice' as const, label: definitions.flows.flowVsPrice.label }] : [])
	]
}
