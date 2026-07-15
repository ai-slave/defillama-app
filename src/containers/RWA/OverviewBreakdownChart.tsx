import type { ParsedUrlQuery } from 'querystring'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { lazy, Suspense, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { ChartGroupingSelector, DWMC_GROUPING_OPTIONS_LOWERCASE } from '~/components/ECharts/ChartGroupingSelector'
import type { MultiSeriesChart2Dataset, MultiSeriesChart2SeriesConfig } from '~/components/ECharts/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { type ExcludeQueryKey } from '~/components/Select/types'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingDots } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { fetchJson } from '~/utils/async'
import { getErrorMessage } from '~/utils/error'
import { isTrueQueryParam, pushShallowQuery, readSingleQueryValue, toNonEmptyArrayParam } from '~/utils/routerQuery'
import type { RWAChartMetricKey, RWAOverviewBreakdownRequest, RWAOverviewPage } from './api.types'
import {
	getRwaChartSeriesColorSlots,
	getRwaReservedSeriesColorSlot,
	isRwaTotalSeriesLabel,
	sortRwaChartSeriesLabels
} from './chartAggregation'
import type { RWAChartDataset } from './chartDataset'
import { definitions } from './definitions'
import { buildRWAFlowRotationChart, parseRWAFlowGrouping, type RWAFlowGrouping } from './flows'
import { useRWAFlowOverviewSplitWithFilters } from './flows.hooks'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

type RWAOverviewBreakdownChartType = RWAChartMetricKey | 'flows'

const CHART_TYPE_OPTIONS: Array<{ key: RWAOverviewBreakdownChartType; label: string }> = [
	{ key: 'activeMcap', label: 'Active Mcap' },
	{ key: 'onChainMcap', label: 'Onchain Mcap' },
	{ key: 'defiActiveTvl', label: 'DeFi Active TVL' },
	{ key: 'flows', label: definitions.flows.overviewNetFlows.label }
]

const VALID_CHART_TYPES = new Set<RWAChartMetricKey>(['activeMcap', 'onChainMcap', 'defiActiveTvl'])
const DEFAULT_CHART_TYPE: RWAChartMetricKey = 'activeMcap'
const EMPTY_DATASET: RWAChartDataset = { source: [], dimensions: ['timestamp'] }
const STACKS_QUERY_KEY = 'stacks'
const EXCLUDE_STACKS_QUERY_KEY: ExcludeQueryKey = 'excludeStacks'
function assertNever(value: never): never {
	throw new Error(`Unknown page kind: ${value}`)
}

function getOverviewBreakdownFlowGrouping(value: string | undefined): RWAFlowGrouping {
	if (value == null) return 'monthly'
	const grouping = parseRWAFlowGrouping(value)
	return grouping === value ? grouping : 'monthly'
}

function isChartMetricKey(value: string): value is RWAChartMetricKey {
	return VALID_CHART_TYPES.has(value as RWAChartMetricKey)
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

	switch (page.kind) {
		case 'chain':
			return {
				request: {
					breakdown: 'chain',
					key: chartType,
					includeStablecoin,
					includeGovernance
				} satisfies RWAOverviewBreakdownRequest,
				isDefaultState: chartType === DEFAULT_CHART_TYPE && !includeStablecoin && !includeGovernance
			}
		case 'platform':
			return {
				request: {
					breakdown: 'platform',
					key: chartType,
					includeStablecoin,
					includeGovernance
				} satisfies RWAOverviewBreakdownRequest,
				isDefaultState: chartType === DEFAULT_CHART_TYPE && !includeStablecoin && !includeGovernance
			}
		case 'category':
			return {
				request: {
					breakdown: 'category',
					key: chartType,
					includeStablecoin,
					includeGovernance
				} satisfies RWAOverviewBreakdownRequest,
				isDefaultState: chartType === DEFAULT_CHART_TYPE && !includeStablecoin && !includeGovernance
			}
		case 'assetGroup':
			return {
				request: {
					breakdown: 'assetGroup',
					key: chartType,
					includeStablecoin,
					includeGovernance
				} satisfies RWAOverviewBreakdownRequest,
				isDefaultState: chartType === DEFAULT_CHART_TYPE && !includeStablecoin && !includeGovernance
			}
		default:
			return assertNever(page)
	}
}

function fetchOverviewBreakdownDataset(request: RWAOverviewBreakdownRequest): Promise<RWAChartDataset> {
	const searchParams = new URLSearchParams({
		breakdown: request.breakdown,
		key: request.key
	})

	if (request.includeStablecoin) searchParams.set('includeStablecoin', 'true')
	if (request.includeGovernance) searchParams.set('includeGovernance', 'true')

	return fetchJson<RWAChartDataset>(`/api/public/rwa/overview-breakdown?${searchParams.toString()}`)
}

export function buildOverviewBreakdownChartSeries(dimensions: string[]): Array<MultiSeriesChart2SeriesConfig> {
	const seriesDimensions = sortRwaChartSeriesLabels(dimensions.filter((dimension) => dimension !== 'timestamp'))
	const colorSlots = getRwaChartSeriesColorSlots(seriesDimensions)

	return seriesDimensions.map((name) => {
		const reservedColorSlot = getRwaReservedSeriesColorSlot(name)
		const isTotalSeries = isRwaTotalSeriesLabel(name)

		return {
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name },
			color: CHART_COLORS[colorSlots[name] % CHART_COLORS.length],
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
	dataset: MultiSeriesChart2Dataset,
	selectedStacks: string[],
	stackOptions: string[]
): MultiSeriesChart2Dataset {
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

export function RWAOverviewBreakdownChart({
	page,
	initialChartDataset,
	stackLabel
}: {
	page: RWAOverviewPage
	initialChartDataset: RWAChartDataset
	stackLabel: string
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
	const metricChartType = isFlowChart ? DEFAULT_CHART_TYPE : chartType
	const { request, isDefaultState } = getOverviewBreakdownRequestState(page, metricChartType, router.query)
	const { data, isLoading, error } = useQuery({
		queryKey: [
			'rwa-overview-breakdown',
			request.breakdown,
			request.key,
			request.includeStablecoin,
			request.includeGovernance
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
	const flowChart = useMemo(() => buildRWAFlowRotationChart(flowData ?? [], flowFrequency), [flowData, flowFrequency])
	const dataset = isFlowChart ? flowChart.dataset : isDefaultState ? initialChartDataset : (data ?? EMPTY_DATASET)
	const showLoadingState = isFlowChart ? isFlowLoading : !isDefaultState && isLoading
	const chartError = isFlowChart ? flowError : error
	const stackOptions = useMemo(() => dataset.dimensions.filter((dimension) => dimension !== 'timestamp'), [dataset])
	const chartSeries = useMemo(
		() => (isFlowChart ? flowChart.charts : buildOverviewBreakdownChartSeries(dataset.dimensions)),
		[dataset.dimensions, flowChart.charts, isFlowChart]
	)
	const selectedStacksQ = router.query[STACKS_QUERY_KEY] as string | string[] | undefined
	const excludeStacksQ = router.query[EXCLUDE_STACKS_QUERY_KEY] as string | string[] | undefined
	const selectedStacks = useMemo(() => {
		if (stackOptions.length === 0) return []
		const availableStacks = new Set(stackOptions)
		if (selectedStacksQ === 'None') return []
		if (selectedStacksQ != null) {
			return toNonEmptyArrayParam(selectedStacksQ).filter((stack) => availableStacks.has(stack))
		}

		const excludedStacksSet = new Set(
			toNonEmptyArrayParam(excludeStacksQ).filter((stack) => availableStacks.has(stack))
		)
		if (excludedStacksSet.size === 0) return [...stackOptions]
		return stackOptions.filter((stack) => !excludedStacksSet.has(stack))
	}, [excludeStacksQ, selectedStacksQ, stackOptions])
	const selectedStacksSet = useMemo(() => new Set(selectedStacks), [selectedStacks])
	const selectedDataset = useMemo(
		() => getOverviewBreakdownChartDatasetForSelectedStacks(dataset, selectedStacks, stackOptions),
		[dataset, selectedStacks, stackOptions]
	)
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

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
						tooltip: key === 'flows' ? definitions.flows.overviewNetFlows.description : undefined
					}))}
					label="Chart type"
					variant="default"
					size="md"
					className="mr-auto"
				/>
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
						defaultSelectedValues={stackOptions}
						label={stackLabel}
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<ChartExportButtons
					chartInstance={exportChartInstance}
					filename={`rwa-overview-breakdown-${chartType}`}
					title={`RWA ${CHART_TYPE_OPTIONS.find((option) => option.key === chartType)?.label ?? 'Breakdown'}`}
					smol
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
			) : (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart2
						dataset={selectedDataset}
						charts={chartSeries}
						hideDefaultLegend={false}
						showTotalInTooltip={!dataset.dimensions.some(isRwaTotalSeriesLabel)}
						groupBy={isFlowChart ? flowFrequency : undefined}
						selectedCharts={selectedStacksSet}
						onReady={handleChartReady}
					/>
				</Suspense>
			)}
		</ChartPanel>
	)
}
