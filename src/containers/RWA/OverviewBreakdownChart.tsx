import type { ParsedUrlQuery } from 'node:querystring'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { ExcludeQueryKey } from '~/components/Select/types'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingDots } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { fetchJson } from '~/utils/async'
import { getErrorMessage } from '~/utils/error'
import { isTrueQueryParam, pushShallowQuery, readSingleQueryValue, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { RWAChartMetricKey, RWAOverviewBreakdownRouteRequest, RWAOverviewPage } from './api.types'
import {
	getRwaChartSeriesColorSlots,
	getRwaReservedSeriesColorSlot,
	isRwaTotalSeriesLabel,
	sortRwaChartSeriesLabels
} from './chartAggregation'
import type { RWAPositionalChartDataset } from './chartDataset'
import { definitions } from './definitions'
import { buildRWAFlowRotationChart, parseRWAFlowGrouping, type RWAFlowGrouping } from './flows'
import { useRWAFlowOverviewSplitWithFilters } from './flows.hooks'
import {
	buildRWAFlowTreemap,
	buildRWAFlowTreemapWindowData,
	getRWAFlowTreemapPeriodLabel,
	getRWAFlowTreemapSizeLabel,
	parseRWAFlowTreemapSizeMetric,
	parseRWAFlowTreemapView,
	prepareRWAFlowTreemapCsv,
	RWA_FLOW_TREEMAP_SIZE_OPTIONS,
	RWA_FLOW_TREEMAP_VIEW_OPTIONS,
	type RWAFlowTreemapSizeRow
} from './flowTreemap'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const RWAFlowTreemapChart = lazy(() =>
	import('./FlowTreemapChart').then((module) => ({ default: module.RWAFlowTreemapChart }))
)

type RWAOverviewBreakdownChartType = RWAChartMetricKey | 'flows'

const CHART_TYPE_OPTIONS: Array<{ key: RWAOverviewBreakdownChartType; label: string }> = [
	{ key: 'activeMcap', label: 'Active Mcap' },
	{ key: 'onChainMcap', label: 'Onchain Mcap' },
	{ key: 'defiActiveTvl', label: 'DeFi Active TVL' },
	{ key: 'flows', label: definitions.flows.overviewNetFlows.label }
]

const DEFAULT_CHART_TYPE: RWAChartMetricKey = 'activeMcap'
const EMPTY_DATASET: RWAPositionalChartDataset = { source: [], dimensions: ['timestamp'] }
const EMPTY_MULTI_SERIES_DATASET: MultiSeriesChartDataset = { source: [], dimensions: ['timestamp'] }
const STACKS_QUERY_KEY = 'stacks'
const EXCLUDE_STACKS_QUERY_KEY: ExcludeQueryKey = 'excludeStacks'
const MAX_VISIBLE_TIME_SERIES = 30
const EMPTY_FLOW_TREEMAP = { nodes: [], excludedSizeCount: 0 }
function assertNever(value: never): never {
	throw new Error(`Unknown page kind: ${value}`)
}

function getOverviewBreakdownFlowGrouping(value: string | undefined): RWAFlowGrouping {
	if (value == null) return 'monthly'
	const grouping = parseRWAFlowGrouping(value)
	return grouping === value ? grouping : 'monthly'
}

function isChartMetricKey(value: string): value is RWAChartMetricKey {
	return value === 'activeMcap' || value === 'onChainMcap' || value === 'defiActiveTvl'
}

function getFlowSplitBy(page: RWAOverviewPage) {
	switch (page.kind) {
		case 'assetGroup':
			return 'assetGroup' as const
		case 'category':
		case 'platform':
		case 'chain':
			return page.kind
		default:
			return assertNever(page)
	}
}

export function getOverviewBreakdownRequestState(
	page: RWAOverviewPage,
	chartType: RWAChartMetricKey,
	query: ParsedUrlQuery
) {
	const includeStablecoin = isTrueQueryParam(query.includeStablecoins)
	const includeGovernance = isTrueQueryParam(query.includeGovernance)
	const includeBridgeTvl = query.includeBridgeTvl != null ? isTrueQueryParam(query.includeBridgeTvl) : true
	const isDefaultState =
		chartType === DEFAULT_CHART_TYPE && !includeStablecoin && !includeGovernance && includeBridgeTvl

	switch (page.kind) {
		case 'chain':
			return {
				request: {
					breakdown: 'chain',
					key: chartType,
					includeStablecoin,
					includeGovernance,
					includeBridgeTvl
				} satisfies RWAOverviewBreakdownRouteRequest,
				isDefaultState
			}
		case 'platform':
			return {
				request: {
					breakdown: 'platform',
					key: chartType,
					includeStablecoin,
					includeGovernance,
					includeBridgeTvl
				} satisfies RWAOverviewBreakdownRouteRequest,
				isDefaultState
			}
		case 'category':
			return {
				request: {
					breakdown: 'category',
					key: chartType,
					includeStablecoin,
					includeGovernance,
					includeBridgeTvl
				} satisfies RWAOverviewBreakdownRouteRequest,
				isDefaultState
			}
		case 'assetGroup':
			return {
				request: {
					breakdown: 'assetGroup',
					key: chartType,
					includeStablecoin,
					includeGovernance,
					includeBridgeTvl
				} satisfies RWAOverviewBreakdownRouteRequest,
				isDefaultState
			}
		default:
			return assertNever(page)
	}
}

function fetchOverviewBreakdownDataset(request: RWAOverviewBreakdownRouteRequest): Promise<RWAPositionalChartDataset> {
	const searchParams = new URLSearchParams({
		breakdown: request.breakdown,
		key: request.key
	})

	if (request.includeStablecoin) searchParams.set('includeStablecoin', 'true')
	if (request.includeGovernance) searchParams.set('includeGovernance', 'true')
	searchParams.set('includeBridgeTvl', String(request.includeBridgeTvl))

	return fetchJson<RWAPositionalChartDataset>(`/api/public/rwa/overview-breakdown?${searchParams.toString()}`)
}

export function buildOverviewBreakdownChartSeries(dimensions: Array<string>): Array<MultiSeriesChartSeriesConfig> {
	const seriesDimensions = sortRwaChartSeriesLabels(dimensions.filter((dimension) => dimension !== 'timestamp'))
	const colorSlots = getRwaChartSeriesColorSlots(seriesDimensions)

	return seriesDimensions.map((name) => {
		const reservedColorSlot = getRwaReservedSeriesColorSlot(name)
		const colorSlot = colorSlots[name]
		if (colorSlot === undefined) throw new Error(`Missing RWA chart color slot for "${name}"`)
		const isTotalSeries = isRwaTotalSeriesLabel(name)

		return {
			type: 'line',
			name,
			encode: { x: 0, y: dimensions.indexOf(name) },
			color: CHART_COLORS[colorSlot % CHART_COLORS.length] ?? CHART_COLORS[0],
			...(reservedColorSlot !== null
				? {
						hideAreaStyle: true,
						...(isTotalSeries ? { excludeFromTooltipTotal: true } : {})
					}
				: {})
		}
	})
}

export function getOverviewBreakdownChartDatasetForSelectedStacks(
	dataset: MultiSeriesChartDataset,
	selectedStacks: Array<string>,
	stackOptions: Array<string>
): MultiSeriesChartDataset {
	if (selectedStacks.length === 0 || selectedStacks.length === stackOptions.length) return dataset
	const selectedDimensionIndexes = selectedStacks.map((stack) => dataset.dimensions.indexOf(stack))

	for (const [index, row] of dataset.source.entries()) {
		for (const dimensionIndex of selectedDimensionIndexes) {
			if (dimensionIndex >= 0 && row[dimensionIndex] != null) {
				return {
					...dataset,
					source: dataset.source.slice(index)
				}
			}
		}
	}

	return dataset
}

export function RWAOverviewBreakdownChart({
	page,
	initialChartDataset,
	stackLabel,
	treemapSizeRows = []
}: {
	page: RWAOverviewPage
	initialChartDataset: RWAPositionalChartDataset
	stackLabel: string
	treemapSizeRows?: Array<RWAFlowTreemapSizeRow>
}) {
	const router = useRouter()
	const chartTypeQuery = readSingleQueryValue(router.query.chartType)
	const chartType: RWAOverviewBreakdownChartType =
		chartTypeQuery === 'flows'
			? 'flows'
			: chartTypeQuery && isChartMetricKey(chartTypeQuery)
				? chartTypeQuery
				: DEFAULT_CHART_TYPE
	const isFlowChart = chartType === 'flows'
	const flowFrequency = getOverviewBreakdownFlowGrouping(readSingleQueryValue(router.query.flowRotationFrequency))
	const flowChartView = parseRWAFlowTreemapView(readSingleQueryValue(router.query.flowRotationView))
	const isFlowHeatmap = isFlowChart && flowChartView === 'heatmap'
	const flowTreemapSizeMetric = parseRWAFlowTreemapSizeMetric(
		readSingleQueryValue(router.query.flowHeatmapSize) ?? readSingleQueryValue(router.query.flowTreemapSize)
	)
	const metricChartType = isFlowChart ? DEFAULT_CHART_TYPE : chartType
	const { request, isDefaultState } = getOverviewBreakdownRequestState(page, metricChartType, router.query)
	const { data, isLoading, error } = useQuery({
		queryKey: [
			'rwa-overview-breakdown',
			request.breakdown,
			request.key,
			request.includeStablecoin,
			request.includeGovernance,
			request.includeBridgeTvl
		],
		queryFn: () => fetchOverviewBreakdownDataset(request),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !isFlowChart && !isDefaultState
	})
	const flowSplitBy = getFlowSplitBy(page)
	const {
		data: flowData,
		isLoading: isFlowLoading,
		error: flowError
	} = useRWAFlowOverviewSplitWithFilters(flowSplitBy, request.includeStablecoin, request.includeGovernance, isFlowChart)
	const flowChart = useMemo(
		() => (isFlowChart && !isFlowHeatmap ? buildRWAFlowRotationChart(flowData ?? [], flowFrequency) : null),
		[flowData, flowFrequency, isFlowChart, isFlowHeatmap]
	)
	const rawDataset = isDefaultState ? initialChartDataset : (data ?? EMPTY_DATASET)
	const dataset = isFlowChart ? (flowChart?.dataset ?? EMPTY_MULTI_SERIES_DATASET) : rawDataset
	const showLoadingState = isFlowChart ? isFlowLoading : !isDefaultState && isLoading
	const chartError = isFlowChart ? flowError : error
	const flowTreemapWindow = useMemo(
		() => (isFlowHeatmap ? buildRWAFlowTreemapWindowData(flowData ?? [], flowFrequency) : null),
		[flowData, flowFrequency, isFlowHeatmap]
	)
	const stackOptions = useMemo(() => {
		const options = isFlowHeatmap
			? [...(flowTreemapWindow?.orderedNames ?? [])]
			: dataset.dimensions.filter((dimension) => dimension !== 'timestamp')
		if (!isFlowHeatmap) return options
		const available = new Set(options)
		for (const row of treemapSizeRows) {
			if (!available.has(row.name)) {
				available.add(row.name)
				options.push(row.name)
			}
		}
		return options
	}, [dataset.dimensions, flowTreemapWindow?.orderedNames, isFlowHeatmap, treemapSizeRows])
	const chartSeries = useMemo(
		() => (isFlowChart ? (flowChart?.charts ?? []) : buildOverviewBreakdownChartSeries(dataset.dimensions)),
		[dataset.dimensions, flowChart?.charts, isFlowChart]
	)
	const defaultSelectedStacks = useMemo(
		() => (isFlowHeatmap ? stackOptions : chartSeries.slice(0, MAX_VISIBLE_TIME_SERIES).map((series) => series.name)),
		[chartSeries, isFlowHeatmap, stackOptions]
	)
	const selectedStacksQ = router.query[STACKS_QUERY_KEY]
	const excludeStacksQ = router.query[EXCLUDE_STACKS_QUERY_KEY]
	const selectedStacks = useMemo(() => {
		if (stackOptions.length === 0) return []
		const availableStacks = new Set(stackOptions)
		const limitTimeSeries = (values: Array<string>) =>
			isFlowHeatmap ? values : values.slice(0, MAX_VISIBLE_TIME_SERIES)
		if (selectedStacksQ === 'None') return []
		if (selectedStacksQ != null) {
			return limitTimeSeries(toNonEmptyArrayParam(selectedStacksQ).filter((stack) => availableStacks.has(stack)))
		}

		const excludedStacksSet = new Set(
			toNonEmptyArrayParam(excludeStacksQ).filter((stack) => availableStacks.has(stack))
		)
		if (excludedStacksSet.size === 0) return defaultSelectedStacks
		return limitTimeSeries(stackOptions.filter((stack) => !excludedStacksSet.has(stack)))
	}, [defaultSelectedStacks, excludeStacksQ, isFlowHeatmap, selectedStacksQ, stackOptions])
	const selectedStacksSet = useMemo(() => new Set(selectedStacks), [selectedStacks])
	const selectedDataset = useMemo(
		() => getOverviewBreakdownChartDatasetForSelectedStacks(dataset, selectedStacks, stackOptions),
		[dataset, selectedStacks, stackOptions]
	)
	const flowTreemap = useMemo(
		() =>
			flowTreemapWindow
				? buildRWAFlowTreemap({
						flows: flowTreemapWindow.flows,
						sizeRows: treemapSizeRows,
						sizeMetric: flowTreemapSizeMetric,
						selectedNames: selectedStacksSet
					})
				: EMPTY_FLOW_TREEMAP,
		[flowTreemapWindow, flowTreemapSizeMetric, selectedStacksSet, treemapSizeRows]
	)
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()
	const flowTreemapSizeLabel = getRWAFlowTreemapSizeLabel(flowTreemapSizeMetric)
	const exportFilename = `rwa-overview-breakdown-${chartType}-${isFlowChart ? flowChartView : 'time-series'}`
	const prepareCompleteFlowTreemapCsv = () => {
		const completeTreemap = flowTreemapWindow
			? buildRWAFlowTreemap({
					flows: flowTreemapWindow.flows,
					sizeRows: treemapSizeRows,
					sizeMetric: flowTreemapSizeMetric,
					selectedNames: new Set(stackOptions)
				})
			: EMPTY_FLOW_TREEMAP
		return prepareRWAFlowTreemapCsv({
			nodes: completeTreemap.nodes,
			sizeMetric: flowTreemapSizeMetric,
			groupBy: flowFrequency,
			filename: exportFilename
		})
	}

	const onSelectChartType = (nextChartType: RWAOverviewBreakdownChartType) => {
		void pushShallowQuery(router, { chartType: nextChartType === DEFAULT_CHART_TYPE ? undefined : nextChartType })
	}

	return (
		<ChartPanel>
			<ChartPanelToolbar className="justify-end">
				<SegmentedControl
					value={chartType}
					onValueChange={onSelectChartType}
					options={CHART_TYPE_OPTIONS.map(({ key, label }) => ({
						value: key,
						label,
						...(key === 'flows' ? { tooltip: definitions.flows.overviewNetFlows.description } : {})
					}))}
					label="Chart type"
					variant="default"
					size="md"
					className="mr-auto"
				/>
				{isFlowChart ? (
					<Select
						allValues={RWA_FLOW_TREEMAP_VIEW_OPTIONS}
						selectedValues={flowChartView}
						setSelectedValues={(view: string) => {
							void pushShallowQuery(router, { flowRotationView: view === 'bar' ? undefined : view })
						}}
						label={flowChartView === 'heatmap' ? 'Heatmap Chart' : 'Bar Chart'}
						labelType="none"
						variant="filter"
						size="md"
					/>
				) : null}
				{isFlowHeatmap ? (
					<Select
						allValues={RWA_FLOW_TREEMAP_SIZE_OPTIONS}
						selectedValues={flowTreemapSizeMetric}
						setSelectedValues={(metric: string) => {
							void pushShallowQuery(router, {
								flowHeatmapSize: metric === 'onChainMcap' ? undefined : metric,
								flowTreemapSize: undefined
							})
						}}
						label={`Size: ${flowTreemapSizeLabel}`}
						labelType="none"
						variant="filter"
						size="md"
					/>
				) : null}
				{isFlowChart ? (
					<ChartGroupingSelector
						value={flowFrequency}
						onValueChange={(nextFrequency) => {
							void pushShallowQuery(router, {
								flowRotationFrequency: nextFrequency === 'monthly' ? undefined : nextFrequency
							})
						}}
						options={DWMC_GROUPING_OPTIONS_LOWERCASE}
					/>
				) : null}
				{stackOptions.length > 1 ? (
					<SelectWithCombobox
						allValues={stackOptions}
						selectedValues={selectedStacks}
						includeQueryKey={STACKS_QUERY_KEY}
						excludeQueryKey={EXCLUDE_STACKS_QUERY_KEY}
						defaultSelectedValues={defaultSelectedStacks}
						label={stackLabel}
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				{isFlowHeatmap ? <ChartRestoreButton chartInstance={exportChartInstance} /> : null}
				<ChartExportButtons
					chartInstance={exportChartInstance}
					filename={exportFilename}
					title={`RWA ${CHART_TYPE_OPTIONS.find((option) => option.key === chartType)?.label ?? 'Breakdown'}`}
					smol
					csvSource={
						isFlowHeatmap
							? {
									type: 'prepare-csv',
									prepare: prepareCompleteFlowTreemapCsv
								}
							: isFlowChart
								? {
										type: 'dataset',
										prepare: () => buildRWAFlowRotationChart(flowData ?? [], flowFrequency, { allSeries: true }).dataset
									}
								: { type: 'dataset', prepare: () => dataset }
					}
					pngProfile={isFlowHeatmap ? 'treemapNormalized' : undefined}
				/>
			</ChartPanelToolbar>
			{chartError ? (
				<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
					{getErrorMessage(chartError)}
				</ChartPanelBodyFallback>
			) : showLoadingState ? (
				<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
					Loading
					<LoadingDots />
				</ChartPanelBodyFallback>
			) : isFlowHeatmap && flowTreemap.nodes.length === 0 ? (
				<ChartPanelBodyFallback className="body-sm text-secondary">
					No sized net-flow data available.
				</ChartPanelBodyFallback>
			) : (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					{isFlowHeatmap ? (
						<>
							<RWAFlowTreemapChart
								nodes={flowTreemap.nodes}
								sizeLabel={flowTreemapSizeLabel}
								periodLabel={getRWAFlowTreemapPeriodLabel(flowFrequency)}
								excludedSizeCount={flowTreemap.excludedSizeCount}
								onReady={handleChartReady}
							/>
						</>
					) : (
						<MultiSeriesChart
							dataset={selectedDataset}
							charts={chartSeries}
							hideDefaultLegend={false}
							showTotalInTooltip={!dataset.dimensions.some(isRwaTotalSeriesLabel)}
							{...(isFlowChart ? { groupBy: flowFrequency } : {})}
							selectedCharts={selectedStacksSet}
							onReady={handleChartReady}
						/>
					)}
				</Suspense>
			)}
		</ChartPanel>
	)
}
