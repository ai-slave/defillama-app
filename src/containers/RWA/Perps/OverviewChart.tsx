import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useMemo } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { groupMultiSeriesBarChartDataset } from '~/components/ECharts/MultiSeriesChart/groupDataset'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { readSelectionFromQuery } from '~/components/Select/query'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { ExcludeQueryKey } from '~/components/Select/types'
import { CHART_COLORS } from '~/constants/colors'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { Button } from '~/ui/Button'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { LoadingIndicator } from '~/ui/Status'
import { fetchJson } from '~/utils/async'
import { getErrorMessage } from '~/utils/error'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { toRwaMultiSeriesChartDataset, type RWAChartDataset } from '../chartDataset'
import { setRWAPerpsChartScope } from './api'
import { getRWAPerpsVolumeGroupByQueryValue, parseRWAPerpsVolumeGroupBy } from './chartState'
import { perpsDefinitions as d } from './definitions'
import {
	appendRWAPerpsTimeSeriesDatasetTotal,
	groupRWAPerpsTimeSeriesDataset,
	hasEnoughTimeSeriesHistory
} from './queries'
import type { IRWAPerpsOverviewBreakdownRequest, RWAPerpsChartMetricKey, RWAPerpsTimeSeriesMode } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

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

function getLegendSeriesNames(seriesNames: Array<string>) {
	if (!seriesNames.includes('Total')) return seriesNames
	return ['Total', ...seriesNames.filter((name) => name !== 'Total')]
}

export function getRWAPerpsOverviewChartType(chartTypeQuery: string | undefined): RWAPerpsChartMetricKey {
	for (const chartType of VALID_CHART_TYPES) {
		if (chartType === chartTypeQuery) return chartType
	}
	return DEFAULT_CHART_TYPE
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

/** Stacks that only have data with CEX venues: named in the CEX-inclusive rows and missing from the DEX rows. */
export function getRWAPerpsCexOnlyStacks(names: Array<string>, dexNames: Array<string>): Array<string> {
	const dex = new Set(dexNames)
	return names.filter((name) => !dex.has(name))
}

/**
 * The stack picker's options and selection. The options are the stacks with CEX venues included, whatever the toggle,
 * so a selection means the same with CEX Venues on or off; the toggle only changes what the chart draws. A CEX-only
 * stack says it needs the toggle and stays selectable. `emptyNotice` explains a chart the toggle leaves empty.
 */
export function resolveRWAPerpsStackSelection({
	query,
	stackOptions,
	cexOnlyStacks,
	includeCex
}: {
	query: Readonly<Record<string, string | Array<string> | undefined>>
	stackOptions: Array<string>
	cexOnlyStacks: ReadonlyArray<string>
	includeCex: boolean
}) {
	const drawn = new Set(stackOptions)
	const optionKeys = [...stackOptions, ...cexOnlyStacks.filter((stack) => !drawn.has(stack))]
	const cexOnly = new Set(cexOnlyStacks)
	const selectedStacks = readSelectionFromQuery(query, STACKS_QUERY_KEY, EXCLUDE_STACKS_QUERY_KEY, optionKeys)
	// Only blame the toggle when turning it on would draw a selected stack.
	const emptyNotice =
		!includeCex &&
		!selectedStacks.some((stack) => drawn.has(stack)) &&
		selectedStacks.some((stack) => cexOnly.has(stack))
			? 'This selection only has data under CEX Venues. Turn it on to see it.'
			: null

	return {
		optionKeys,
		options: optionKeys.map((key) =>
			!includeCex && cexOnly.has(key) ? { key, name: key, help: 'Requires CEX Venues' } : { key, name: key }
		),
		selectedStacks,
		emptyNotice
	}
}

export function getRWAPerpsChartDatasetForSelectedStacks(
	dataset: RWAChartDataset,
	selectedStacks: Array<string>,
	stackOptions: Array<string>
): RWAChartDataset {
	if (selectedStacks.length === stackOptions.length) return dataset

	const availableDimensions = new Set(dataset.dimensions)
	const dimensions = ['timestamp']
	if (availableDimensions.has('Total')) dimensions.push('Total')
	for (const stack of selectedStacks) {
		if (availableDimensions.has(stack)) dimensions.push(stack)
	}
	if (dimensions.length === 1) return EMPTY_DATASET

	const source: RWAChartDataset['source'] = []
	let hasStarted = selectedStacks.length === 0
	for (const row of dataset.source) {
		if (!hasStarted) {
			for (const stack of selectedStacks) {
				if (row[stack] != null) {
					hasStarted = true
					break
				}
			}
			if (!hasStarted) continue
		}

		const selectedRow: RWAChartDataset['source'][number] = { timestamp: row.timestamp }
		for (const dimension of dimensions) {
			if (dimension === 'timestamp') continue
			const value = row[dimension]
			if (value !== undefined) selectedRow[dimension] = value
		}
		source.push(selectedRow)
	}

	return { source, dimensions }
}

function fetchOverviewBreakdownDataset(request: IRWAPerpsOverviewBreakdownRequest): Promise<RWAChartDataset> {
	const searchParams = new URLSearchParams({
		breakdown: request.breakdown,
		key: request.key
	})
	setRWAPerpsChartScope(searchParams, request)

	return fetchJson<RWAChartDataset>(`/api/public/rwa/perps/overview-breakdown?${searchParams.toString()}`)
}

export function buildRWAPerpsOverviewChartSeries({
	chartType,
	stackOptions,
	timeSeriesMode
}: {
	chartType: RWAPerpsChartMetricKey
	stackOptions: Array<string>
	timeSeriesMode: RWAPerpsTimeSeriesMode
}): Array<MultiSeriesChartSeriesConfig> {
	const seriesType: MultiSeriesChartSeriesConfig['type'] = chartType === 'volume24h' ? 'bar' : 'line'
	const hasTotalOverlay = timeSeriesMode === 'breakdown' && chartType !== 'volume24h' && stackOptions.includes('Total')
	const breakdownSeries = stackOptions.filter((seriesName) => !(hasTotalOverlay && seriesName === 'Total'))
	const charts: Array<MultiSeriesChartSeriesConfig> = []

	for (const [index, seriesName] of breakdownSeries.entries()) {
		charts.push({
			name: seriesName,
			type: seriesType,
			...(chartType === 'volume24h' ? { stack: 'A', large: false } : {}),
			encode: { x: 'timestamp', y: seriesName },
			color: CHART_COLORS[(index + (hasTotalOverlay ? 1 : 0)) % CHART_COLORS.length] ?? CHART_COLORS[0]
		})
	}

	if (hasTotalOverlay) {
		charts.push({
			name: 'Total',
			type: 'line',
			encode: { x: 'timestamp', y: 'Total' },
			color: CHART_COLORS[0],
			hideAreaStyle: true,
			excludeFromTooltipTotal: true
		})
	}

	return charts
}

export function RWAPerpsOverviewChart({
	breakdown,
	initialChartDataset,
	includeCex,
	cexOnlyStacks,
	stackLabel
}: {
	breakdown: IRWAPerpsOverviewBreakdownRequest['breakdown']
	initialChartDataset: RWAChartDataset | null
	includeCex: boolean
	cexOnlyStacks: Array<string>
	stackLabel: string
}) {
	const router = useRouter()
	const chartType = getRWAPerpsOverviewChartType(readSingleQueryValue(router.query.chartType))
	const timeSeriesMode = getRWAPerpsOverviewTimeSeriesMode(readSingleQueryValue(router.query.timeSeriesMode))
	const volumeGroupBy = parseRWAPerpsVolumeGroupBy(router.query.groupBy)
	const isDefaultState = chartType === DEFAULT_CHART_TYPE
	const hasInitialChartDataset = initialChartDataset !== null
	const target: IRWAPerpsOverviewBreakdownRequest['target'] = { kind: 'all' }
	const { data, isLoading, error } = useQuery({
		queryKey: ['rwa-perps-overview-breakdown', breakdown, chartType, includeCex],
		queryFn: () => fetchOverviewBreakdownDataset({ breakdown, key: chartType, target, includeCex }),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
		enabled: !hasInitialChartDataset || !isDefaultState || includeCex
	})
	const rawDataset =
		isDefaultState && !includeCex && initialChartDataset !== null ? initialChartDataset : (data ?? EMPTY_DATASET)
	const stackOptions = useMemo(
		() => rawDataset.dimensions.filter((dimension) => dimension !== 'timestamp'),
		[rawDataset]
	)
	const shouldShowTotalOverlay = timeSeriesMode === 'breakdown' && chartType !== 'volume24h'
	const ungroupedDataset = useMemo(
		() =>
			timeSeriesMode === 'grouped'
				? groupRWAPerpsTimeSeriesDataset(rawDataset)
				: shouldShowTotalOverlay
					? appendRWAPerpsTimeSeriesDatasetTotal(rawDataset)
					: rawDataset,
		[rawDataset, shouldShowTotalOverlay, timeSeriesMode]
	)
	const showLoadingState = (!hasInitialChartDataset || !isDefaultState || includeCex) && isLoading
	const chartSeries = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() =>
			buildRWAPerpsOverviewChartSeries({
				chartType,
				stackOptions: ungroupedDataset.dimensions.filter((dimension) => dimension !== 'timestamp'),
				timeSeriesMode
			}),
		[chartType, timeSeriesMode, ungroupedDataset.dimensions]
	)
	const {
		optionKeys: stackOptionKeys,
		options: stackPickerOptions,
		selectedStacks,
		emptyNotice: stackEmptyNotice
	} = useMemo(
		() => resolveRWAPerpsStackSelection({ query: router.query, stackOptions, cexOnlyStacks, includeCex }),
		[router.query, stackOptions, cexOnlyStacks, includeCex]
	)
	const selectedRawDataset = useMemo(
		() =>
			timeSeriesMode === 'breakdown'
				? getRWAPerpsChartDatasetForSelectedStacks(ungroupedDataset, selectedStacks, stackOptionKeys)
				: ungroupedDataset,
		[selectedStacks, stackOptionKeys, timeSeriesMode, ungroupedDataset]
	)
	const selectedDataset = useMemo(() => {
		const canonicalDataset = toRwaMultiSeriesChartDataset(selectedRawDataset)
		return chartType === 'volume24h'
			? groupMultiSeriesBarChartDataset({ dataset: canonicalDataset, groupBy: volumeGroupBy })
			: canonicalDataset
	}, [chartType, selectedRawDataset, volumeGroupBy])
	// The CSV holds what the chart draws, so it follows the stack picker.
	const prepareCsvDataset = useCallback(() => {
		const canonicalDataset = toRwaMultiSeriesChartDataset(selectedRawDataset)
		return chartType === 'volume24h'
			? {
					...groupMultiSeriesBarChartDataset({ dataset: canonicalDataset, groupBy: volumeGroupBy }),
					groupBy: volumeGroupBy
				}
			: canonicalDataset
	}, [chartType, selectedRawDataset, volumeGroupBy])
	const hasTimeSeriesHistory = useMemo(() => hasEnoughTimeSeriesHistory(selectedRawDataset), [selectedRawDataset])
	const showStackSelect = timeSeriesMode === 'breakdown' && stackOptionKeys.length > 1
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
	const chartOptions = useMemo(() => ({ legend: { data: legendSeriesNames } }), [legendSeriesNames])
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	const onSelectChartType = (nextChartType: RWAPerpsChartMetricKey) => {
		void pushShallowQuery(router, getRWAPerpsOverviewChartTypeQueryPatch(nextChartType))
	}

	const onSelectTimeSeriesMode = (nextTimeSeriesMode: string | Array<string>) => {
		const selectedMode = getRWAPerpsOverviewTimeSeriesMode(
			Array.isArray(nextTimeSeriesMode) ? nextTimeSeriesMode[0] : nextTimeSeriesMode
		)
		void pushShallowQuery(router, getRWAPerpsOverviewTimeSeriesModeQueryPatch(selectedMode))
	}

	return (
		<ChartPanel>
			<ChartPanelToolbar>
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
						allValues={stackPickerOptions}
						includeQueryKey={STACKS_QUERY_KEY}
						excludeQueryKey={EXCLUDE_STACKS_QUERY_KEY}
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
					csvSource={{ type: 'dataset', prepare: prepareCsvDataset }}
				/>
			</ChartPanelToolbar>
			{error ? (
				<ChartPanelBodyFallback role="alert" className="body-sm text-data-down">
					{getErrorMessage(error)}
				</ChartPanelBodyFallback>
			) : showLoadingState ? (
				<ChartPanelBodyFallback role="status" aria-live="polite">
					<LoadingIndicator />
				</ChartPanelBodyFallback>
			) : timeSeriesMode === 'breakdown' && stackEmptyNotice ? (
				<ChartPanelBodyFallback
					role="status"
					aria-live="polite"
					className="flex-col gap-2 px-4 text-center body-sm text-tertiary"
				>
					<p>{stackEmptyNotice}</p>
					<Button
						type="button"
						size="md"
						onClick={() =>
							void pushShallowQuery(router, { [STACKS_QUERY_KEY]: undefined, [EXCLUDE_STACKS_QUERY_KEY]: undefined })
						}
					>
						Show every {stackLabel.toLowerCase()}
					</Button>
				</ChartPanelBodyFallback>
			) : timeSeriesMode === 'breakdown' && !shouldShowTotalOverlay && selectedStacks.length === 0 ? (
				<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
					No stacks selected.
				</ChartPanelBodyFallback>
			) : !hasTimeSeriesHistory ? (
				<ChartPanelBodyFallback role="status" aria-live="polite" className="body-sm text-tertiary">
					There is not enough time-series history for this selection yet.
				</ChartPanelBodyFallback>
			) : (
				<Suspense fallback={<ChartPanelBodyFallback />}>
					<MultiSeriesChart
						dataset={selectedDataset}
						charts={chartSeries}
						chartOptions={chartOptions}
						hideDefaultLegend={false}
						showTotalInTooltip={!selectedDataset.dimensions.includes('Total')}
						{...(visibleCharts ? { selectedCharts: visibleCharts } : {})}
						onReady={handleChartReady}
						valueSymbol={chartType === 'markets' ? '' : '$'}
						{...(chartType === 'volume24h' ? { groupBy: volumeGroupBy } : {})}
					/>
				</Suspense>
			)}
		</ChartPanel>
	)
}
