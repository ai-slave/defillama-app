import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { Select } from '~/components/Select/Select'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { CHART_FILL, ChartPanel, ChartPanelBodyError, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { mergeFailedReads } from '~/utils/query'
import { pushShallowQuery, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { IRWAAssetsOverview, RWAAssetChartTarget, RWAChartMetricKey } from './api.types'
import { getRwaChartTotalLabel } from './chartAggregation'
import {
	getRwaChartGroupLabel,
	getRwaChartViewOptions,
	getRwaFlowSplitBy,
	getRwaSpotChartSource,
	type RWASpotChartMetric
} from './chartBreakdown'
import type { RWAPositionalChartDataset } from './chartDataset'
import {
	dropRwaRedundantTotal,
	ensureRwaTotalSeries,
	foldRwaTopSeries,
	RWA_MAX_CHART_SERIES,
	toRwaShareDataset
} from './chartFold'
import { getRwaOverviewChartMetricOptions, resolveRwaChartQueryState, type RwaChartQueryState } from './chartQueryState'
import { buildRwaTimeSeriesCharts } from './chartSeries'
import {
	getChartMetricLabel,
	getChartMetricQueryValue,
	getChartViewQueryValue,
	getTreemapNestedByQueryValue,
	setTreemapNestedBy,
	type RwaTreemapNestedBy
} from './chartState'
import type { RWAOverviewMode } from './constants'
import { getRwaOverviewDashboardChart } from './dashboard/rwaDashboardChart'
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
	getRWAFlowVisibleRange,
	getRWAFlowVsPriceSummary,
	parseRWAFlowOverlayMetrics,
	RWA_FLOW_GROUPING_OPTIONS,
	type RWAFlowChartSelection,
	type RWAFlowGrouping,
	type RWAFlowOverlay,
	type RWAFlowZoom
} from './flows'
import { type RWAFlowScope, useRWAFlowSeries } from './flows.hooks'
import { sumRwaFlowSplit } from './flowSplit'
import { useRwaChartDataset } from './hooks'
import type { RWAPageKind } from './layout/pageLayout'
import { RWAOverviewBreakdownPanel } from './OverviewBreakdownPanel'
import { getRwaCsvFileName } from './table/csv'
import type { RWAGroupBy } from './table/groupBy'
import { useRwaChainChartDataset } from './useChainChartDataset'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const RWAFlowsChart = lazy(() => import('./FlowsChart').then((module) => ({ default: module.RWAFlowsChart })))

export type RWAOverviewChartPanelProps = {
	overview: IRWAAssetsOverview
	mode: RWAOverviewMode
	selectedModeLabel: string
	pageKind: RWAPageKind
	pageSlug: string | null
	aggregateAssets: IRWAAssetsOverview['assets']
	/** The table's Group by, the one axis every chart follows. */
	groupBy: RWAGroupBy
	selectedCategories: Array<string>
	includeStablecoins: boolean
	includeGovernance: boolean
	includeBridgeTvl: boolean
	/** A scope flag or a filter differs from the page defaults, so the build-time datasets do not apply. */
	activeFilters: boolean
}

/**
 * The chart state the URL and the page settle: a hook on purpose, since the compiler treats a hook's return as
 * frozen and lets the memoized folds below depend on these values.
 */
function useRwaChartQueryState(...args: Parameters<typeof resolveRwaChartQueryState>): RwaChartQueryState {
	return resolveRwaChartQueryState(...args)
}

/** The overview chart panel: the metric switch, the view select, the exports and the chart body. */
export function RWAOverviewChartPanel({
	overview,
	mode,
	selectedModeLabel,
	pageKind,
	pageSlug,
	aggregateAssets,
	groupBy,
	selectedCategories,
	includeStablecoins,
	includeGovernance,
	includeBridgeTvl,
	activeFilters
}: RWAOverviewChartPanelProps) {
	const router = useRouter()
	const isPlatformMode = mode === 'platform'
	const chartMetricAvailability = overview.chartMetricAvailability
	const { flowQueryState, treemapParentGrouping, chartState, selectedChartMetric, chartView, chartTotalLabel } =
		useRwaChartQueryState(router.query, {
			isPlatformMode,
			groupBy,
			availability: chartMetricAvailability
		})
	const isFlowVsPrice = flowQueryState.view === 'flowVsPrice'
	const [flowZoom, setFlowZoom] = useState<RWAFlowZoom | null>(null)
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
		failedRead: flowFailedRead
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
				? buildRWAFlowRotationChart(flowSplitPoints, flowGroupBy, {
						maxSeries: RWA_MAX_CHART_SERIES
					})
				: null,
		[flowGroupBy, flowSplitPoints, isGroupedFlowChart]
	)
	const selectedFlowOverlayMetrics = useMemo(
		() => parseRWAFlowOverlayMetrics(toNonEmptyArrayParam(router.query.flowOverlays), chartMetricAvailability),
		[router.query.flowOverlays, chartMetricAvailability]
	)
	const flowOverlayOptions = getRWAFlowOverlayOptions(chartMetricAvailability)
	const isSpotTimeSeries = !isFlowMetric && isTimeSeriesView
	/* A build-time dataset applies while the page sits at its defaults; its Total line serves every Group by. */
	const hasInitialMetricDataset = getInitialMetricDataset(chartTypeKey) != null && !activeFilters
	const useInitialGroupedDataset = initialGroupedDataset != null && !activeFilters
	/* Under Group by Chain the per-asset fold only supplies the page total the chain lines follow. */
	const {
		chartDataset: assetChartDataset,
		isChartLoading: isAssetChartLoading,
		failedRead: assetChartFailedRead
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
		failedRead: chainChartFailedRead
	} = useRwaChainChartDataset({
		metric: chartTypeKey,
		assets: aggregateAssets,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl,
		total: assetChartDataset,
		enabled: isSpotTimeSeries && isChainSource && !useInitialGroupedDataset
	})
	const groupedChartDataset = isChainSource
		? useInitialGroupedDataset && initialGroupedDataset
			? initialGroupedDataset.dataset
			: chainChartDataset
		: assetChartDataset
	const isChartLoading = isAssetChartLoading || isChainChartLoading
	const chartFailedRead = mergeFailedReads([assetChartFailedRead, chainChartFailedRead])
	const {
		chartDataset: flowOnChainMcapDataset,
		assetRows: flowOnChainMcapAssetRows,
		isChartLoading: isFlowMcapLoading,
		failedRead: flowMcapFailedRead
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
	// Only Flow vs Price cannot draw without the on-chain mcap, so only there does its failure fail the chart.
	const flowChartFailedRead = mergeFailedReads([flowFailedRead, isFlowVsPrice ? flowMcapFailedRead : null])
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

	const { chartInstance: multiSeriesChart2Instance, handleChartReady: handleMultiSeriesChartReady } =
		useGetChartInstance()
	const chartMetricLabel = isFlowVsPrice
		? 'Flow vs Price'
		: isFlowMetric
			? 'Net Flows'
			: getChartMetricLabel(chartTypeKey)
	const chartMetricOptions = getRwaOverviewChartMetricOptions({
		isPlatformMode,
		availability: chartMetricAvailability
	})
	const exportChartTitle = getRwaExportChartTitle({
		mode,
		metricLabel: chartMetricLabel,
		selectedModeLabel
	})
	const chartFilename = getRwaCsvFileName(pageKind, pageSlug, 'chart').replace(/\.csv$/, '')
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
			isFlowMetric && flowData
				? buildRWAFlowChart({
						points: flowData.series,
						selection: flowChartSelection
					})
				: null,
		[flowChartSelection, flowData, isFlowMetric]
	)
	const flowDefaultStartTimestamp =
		flowGroupBy === 'daily' && flowData ? getRWAFlowDefaultStartTimestamp(flowData.series, 365) : undefined
	const flowVisibleRange = flowChart ? getRWAFlowVisibleRange(flowChart, flowZoom, flowDefaultStartTimestamp) : null
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
	const selectedTimeSeriesDataset = useMemo(() => {
		if (isFlowMetric || !isTimeSeriesView) return groupedChartDataset
		/* One member equal to the Total is one line: a one-asset platform, or a scope with one group. The ten
		   largest draw their own series and the rest fold into Others. */
		const folded = foldRwaTopSeries(
			dropRwaRedundantTotal(ensureRwaTotalSeries(groupedChartDataset, chartTotalLabel)),
			{}
		)
		return chartView === 'share' ? toRwaShareDataset(folded) : folded
	}, [chartTotalLabel, chartView, groupedChartDataset, isFlowMetric, isTimeSeriesView])
	const timeSeriesCharts = useMemo(
		() => (isTimeSeriesView ? buildRwaTimeSeriesCharts(selectedTimeSeriesDataset) : []),
		[isTimeSeriesView, selectedTimeSeriesDataset]
	)
	// One deferred snapshot, so the chart never pairs old rows with new series or share mode.
	const timeSeriesChart = useMemo(
		() => ({ dataset: selectedTimeSeriesDataset, charts: timeSeriesCharts, isShare: chartView === 'share' }),
		[chartView, selectedTimeSeriesDataset, timeSeriesCharts]
	)
	const deferredTimeSeriesChart = useDeferredValue(timeSeriesChart)

	const chartTypeSwitch = (
		<SegmentedControl<RWASpotChartMetric>
			value={selectedChartMetric}
			onValueChange={(key) => {
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
					void pushShallowQuery(router, {
						flowOverlays: getRWAFlowOverlayQueryValue(values)
					})
				}}
				label="Overlays"
				labelType="smol"
				variant="filter"
				size="md"
			/>
		</Tooltip>
	)

	const periodSwitch = (
		<SegmentedControl<RWAFlowGrouping>
			value={flowGroupBy}
			onValueChange={(nextFlowMode) => {
				void pushShallowQuery(router, {
					flowMode: getRWAFlowModeQueryValue(nextFlowMode, flowQueryState.view)
				})
			}}
			options={RWA_FLOW_GROUPING_OPTIONS}
			label="Flow period"
			variant="default"
			size="md"
		/>
	)

	const handleTreemapNestedByChange = useCallback(
		(nestedBy: RwaTreemapNestedBy) => {
			const nextState = setTreemapNestedBy(chartState, treemapParentGrouping, nestedBy)
			void pushShallowQuery(router, {
				treemapNestedBy: getTreemapNestedByQueryValue(nextState, treemapParentGrouping)
			})
		},
		[chartState, router, treemapParentGrouping]
	)
	const chartViewSwitch = (
		<Select
			heading="Chart view"
			allValues={chartViewOptions}
			selectedValues={chartView}
			setSelectedValues={(value: string) => {
				const selectedView = chartViewOptions.find((option) => option.key === value)?.key ?? chartView
				void pushShallowQuery(router, {
					chartView: getChartViewQueryValue(selectedView)
				})
			}}
			label={chartViewOptions.find(({ key }) => key === chartView)?.name ?? 'Time Series Chart'}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)

	/* Pins the chart to a Pro dashboard; nothing renders when no dashboard card draws the current state. */
	const dashboardChart = getRwaOverviewDashboardChart({
		metric: selectedChartMetric,
		chartView,
		treemapNestedBy: chartState.treemapNestedBy,
		groupBy,
		target: chartTarget,
		chainName: overview.chainSlug ? overview.selectedChain : null,
		activeFilters,
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl
	})
	const addToDashboardButton = dashboardChart ? <AddToDashboardButton chartConfig={dashboardChart} smol /> : null

	return (
		<>
			{isTimeSeriesView ? (
				<ChartPanel className="flex flex-1 flex-col">
					<ChartPanelToolbar>
						{chartTypeSwitchRow}
						{isFlowMetric ? periodSwitch : null}
						{isFlowMetric ? null : chartViewSwitch}
						{isFlowMetric && !isFlowVsPrice && !isGroupedFlowChart ? flowOverlaySelect : null}
						{addToDashboardButton}
						<ChartCsvExportButton
							chartInstance={multiSeriesChart2Instance}
							filename={chartFilename}
							disabled={isFlowMetric ? isFlowLoading : isChartLoading}
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
											: 'daily'
									return { ...exportDataset, groupBy: exportGroupBy }
								}
							}}
						/>
						<ChartPngExportButton
							chartInstance={multiSeriesChart2Instance}
							filename={chartFilename}
							title={exportChartTitle}
						/>
					</ChartPanelToolbar>
					{isFlowVsPrice && flowVsPriceSummary ? (
						<RWAFlowVsPriceStrip
							summary={flowVsPriceSummary}
							{...(flowVsPriceBreakdown ? { breakdown: flowVsPriceBreakdown } : {})}
						/>
					) : null}
					{isFlowMetric ? (
						flowChartFailedRead ? (
							<ChartPanelBodyError retry={flowChartFailedRead}>Failed to load flow data.</ChartPanelBodyError>
						) : isFlowLoading || (isFlowVsPrice && isFlowMcapLoading) ? (
							<ChartPanelBodyFallback role="status" aria-live="polite">
								<LoadingIndicator />
							</ChartPanelBodyFallback>
						) : groupedFlowChart ? (
							<Suspense fallback={<ChartPanelBodyFallback />}>
								<MultiSeriesChart
									dataset={groupedFlowChart.dataset}
									charts={groupedFlowChart.charts}
									groupBy={groupedFlowChart.groupBy}
									containerClassName={CHART_FILL}
									hideDefaultLegend={false}
									valueSymbol="$"
									onReady={handleMultiSeriesChartReady}
								/>
							</Suspense>
						) : flowChart ? (
							<Suspense fallback={<ChartPanelBodyFallback />}>
								<RWAFlowsChart
									chart={flowChart}
									containerClassName={CHART_FILL}
									{...(flowDefaultStartTimestamp !== undefined
										? { defaultStartTimestamp: flowDefaultStartTimestamp }
										: {})}
									onVisibleRangeChange={(range) => setFlowZoom({ source: flowChart.dataset.source, range })}
									onReady={handleMultiSeriesChartReady}
								/>
							</Suspense>
						) : (
							<ChartPanelBodyFallback className="body-sm text-tertiary">No flow data available.</ChartPanelBodyFallback>
						)
					) : chartFailedRead ? (
						<ChartPanelBodyError retry={chartFailedRead}>Failed to load chart data.</ChartPanelBodyError>
					) : isChartLoading ? (
						<ChartPanelBodyFallback role="status" aria-live="polite">
							<LoadingIndicator />
						</ChartPanelBodyFallback>
					) : (
						<Suspense fallback={<ChartPanelBodyFallback />}>
							<MultiSeriesChart
								dataset={deferredTimeSeriesChart.dataset}
								charts={deferredTimeSeriesChart.charts}
								containerClassName={CHART_FILL}
								hideDefaultLegend={false}
								expandTo100Percent={deferredTimeSeriesChart.isShare}
								showTotalInTooltip={
									!deferredTimeSeriesChart.isShare && !deferredTimeSeriesChart.dataset.dimensions.includes('Total')
								}
								valueSymbol="$"
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
					filename={chartFilename}
					treemapNestedBy={chartState.treemapNestedBy}
					onTreemapNestedByChange={handleTreemapNestedByChange}
					assets={aggregateAssets}
					selectedCategories={selectedCategories}
					includeBridgeTvl={includeBridgeTvl}
					toolbarStart={
						<>
							{chartTypeSwitchRow}
							{chartViewSwitch}
							{addToDashboardButton}
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

const getAssetChartTarget = (props: IRWAAssetsOverview): RWAAssetChartTarget => {
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
