import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { groupMultiSeriesBarChartDataset } from '~/components/ECharts/MultiSeriesChart/groupDataset'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { Select } from '~/components/Select/Select'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingDots } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { pushShallowQuery, readSingleQueryValue, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { IRWAAssetsOverview, RWAAssetChartTarget, RWAChartMetricKey } from './api.types'
import { getRwaChartTotalLabel } from './chartAggregation'
import {
	getRwaChartFilterNote,
	getRwaChartGroupLabel,
	getRwaChartViewOptions,
	getRwaFlowSplitBy,
	getRwaPerpsChartMetricOptions,
	getRwaPerpsChartMetricQueryValue,
	getRwaPerpsChartSource,
	getRwaSpotChartSource,
	parseRwaPerpsChartMetric,
	getRwaTreemapParentGrouping,
	type RWAChartDataOrigin,
	type RWAOverviewChartMetric,
	type RWAPerpsChartMetric,
	type RwaChartAxis
} from './chartBreakdown'
import type { RWAPositionalChartDataset } from './chartDataset'
import {
	dropRwaRedundantTotal,
	ensureRwaTotalSeries,
	foldRwaTopSeries,
	RWA_MAX_CHART_SERIES,
	toRwaShareDataset
} from './chartFold'
import { buildRwaPerpsChartSeries, buildRwaTimeSeriesCharts, RWA_PERPS_OI_TOTAL_LABEL } from './chartSeries'
import {
	getChartMetricLabel,
	getChartMetricOptions,
	getChartMetricQueryValue,
	getChartViewQueryValue,
	getTreemapNestedByQueryValue,
	parseRwaChartState,
	setTreemapNestedBy,
	type RWAChartMetricAvailability,
	type RWAChartState,
	type RWAChartView,
	type RwaTreemapNestedBy
} from './chartState'
import type { RWAOverviewMode } from './constants'
import { definitions } from './definitions'
import { RWAFlowVsPriceStrip } from './FlowPanelParts'
import {
	buildRWAFlowRotationChart,
	aggregateRWAFlowRows,
	buildRWAFlowChart,
	getRWAFlowDefaultStartTimestamp,
	getRWAFlowModeQueryValue,
	getRWAFlowOverlayQueryValue,
	getRWAFlowOverlayOptions,
	getRWAFlowVsPriceAssetSummaries,
	getRWAFlowVsPriceSummary,
	parseRWAFlowQueryState,
	parseRWAFlowOverlayMetrics,
	RWA_FLOW_GROUPING_OPTIONS,
	type RWAFlowChartSelection,
	type RWAFlowGrouping,
	type RWAFlowOverlay,
	type RWAFlowQueryState,
	type RWAFlowVisibleRange
} from './flows'
import { type RWAFlowScope, useRWAFlowSeries } from './flows.hooks'
import { sumRwaFlowSplit } from './flowSplit'
import { useRwaChartDataset } from './hooks'
import { RWAOverviewBreakdownPanel } from './OverviewBreakdownPanel'
import type { getRankedRwaFilterValues } from './rankedFilterValues'
import { rwaSlug } from './rwaSlug'
import type { RWAGroupBy, RWATableView } from './table/groupBy'
import { useRwaChainChartDataset } from './useChainChartDataset'
import { useRwaPerpsChartDataset } from './usePerpsChartDataset'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const RWAFlowsChart = lazy(() => import('./FlowsChart').then((module) => ({ default: module.RWAFlowsChart })))

export type RWAOverviewChartPanelProps = {
	overview: IRWAAssetsOverview
	mode: RWAOverviewMode
	selectedModeLabel: string
	aggregateAssets: IRWAAssetsOverview['assets']
	/** The Assets or Perps view; the Perps view draws open interest and volume by the Group by. */
	view: RWATableView
	/** The table's Group by, the one axis every chart follows. */
	groupBy: RWAGroupBy
	rankedFilterValues: ReturnType<typeof getRankedRwaFilterValues>
	selectedAssetNames: Array<string>
	selectedCategories: Array<string>
	includeStablecoins: boolean
	includeGovernance: boolean
	includeCex: boolean
	includeBridgeTvl: boolean
	/** A scope flag or a filter differs from the page defaults, so the build-time datasets do not apply. */
	activeFilters: boolean
	/** A filter from the Filters dialog is active; a server split cannot follow it. */
	activeAttributeFilters: boolean
}

function isSameFlowVisibleRange(a: RWAFlowVisibleRange | null, b: RWAFlowVisibleRange | null): boolean {
	if (a == null || b == null) return a === b
	return a.start === b.start && a.end === b.end
}

type RwaChartQueryState = {
	flowQueryState: RWAFlowQueryState
	perpsChartMetric: RWAPerpsChartMetric
	treemapParentGrouping: RwaChartAxis
	chartState: RWAChartState
	selectedChartMetric: RWAOverviewChartMetric
	chartView: RWAChartView
	chartTotalLabel: string
}

/**
 * The chart state the URL and the page settle: a hook on purpose, since the compiler treats a hook's return as
 * frozen and lets the memoized folds below depend on these values.
 */
function useRwaChartQueryState(
	query: ReturnType<typeof useRouter>['query'],
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

/** The overview chart panel: the metric switch, the view select, the exports and the chart body. */
export function RWAOverviewChartPanel({
	overview,
	mode,
	selectedModeLabel,
	aggregateAssets,
	view,
	groupBy,
	rankedFilterValues,
	selectedAssetNames,
	selectedCategories,
	includeStablecoins,
	includeGovernance,
	includeCex,
	includeBridgeTvl,
	activeFilters,
	activeAttributeFilters
}: RWAOverviewChartPanelProps) {
	const router = useRouter()
	const isPlatformMode = mode === 'platform'
	const isAssetGroupMode = mode === 'assetGroup'
	const isPerpsView = view === 'perps'
	const chartMetricAvailability = overview.chartMetricAvailability
	const {
		flowQueryState,
		perpsChartMetric,
		treemapParentGrouping,
		chartState,
		selectedChartMetric,
		chartView,
		chartTotalLabel
	} = useRwaChartQueryState(router.query, {
		isPerpsView,
		isPlatformMode,
		groupBy,
		availability: chartMetricAvailability
	})
	const isFlowVsPrice = flowQueryState.view === 'flowVsPrice'
	const perpsChartSource = getRwaPerpsChartSource(groupBy)
	const [flowVisibleRange, setFlowVisibleRange] = useState<RWAFlowVisibleRange | null>(null)
	const handleFlowVisibleRangeChange = useCallback((range: RWAFlowVisibleRange | null) => {
		setFlowVisibleRange((previous) => (isSameFlowVisibleRange(previous, range) ? previous : range))
	}, [])
	const isFlowMetric = flowQueryState.view != null
	const chartTypeKey = chartState.metric
	const chartViewOptions = getRwaChartViewOptions(selectedChartMetric)
	const isTimeSeriesView = chartView === 'timeSeries' || chartView === 'share'
	const spotChartSource = getRwaSpotChartSource(groupBy)
	const isChainSource = spotChartSource.kind === 'chains'
	const chartGroupLabel = getRwaChartGroupLabel(groupBy)

	const initialChartDatasets = overview.initialChartDatasets
	/* Every build-time dataset on a metric carries the same Total line, so the first one serves an overlay. */
	const getInitialMetricDataset = (metric: RWAChartMetricKey) =>
		initialChartDatasets.find((initial) => initial.metric === metric)?.dataset ?? null
	const initialGroupedDataset =
		initialChartDatasets.find((initial) => initial.metric === chartTypeKey && initial.groupBy === groupBy) ?? null
	const chartTarget = getAssetChartTarget(overview)
	const flowScope = getRwaFlowScope(chartTarget)
	/* On the front page the flows follow the Group by: a split drawn per group, or the total when none is asked for. */
	const flowSplitBy = flowScope.kind === 'overview' ? getRwaFlowSplitBy(groupBy) : null
	const isGroupedFlowChart = isFlowMetric && flowSplitBy != null
	const {
		splitPoints: flowSplitPoints,
		assetRows: flowAssetRows,
		isLoading: isFlowLoading,
		error: flowError
	} = useRWAFlowSeries({
		scope: flowScope,
		...(flowSplitBy ? { splitBy: flowSplitBy } : {}),
		includeStablecoin: includeStablecoins,
		includeGovernance,
		enabled: isFlowMetric
	})
	const flowData = useMemo(() => {
		const series = flowSplitPoints
			? sumRwaFlowSplit(flowSplitPoints)
			: flowAssetRows
				? aggregateRWAFlowRows(flowAssetRows, aggregateAssets)
				: null
		return series ? { series } : null
	}, [flowSplitPoints, flowAssetRows, aggregateAssets])
	const flowGroupBy = flowQueryState.groupBy
	const groupedFlowChart = useMemo(
		() =>
			isGroupedFlowChart && flowSplitPoints
				? buildRWAFlowRotationChart(flowSplitPoints, flowGroupBy, { maxSeries: RWA_MAX_CHART_SERIES })
				: null,
		[flowGroupBy, flowSplitPoints, isGroupedFlowChart]
	)
	const selectedFlowOverlayMetrics = useMemo(
		() => parseRWAFlowOverlayMetrics(toNonEmptyArrayParam(router.query.flowOverlays), chartMetricAvailability),
		[router.query.flowOverlays, chartMetricAvailability]
	)
	const flowOverlayOptions = getRWAFlowOverlayOptions(chartMetricAvailability)
	const isSpotTimeSeries = !isPerpsView && !isFlowMetric && isTimeSeriesView
	/* A build-time dataset applies while the page sits at its defaults; its Total line serves every Group by. */
	const hasInitialMetricDataset = getInitialMetricDataset(chartTypeKey) != null && !activeFilters
	const useInitialGroupedDataset = initialGroupedDataset != null && !activeFilters
	/* Under Group by Chain the per-asset fold only supplies the page total the chain lines follow. */
	const {
		chartDataset: assetChartDataset,
		isChartLoading: isAssetChartLoading,
		chartError: assetChartError
	} = useRwaChartDataset({
		selectedMetric: chartTypeKey,
		initialDataset: getInitialMetricDataset(chartTypeKey),
		filteredAssets: aggregateAssets,
		mode: isChainSource ? 'total' : spotChartSource.mode,
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl,
		enabled: isSpotTimeSeries && !(isChainSource && useInitialGroupedDataset),
		useInitialDataset: isChainSource ? hasInitialMetricDataset : useInitialGroupedDataset
	})
	const {
		chartDataset: chainChartDataset,
		isChartLoading: isChainChartLoading,
		chartError: chainChartError
	} = useRwaChainChartDataset({
		metric: chartTypeKey,
		assets: aggregateAssets,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl,
		total: assetChartDataset,
		enabled: isSpotTimeSeries && isChainSource && !useInitialGroupedDataset
	})
	const {
		chartDataset: perpsChartDataset,
		isChartLoading: isPerpsChartLoading,
		chartError: perpsChartError
	} = useRwaPerpsChartDataset({
		source: perpsChartSource,
		metric: perpsChartMetric,
		includeCex,
		enabled: isPerpsView && isTimeSeriesView
	})
	const groupedChartDataset = isPerpsView
		? perpsChartDataset
		: isChainSource
			? useInitialGroupedDataset && initialGroupedDataset
				? initialGroupedDataset.dataset
				: chainChartDataset
			: assetChartDataset
	const isChartLoading = isAssetChartLoading || isChainChartLoading || isPerpsChartLoading
	const chartError = assetChartError ?? chainChartError ?? perpsChartError
	const chartDataOrigin: RWAChartDataOrigin =
		isPerpsView || (isFlowMetric && flowScope.kind === 'overview') ? 'split' : 'fold'
	const chartNote = getRwaChartFilterNote(chartDataOrigin, activeAttributeFilters)
	const {
		chartDataset: flowOnChainMcapDataset,
		assetRows: flowOnChainMcapAssetRows,
		isChartLoading: isFlowMcapLoading,
		chartError: flowMcapError
	} = useRwaChartDataset({
		selectedMetric: 'onChainMcap',
		initialDataset: getInitialMetricDataset('onChainMcap'),
		filteredAssets: aggregateAssets,
		mode: 'total',
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		enabled:
			isFlowMetric && !isGroupedFlowChart && (selectedFlowOverlayMetrics.includes('onChainMcap') || isFlowVsPrice),
		useInitialDataset: getInitialMetricDataset('onChainMcap') != null && !activeFilters && !isFlowVsPrice
	})
	const { chartDataset: flowActiveMcapDataset } = useRwaChartDataset({
		selectedMetric: 'activeMcap',
		initialDataset: getInitialMetricDataset('activeMcap'),
		filteredAssets: aggregateAssets,
		mode: 'total',
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		enabled: isFlowMetric && !isGroupedFlowChart && !isFlowVsPrice && selectedFlowOverlayMetrics.includes('activeMcap'),
		useInitialDataset: getInitialMetricDataset('activeMcap') != null && !activeFilters
	})
	const { chartDataset: flowDefiActiveTvlDataset } = useRwaChartDataset({
		selectedMetric: 'defiActiveTvl',
		initialDataset: getInitialMetricDataset('defiActiveTvl'),
		filteredAssets: aggregateAssets,
		mode: 'total',
		target: chartTarget,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl,
		enabled:
			isFlowMetric && !isGroupedFlowChart && !isFlowVsPrice && selectedFlowOverlayMetrics.includes('defiActiveTvl'),
		useInitialDataset: getInitialMetricDataset('defiActiveTvl') != null && !activeFilters
	})
	const flowOnChainMcapByTimestamp = useMemo(
		() => getRwaTotalMetricByTimestamp(flowOnChainMcapDataset, 'onChainMcap'),
		[flowOnChainMcapDataset]
	)
	const flowActiveMcapByTimestamp = useMemo(
		() => getRwaTotalMetricByTimestamp(flowActiveMcapDataset, 'activeMcap'),
		[flowActiveMcapDataset]
	)
	const flowDefiActiveTvlByTimestamp = useMemo(
		() => getRwaTotalMetricByTimestamp(flowDefiActiveTvlDataset, 'defiActiveTvl'),
		[flowDefiActiveTvlDataset]
	)
	const flowOverlays = useMemo<Array<RWAFlowOverlay>>(
		() =>
			selectedFlowOverlayMetrics.map((metric) => ({
				metric,
				values:
					metric === 'onChainMcap'
						? flowOnChainMcapByTimestamp
						: metric === 'activeMcap'
							? flowActiveMcapByTimestamp
							: flowDefiActiveTvlByTimestamp
			})),
		[selectedFlowOverlayMetrics, flowOnChainMcapByTimestamp, flowActiveMcapByTimestamp, flowDefiActiveTvlByTimestamp]
	)

	const showCharts = overview.assets.length > 1 || isPlatformMode || isFlowMetric

	const { chartInstance: multiSeriesChart2Instance, handleChartReady: handleMultiSeriesChartReady } =
		useChartImageExport()
	const chartMetricLabel = isPerpsView
		? (getRwaPerpsChartMetricOptions().find((option) => option.key === perpsChartMetric)?.label ?? 'Open Interest')
		: isFlowVsPrice
			? 'Flow vs Price'
			: isFlowMetric
				? 'Net Flows'
				: getChartMetricLabel(chartTypeKey)
	const chartMetricOptions: ReadonlyArray<{ key: RWAOverviewChartMetric; label: string }> = isPerpsView
		? getRwaPerpsChartMetricOptions()
		: [
				...getChartMetricOptions(chartMetricAvailability),
				{ key: 'flows' as const, label: definitions.flows.overviewNetFlows.label },
				...(isPlatformMode ? [{ key: 'flowVsPrice' as const, label: definitions.flows.flowVsPrice.label }] : [])
			]
	const exportChartTitle = getRwaExportChartTitle({
		mode,
		metricLabel: chartMetricLabel,
		selectedModeLabel
	})
	const timeSeriesChartFilename = `rwa-time-series-chart-${slug(chartMetricLabel)}-${rwaSlug(selectedModeLabel)}`
	const flowChartSelection = useMemo<RWAFlowChartSelection>(
		() =>
			isFlowVsPrice
				? {
						view: 'flowVsPrice',
						groupBy: flowGroupBy,
						mcapByTimestamp: flowOnChainMcapByTimestamp
					}
				: { view: 'netFlows', groupBy: flowGroupBy, overlays: flowOverlays },
		[flowGroupBy, flowOnChainMcapByTimestamp, flowOverlays, isFlowVsPrice]
	)
	const flowChart = useMemo(
		() =>
			isFlowMetric && flowData ? buildRWAFlowChart({ points: flowData.series, selection: flowChartSelection }) : null,
		[flowChartSelection, flowData, isFlowMetric]
	)
	const flowDefaultStartTimestamp =
		flowGroupBy === 'daily' && flowData ? getRWAFlowDefaultStartTimestamp(flowData.series, 365) : undefined
	const flowVsPriceSummary = useMemo(
		() => (isFlowVsPrice && flowChart ? getRWAFlowVsPriceSummary(flowChart, flowVisibleRange) : null),
		[flowChart, flowVisibleRange, isFlowVsPrice]
	)
	const flowVsPriceBreakdown = useMemo(
		() =>
			isFlowVsPrice && flowAssetRows && flowOnChainMcapAssetRows
				? getRWAFlowVsPriceAssetSummaries(
						flowAssetRows,
						flowOnChainMcapAssetRows,
						aggregateAssets,
						flowGroupBy,
						flowVisibleRange
					)
				: undefined,
		[aggregateAssets, flowAssetRows, flowGroupBy, flowOnChainMcapAssetRows, flowVisibleRange, isFlowVsPrice]
	)
	const isPerpsVolume = isPerpsView && perpsChartMetric === 'volume'
	const chartPeriod = flowQueryState.groupBy
	const selectedTimeSeriesDataset = useMemo(() => {
		if (isFlowMetric || !isTimeSeriesView) return groupedChartDataset
		/* Volume bars stack per group and carry no Total line; the tooltip sums them. */
		const withTotal = isPerpsVolume ? groupedChartDataset : ensureRwaTotalSeries(groupedChartDataset, chartTotalLabel)
		/* One member equal to the Total is one line: a one-asset platform, or a scope with one group. */
		const folded = foldRwaTopSeries(dropRwaRedundantTotal(withTotal), {})
		if (chartView === 'share') return toRwaShareDataset(folded)
		return isPerpsVolume ? groupMultiSeriesBarChartDataset({ dataset: folded, groupBy: chartPeriod }) : folded
	}, [chartPeriod, chartTotalLabel, chartView, groupedChartDataset, isFlowMetric, isPerpsVolume, isTimeSeriesView])
	const timeSeriesCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() =>
			!isTimeSeriesView
				? []
				: isPerpsView
					? buildRwaPerpsChartSeries(selectedTimeSeriesDataset, perpsChartMetric)
					: buildRwaTimeSeriesCharts(selectedTimeSeriesDataset),
		[isPerpsView, isTimeSeriesView, perpsChartMetric, selectedTimeSeriesDataset]
	)
	// One deferred snapshot, so the chart never pairs old rows with new series, share mode or grouping.
	const timeSeriesChart = useMemo(
		() => ({
			dataset: selectedTimeSeriesDataset,
			charts: timeSeriesCharts,
			isShare: chartView === 'share',
			groupBy: isPerpsVolume && chartView !== 'share' ? chartPeriod : undefined
		}),
		[chartPeriod, chartView, isPerpsVolume, selectedTimeSeriesDataset, timeSeriesCharts]
	)
	const deferredTimeSeriesChart = useDeferredValue(timeSeriesChart)

	const chartTypeSwitch = (
		<SegmentedControl<RWAOverviewChartMetric>
			value={selectedChartMetric}
			onValueChange={(key) => {
				if (key === 'openInterest' || key === 'volume') {
					void pushShallowQuery(router, { chartType: getRwaPerpsChartMetricQueryValue(key) })
					return
				}
				if (key === 'flows' || key === 'flowVsPrice') {
					void pushShallowQuery(router, {
						chartType: key,
						flowMode: flowGroupBy === 'daily' ? undefined : flowGroupBy,
						flowOverlays: key === 'flowVsPrice' ? undefined : getRWAFlowOverlayQueryValue(selectedFlowOverlayMetrics)
					})
					return
				}
				void pushShallowQuery(router, {
					chartType: getChartMetricQueryValue(key, chartMetricAvailability),
					flowMode: undefined
				})
			}}
			options={chartMetricOptions.map(({ key, label }) => ({
				value: key,
				label,
				...(key === 'flows' || key === 'flowVsPrice'
					? {
							tooltip:
								key === 'flows'
									? definitions.flows.overviewNetFlows.description
									: definitions.flows.flowVsPrice.description
						}
					: {})
			}))}
			label="Chart type"
			variant="default"
			size="md"
			className="mr-auto max-w-full overflow-x-auto"
		/>
	)
	/* The chart sits in two thirds of the summary grid on platform pages, where
	   the full toolbar no longer fits one line. Rather than let it wrap raggedly,
	   splitting the view and period controls across lines and leaving one control
	   stranded top-right, the metric switch takes a line of its own and the
	   secondary controls right-align beneath it. */
	const chartTypeSwitchRow = isPlatformMode ? <div className="w-full">{chartTypeSwitch}</div> : chartTypeSwitch
	const flowOverlaySelect = (
		<Tooltip content={definitions.flows.marketcapOverlay.description}>
			<Select
				allValues={flowOverlayOptions}
				selectedValues={selectedFlowOverlayMetrics}
				setSelectedValues={(values: Array<string>) => {
					void pushShallowQuery(router, { flowOverlays: getRWAFlowOverlayQueryValue(values) })
				}}
				label="Overlays"
				labelType="smol"
				variant="filter"
				size="md"
			/>
		</Tooltip>
	)

	const handleTreemapNestedByChange = useCallback(
		(nestedBy: RwaTreemapNestedBy) => {
			const nextState = setTreemapNestedBy(chartState, treemapParentGrouping, nestedBy)
			void pushShallowQuery(router, { treemapNestedBy: getTreemapNestedByQueryValue(nextState, treemapParentGrouping) })
		},
		[chartState, router, treemapParentGrouping]
	)
	const chartViewSwitch = (
		<Select
			allValues={chartViewOptions}
			selectedValues={chartView}
			setSelectedValues={(value: string) => {
				const selectedView = chartViewOptions.find((option) => option.key === value)?.key ?? chartView
				void pushShallowQuery(router, { chartView: getChartViewQueryValue(selectedView) })
			}}
			label={chartViewOptions.find(({ key }) => key === chartView)?.name ?? 'Time Series Chart'}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)

	if (!showCharts) return null

	return (
		<>
			{isTimeSeriesView ? (
				<ChartPanel className="flex flex-1 flex-col">
					<ChartPanelToolbar className="justify-end">
						{chartTypeSwitchRow}
						{isFlowMetric || isPerpsVolume ? (
							<SegmentedControl<RWAFlowGrouping>
								value={flowGroupBy}
								onValueChange={(nextFlowMode) => {
									void pushShallowQuery(router, {
										flowMode: getRWAFlowModeQueryValue(nextFlowMode, flowQueryState.view)
									})
								}}
								options={RWA_FLOW_GROUPING_OPTIONS}
								label={isPerpsVolume ? 'Volume period' : 'Flow period'}
								variant="default"
								size="md"
							/>
						) : null}
						{isFlowMetric ? null : chartViewSwitch}
						{isFlowMetric && !isFlowVsPrice && !isGroupedFlowChart ? flowOverlaySelect : null}
						<ChartCsvExportButton
							chartInstance={multiSeriesChart2Instance}
							filename={timeSeriesChartFilename}
							source={{
								type: 'dataset',
								prepare: () => {
									const exportDataset = groupedFlowChart
										? groupedFlowChart.dataset
										: isFlowMetric && flowChart
											? flowChart.dataset
											: deferredTimeSeriesChart.dataset
									const exportGroupBy = groupedFlowChart
										? groupedFlowChart.groupBy
										: isFlowMetric && flowChart
											? flowChart.groupBy
											: (deferredTimeSeriesChart.groupBy ?? 'daily')
									return { ...exportDataset, groupBy: exportGroupBy }
								}
							}}
						/>
						<ChartPngExportButton
							chartInstance={multiSeriesChart2Instance}
							filename={timeSeriesChartFilename}
							title={exportChartTitle}
						/>
					</ChartPanelToolbar>
					{chartNote ? <p className="px-3 pt-2 body-sm text-tertiary">{chartNote}</p> : null}
					{isFlowVsPrice && flowVsPriceSummary ? (
						<RWAFlowVsPriceStrip
							summary={flowVsPriceSummary}
							{...(flowVsPriceBreakdown ? { breakdown: flowVsPriceBreakdown } : {})}
						/>
					) : null}
					{isFlowMetric ? (
						isFlowLoading || (isFlowVsPrice && isFlowMcapLoading) ? (
							<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
								Loading
								<LoadingDots />
							</ChartPanelBodyFallback>
						) : flowError || (isFlowVsPrice && flowMcapError) ? (
							<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
								{flowError instanceof Error
									? flowError.message
									: isFlowVsPrice && flowMcapError
										? flowMcapError
										: 'Failed to load flow data.'}
							</ChartPanelBodyFallback>
						) : groupedFlowChart ? (
							<Suspense fallback={<ChartPanelBodyFallback />}>
								<MultiSeriesChart
									dataset={groupedFlowChart.dataset}
									charts={groupedFlowChart.charts}
									groupBy={groupedFlowChart.groupBy}
									containerClassName="flex-1 min-h-[360px]"
									hideDefaultLegend={false}
									valueSymbol="$"
									onReady={handleMultiSeriesChartReady}
								/>
							</Suspense>
						) : flowChart ? (
							<Suspense fallback={<ChartPanelBodyFallback />}>
								<RWAFlowsChart
									chart={flowChart}
									containerClassName="flex-1 min-h-[360px]"
									{...(flowDefaultStartTimestamp !== undefined
										? { defaultStartTimestamp: flowDefaultStartTimestamp }
										: {})}
									onVisibleRangeChange={handleFlowVisibleRangeChange}
									onReady={handleMultiSeriesChartReady}
								/>
							</Suspense>
						) : (
							<ChartPanelBodyFallback className="body-sm text-secondary">
								No flow data available.
							</ChartPanelBodyFallback>
						)
					) : chartError ? (
						<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
							{chartError}
						</ChartPanelBodyFallback>
					) : isChartLoading ? (
						<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
							Loading
							<LoadingDots />
						</ChartPanelBodyFallback>
					) : (
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={deferredTimeSeriesChart.dataset}
								charts={deferredTimeSeriesChart.charts}
								containerClassName="flex-1 min-h-[360px]"
								hideDefaultLegend={false}
								expandTo100Percent={deferredTimeSeriesChart.isShare}
								showTotalInTooltip={
									!deferredTimeSeriesChart.isShare && !deferredTimeSeriesChart.dataset.dimensions.includes('Total')
								}
								valueSymbol="$"
								{...(deferredTimeSeriesChart.groupBy ? { groupBy: deferredTimeSeriesChart.groupBy } : {})}
								onReady={handleMultiSeriesChartReady}
							/>
						</Suspense>
					)}
				</ChartPanel>
			) : null}
			{isTimeSeriesView ? null : (
				<RWAOverviewBreakdownPanel
					view={chartView}
					axis={treemapParentGrouping}
					metric={chartTypeKey}
					metricLabel={chartMetricLabel}
					groupLabel={chartGroupLabel}
					exportTitle={exportChartTitle}
					filenameSuffix={`${slug(chartMetricLabel)}-${rwaSlug(selectedModeLabel)}`}
					treemapNestedBy={chartState.treemapNestedBy}
					onTreemapNestedByChange={handleTreemapNestedByChange}
					assets={aggregateAssets}
					rankedFilterValues={rankedFilterValues}
					selectedAssetNames={selectedAssetNames}
					selectedCategories={selectedCategories}
					isAssetGroupMode={isAssetGroupMode}
					includeBridgeTvl={includeBridgeTvl}
					toolbarStart={
						<>
							{chartTypeSwitchRow}
							{chartViewSwitch}
						</>
					}
				/>
			)}
		</>
	)
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

export const getAssetChartTarget = (props: IRWAAssetsOverview): RWAAssetChartTarget => {
	if (props.assetGroupSlug) return { kind: 'assetGroup', slug: props.assetGroupSlug }
	if (props.categorySlug) return { kind: 'category', slug: props.categorySlug }
	if (props.platformSlug) return { kind: 'platform', slug: props.platformSlug }
	if (props.chainSlug) return { kind: 'chain', slug: props.chainSlug }
	return { kind: 'all' }
}

const getRwaFlowScope = (target: RWAAssetChartTarget): RWAFlowScope => {
	switch (target.kind) {
		case 'all':
			return { kind: 'overview' }
		case 'assetGroup':
			return { kind: 'assetGroup', slug: target.slug }
		case 'category':
			return { kind: 'category', slug: target.slug }
		case 'platform':
			return { kind: 'platform', slug: target.slug }
		case 'chain':
			return { kind: 'chain', slug: target.slug }
		default:
			return assertNever(target)
	}
}

const getRwaTotalMetricByTimestamp = (
	dataset: RWAPositionalChartDataset,
	metric: RWAChartMetricKey
): Map<number, number | null> => {
	const totalLabel = getRwaChartTotalLabel(metric)
	const totalIndex = dataset.dimensions.indexOf(totalLabel)
	if (totalIndex === -1) return new Map()

	const values = new Map<number, number | null>()
	for (const row of dataset.source) {
		const value = row[totalIndex]
		values.set(row[0], value ?? null)
	}
	return values
}

const getRwaExportChartTitle = ({
	mode,
	metricLabel,
	selectedModeLabel
}: {
	mode: RWAOverviewMode
	metricLabel: string
	selectedModeLabel: string
}) => {
	if (mode === 'assetGroup') return `RWA ${metricLabel} in ${selectedModeLabel}`
	if (mode === 'category') return `RWA ${metricLabel} by Category`
	if (!selectedModeLabel || selectedModeLabel === 'All') return `RWA ${metricLabel}`
	return `RWA ${metricLabel} on ${selectedModeLabel}`
}
