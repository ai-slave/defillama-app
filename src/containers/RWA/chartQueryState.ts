import type { NextRouter } from 'next/router'
import { readSingleQueryValue } from '~/utils/routerQuery'
import { getRwaChartTotalLabel } from './chartAggregation'
import {
	getRwaChartViewOptions,
	getRwaTreemapParentGrouping,
	type RWASpotChartMetric,
	type RwaChartAxis
} from './chartBreakdown'
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
	treemapParentGrouping: RwaChartAxis
	chartState: RWAChartState
	selectedChartMetric: RWASpotChartMetric
	chartView: RWAChartView
	chartTotalLabel: string
}

/** The chart state the URL and the page settle; a view the selected metric cannot draw falls back to the time series. */
export function resolveRwaChartQueryState(
	query: NextRouter['query'],
	{
		isPlatformMode,
		groupBy,
		availability
	}: { isPlatformMode: boolean; groupBy: RWAGroupBy; availability: RWAChartMetricAvailability }
): RwaChartQueryState {
	const flowQueryState = parseRWAFlowQueryState(
		readSingleQueryValue(query.chartType),
		readSingleQueryValue(query.flowMode),
		isPlatformMode
	)
	const treemapParentGrouping = getRwaTreemapParentGrouping(groupBy)
	const chartState = parseRwaChartState(query, { treemapParentGrouping, availability })
	const selectedChartMetric: RWASpotChartMetric =
		flowQueryState.view === 'flowVsPrice' ? 'flowVsPrice' : flowQueryState.view != null ? 'flows' : chartState.metric
	const chartView: RWAChartView = getRwaChartViewOptions(selectedChartMetric).some(
		(option) => option.key === chartState.view
	)
		? chartState.view
		: 'timeSeries'
	const chartTotalLabel = getRwaChartTotalLabel(chartState.metric)
	return {
		flowQueryState,
		treemapParentGrouping,
		chartState,
		selectedChartMetric,
		chartView,
		chartTotalLabel
	}
}

/** The chart type switch: the tracked asset metrics plus flows, and flow vs price on a platform page. */
export function getRwaOverviewChartMetricOptions({
	isPlatformMode,
	availability
}: {
	isPlatformMode: boolean
	availability: RWAChartMetricAvailability
}): ReadonlyArray<{ key: RWASpotChartMetric; label: string }> {
	return [
		...getChartMetricOptions(availability),
		{ key: 'flows' as const, label: definitions.flows.overviewNetFlows.label },
		...(isPlatformMode ? [{ key: 'flowVsPrice' as const, label: definitions.flows.flowVsPrice.label }] : [])
	]
}
