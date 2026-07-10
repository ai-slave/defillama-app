import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ButtonStyled/ChartExportButtons'
import { ChartGroupingSelector, DWM_GROUPING_OPTIONS_LOWERCASE } from '~/components/ECharts/ChartGroupingSelector'
import type { MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import { groupMultiSeriesBarChartDataset } from '~/components/ECharts/utils'
import { SegmentedControl } from '~/components/SegmentedControl'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { type ExcludeQueryKey } from '~/components/Select/types'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingDots } from '~/ui/Loaders'
import { fetchJson } from '~/utils/async'
import { getErrorMessage } from '~/utils/error'
import { pushShallowQuery, readSingleQueryValue, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { RWAChartDataset } from '../chartDataset'
import { getRWAPerpsVolumeGroupByQueryValue, parseRWAPerpsVolumeGroupBy } from './chartState'
import { perpsDefinitions as d } from './definitions'
import {
	appendRWAPerpsTimeSeriesDatasetTotal,
	groupRWAPerpsTimeSeriesDataset,
	hasEnoughTimeSeriesHistory
} from './queries'
import type { IRWAPerpsOverviewBreakdownRequest, RWAPerpsChartMetricKey, RWAPerpsTimeSeriesMode } from './types'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

const CHART_TYPE_OPTIONS: Array<{ key: RWAPerpsChartMetricKey; label: string }> = [
	{ key: 'openInterest', label: d.openInterest.label },
	{ key: 'volume24h', label: 'Volume' },
	{ key: 'markets', label: d.markets.label }
]

const VALID_CHART_TYPES = new Set<RWAPerpsChartMetricKey>(CHART_TYPE_OPTIONS.map(({ key }) => key))
const DEFAULT_CHART_TYPE: RWAPerpsChartMetricKey = 'openInterest'
const TIME_SERIES_MODE_OPTIONS: Array<{ key: RWAPerpsTimeSeriesMode; label: string }> = [
	{ key: 'grouped', label: 'Total' },
	{ key: 'breakdown', label: 'Breakdown' }
]
const EMPTY_DATASET: RWAChartDataset = { source: [], dimensions: ['timestamp'] }
const STACKS_QUERY_KEY = 'stacks'
const EXCLUDE_STACKS_QUERY_KEY: ExcludeQueryKey = 'excludeStacks'

function getLegendSeriesNames(seriesNames: string[]) {
	if (!seriesNames.includes('Total')) return seriesNames
	return ['Total', ...seriesNames.filter((name) => name !== 'Total')]
}

function isChartMetricKey(value: string): value is RWAPerpsChartMetricKey {
	return VALID_CHART_TYPES.has(value as RWAPerpsChartMetricKey)
}

export function getRWAPerpsOverviewChartType(chartTypeQuery: string | undefined): RWAPerpsChartMetricKey {
	return chartTypeQuery && isChartMetricKey(chartTypeQuery) ? chartTypeQuery : DEFAULT_CHART_TYPE
}

export function getRWAPerpsOverviewChartTypeQueryPatch(nextChartType: RWAPerpsChartMetricKey) {
	return {
		chartType: nextChartType === DEFAULT_CHART_TYPE ? undefined : nextChartType
	}
}

export function getRWAPerpsOverviewTimeSeriesMode(timeSeriesModeQuery: string | undefined): RWAPerpsTimeSeriesMode {
	return timeSeriesModeQuery === 'breakdown' ? 'breakdown' : 'grouped'
}

export function getRWAPerpsOverviewTimeSeriesModeQueryPatch(nextTimeSeriesMode: RWAPerpsTimeSeriesMode) {
	return {
		timeSeriesMode: nextTimeSeriesMode === 'grouped' ? undefined : nextTimeSeriesMode
	}
}

export function resolveRWAPerpsOverviewSelectedStacks({
	stackOptions,
	selectedStacksQ,
	excludeStacksQ
}: {
	stackOptions: string[]
	selectedStacksQ: string | string[] | undefined
	excludeStacksQ: string | string[] | undefined
}) {
	if (stackOptions.length === 0) return []

	const availableStacks = new Set(stackOptions)
	if (selectedStacksQ === 'None') return []
	if (selectedStacksQ != null) {
		return toNonEmptyArrayParam(selectedStacksQ).filter((stack) => availableStacks.has(stack))
	}

	const excludedStacksSet = new Set(toNonEmptyArrayParam(excludeStacksQ).filter((stack) => availableStacks.has(stack)))
	if (excludedStacksSet.size === 0) return [...stackOptions]
	return stackOptions.filter((stack) => !excludedStacksSet.has(stack))
}

export function getRWAPerpsChartDatasetForSelectedStacks(
	dataset: RWAChartDataset,
	selectedStacks: string[],
	stackOptions: string[]
): RWAChartDataset {
	if (selectedStacks.length === 0 || selectedStacks.length === stackOptions.length) return dataset

	for (let i = 0; i < dataset.source.length; i++) {
		const row = dataset.source[i]
		for (const stack of selectedStacks) {
			if (row[stack] != null) {
				return {
					...dataset,
					source: dataset.source.slice(i)
				}
			}
		}
	}

	return dataset
}

function fetchOverviewBreakdownDataset(request: IRWAPerpsOverviewBreakdownRequest): Promise<RWAChartDataset> {
	const searchParams = new URLSearchParams({
		breakdown: request.breakdown,
		key: request.key
	})

	return fetchJson<RWAChartDataset>(`/api/public/rwa/perps/overview-breakdown?${searchParams.toString()}`)
}

export function buildRWAPerpsOverviewChartSeries({
	chartType,
	stackOptions,
	timeSeriesMode
}: {
	chartType: RWAPerpsChartMetricKey
	stackOptions: string[]
	timeSeriesMode: RWAPerpsTimeSeriesMode
}): Array<MultiSeriesChart2SeriesConfig> {
	const seriesType: MultiSeriesChart2SeriesConfig['type'] = chartType === 'volume24h' ? 'bar' : 'line'
	const hasTotalOverlay = timeSeriesMode === 'breakdown' && chartType !== 'volume24h' && stackOptions.includes('Total')
	const breakdownSeries = stackOptions.filter((seriesName) => !(hasTotalOverlay && seriesName === 'Total'))

	return [
		...breakdownSeries.map((seriesName, index) => ({
			name: seriesName,
			type: seriesType,
			...(chartType === 'volume24h' ? { stack: 'A', large: false } : {}),
			encode: { x: 'timestamp', y: seriesName },
			color: CHART_COLORS[(index + (hasTotalOverlay ? 1 : 0)) % CHART_COLORS.length]
		})),
		...(hasTotalOverlay
			? [
					{
						name: 'Total',
						type: 'line' as const,
						encode: { x: 'timestamp', y: 'Total' },
						color: CHART_COLORS[0],
						hideAreaStyle: true,
						excludeFromTooltipTotal: true
					}
				]
			: [])
	]
}

export function RWAPerpsOverviewChart({
	breakdown,
	initialChartDataset,
	stackLabel
}: {
	breakdown: IRWAPerpsOverviewBreakdownRequest['breakdown']
	initialChartDataset: RWAChartDataset
	stackLabel: string
}) {
	const router = useRouter()
	const chartType = getRWAPerpsOverviewChartType(readSingleQueryValue(router.query.chartType))
	const timeSeriesMode = getRWAPerpsOverviewTimeSeriesMode(readSingleQueryValue(router.query.timeSeriesMode))
	const volumeGroupBy = parseRWAPerpsVolumeGroupBy(router.query.groupBy)
	const isDefaultState = chartType === DEFAULT_CHART_TYPE
	const { data, isLoading, error } = useQuery({
		queryKey: ['rwa-perps-overview-breakdown', breakdown, chartType],
		queryFn: () => fetchOverviewBreakdownDataset({ breakdown, key: chartType }),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !isDefaultState
	})
	const rawDataset = isDefaultState ? initialChartDataset : (data ?? EMPTY_DATASET)
	const stackOptions = useMemo(
		() => rawDataset.dimensions.filter((dimension) => dimension !== 'timestamp'),
		[rawDataset]
	)
	const shouldShowTotalOverlay = timeSeriesMode === 'breakdown' && chartType !== 'volume24h'
	const ungroupedDataset =
		timeSeriesMode === 'grouped'
			? groupRWAPerpsTimeSeriesDataset(rawDataset)
			: shouldShowTotalOverlay
				? appendRWAPerpsTimeSeriesDatasetTotal(rawDataset)
				: rawDataset
	const dataset = useMemo(
		() =>
			chartType === 'volume24h'
				? groupMultiSeriesBarChartDataset({ dataset: ungroupedDataset, groupBy: volumeGroupBy })
				: ungroupedDataset,
		[chartType, ungroupedDataset, volumeGroupBy]
	)
	const showLoadingState = !isDefaultState && isLoading
	const chartSeries = useMemo<Array<MultiSeriesChart2SeriesConfig>>(
		() =>
			buildRWAPerpsOverviewChartSeries({
				chartType,
				stackOptions: dataset.dimensions.filter((dimension) => dimension !== 'timestamp'),
				timeSeriesMode
			}),
		[chartType, dataset.dimensions, timeSeriesMode]
	)
	const selectedStacksQ = router.query[STACKS_QUERY_KEY] as string | string[] | undefined
	const excludeStacksQ = router.query[EXCLUDE_STACKS_QUERY_KEY] as string | string[] | undefined
	const selectedStacks = useMemo(
		() =>
			resolveRWAPerpsOverviewSelectedStacks({
				stackOptions,
				selectedStacksQ,
				excludeStacksQ
			}),
		[excludeStacksQ, selectedStacksQ, stackOptions]
	)
	const selectedDataset = useMemo(
		() =>
			timeSeriesMode === 'breakdown'
				? getRWAPerpsChartDatasetForSelectedStacks(dataset, selectedStacks, stackOptions)
				: dataset,
		[dataset, selectedStacks, stackOptions, timeSeriesMode]
	)
	const selectedHistoryDataset = useMemo(
		() =>
			chartType === 'volume24h' && timeSeriesMode === 'breakdown'
				? getRWAPerpsChartDatasetForSelectedStacks(ungroupedDataset, selectedStacks, stackOptions)
				: chartType === 'volume24h'
					? ungroupedDataset
					: selectedDataset,
		[chartType, selectedDataset, selectedStacks, stackOptions, timeSeriesMode, ungroupedDataset]
	)
	const hasTimeSeriesHistory = useMemo(
		() => hasEnoughTimeSeriesHistory(selectedHistoryDataset),
		[selectedHistoryDataset]
	)
	const showStackSelect = timeSeriesMode === 'breakdown' && stackOptions.length > 1
	const visibleCharts = useMemo(
		() =>
			timeSeriesMode === 'breakdown'
				? new Set(shouldShowTotalOverlay ? ['Total', ...selectedStacks] : selectedStacks)
				: undefined,
		[selectedStacks, shouldShowTotalOverlay, timeSeriesMode]
	)
	const legendSeriesNames = useMemo(
		() =>
			getLegendSeriesNames(
				chartSeries.map((series) => series.name).filter((name) => (visibleCharts ? visibleCharts.has(name) : true))
			),
		[chartSeries, visibleCharts]
	)
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	const onSelectChartType = (nextChartType: RWAPerpsChartMetricKey) => {
		void pushShallowQuery(router, getRWAPerpsOverviewChartTypeQueryPatch(nextChartType))
	}

	const onSelectTimeSeriesMode = (nextTimeSeriesMode: string | string[]) => {
		void pushShallowQuery(
			router,
			getRWAPerpsOverviewTimeSeriesModeQueryPatch(
				(Array.isArray(nextTimeSeriesMode) ? nextTimeSeriesMode[0] : nextTimeSeriesMode) as RWAPerpsTimeSeriesMode
			)
		)
	}

	return (
		<ChartPanel>
			<ChartPanelToolbar className="justify-end">
				<SegmentedControl
					value={chartType}
					onValueChange={onSelectChartType}
					options={CHART_TYPE_OPTIONS.map(({ key, label }) => ({ value: key, label }))}
					label="Chart type"
					variant="default"
					size="md"
					className="mr-auto"
				/>
				<Select
					allValues={TIME_SERIES_MODE_OPTIONS.map(({ key, label }) => ({ key, name: label }))}
					selectedValues={timeSeriesMode}
					setSelectedValues={onSelectTimeSeriesMode}
					label={TIME_SERIES_MODE_OPTIONS.find(({ key }) => key === timeSeriesMode)?.label ?? 'Total'}
					labelType="none"
					variant="filter"
					size="md"
				/>
				{chartType === 'volume24h' ? (
					<ChartGroupingSelector
						value={volumeGroupBy}
						options={DWM_GROUPING_OPTIONS_LOWERCASE}
						onValueChange={(nextGroupBy) => {
							void pushShallowQuery(router, { groupBy: getRWAPerpsVolumeGroupByQueryValue(nextGroupBy) })
						}}
					/>
				) : null}
				{showStackSelect ? (
					<SelectWithCombobox
						allValues={stackOptions}
						selectedValues={selectedStacks}
						includeQueryKey={STACKS_QUERY_KEY}
						excludeQueryKey={EXCLUDE_STACKS_QUERY_KEY}
						defaultSelectedValues={stackOptions}
						label={stackLabel}
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<ChartExportButtons
					chartInstance={exportChartInstance}
					filename={`rwa-perps-overview-breakdown-${breakdown}-${chartType}-${timeSeriesMode}`}
					title={`RWA Perps ${CHART_TYPE_OPTIONS.find((option) => option.key === chartType)?.label ?? 'Breakdown'}`}
					smol
				/>
			</ChartPanelToolbar>
			{error ? (
				<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
					{getErrorMessage(error)}
				</ChartPanelBodyFallback>
			) : showLoadingState ? (
				<ChartPanelBodyFallback role="status" aria-live="polite" className="gap-1 body-sm text-tertiary">
					Loading
					<LoadingDots />
				</ChartPanelBodyFallback>
			) : !hasTimeSeriesHistory ? (
				<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
					Only a single snapshot is available; time-series history is not available for this selection yet.
				</ChartPanelBodyFallback>
			) : (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart2
						dataset={selectedDataset}
						charts={chartSeries}
						chartOptions={{ legend: { data: legendSeriesNames } }}
						hideDefaultLegend={false}
						showTotalInTooltip={!dataset.dimensions.includes('Total')}
						selectedCharts={visibleCharts}
						onReady={handleChartReady}
						valueSymbol={chartType === 'markets' ? '' : '$'}
						groupBy={chartType === 'volume24h' ? volumeGroupBy : undefined}
					/>
				</Suspense>
			)}
		</ChartPanel>
	)
}
