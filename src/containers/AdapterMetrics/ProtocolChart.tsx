import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { selectChartDatasetColumns } from '~/components/ECharts/MultiSeriesChart/selection'
import type {
	MultiSeriesChartSeriesConfig,
	MultiSeriesTimeSeriesDataset,
	MultiSeriesTimeSeriesRow
} from '~/components/ECharts/MultiSeriesChart/types'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { getBucketTimestampMs } from '~/components/ECharts/shared/timeSeries'
import { useLocalSelectionWithRemainder } from '~/components/Select/localSelection'
import { chartColor, OTHERS_COLOR } from '~/constants/colors'
import type { ChartBuilderConfig } from '~/containers/ProDashboard/types'
import { getAdapterBuilderMetric } from '~/containers/ProDashboard/utils/adapterChartMapping'
import { generateItemId } from '~/containers/ProDashboard/utils/dashboardUtils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { ChartPanelTitle, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { tokenIconUrl } from '~/utils/icons'
import { queryReadFailed } from '~/utils/query'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { IAdapterBreakdownChartData } from './api.types'
import type { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from './constants'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const EMPTY_PROTOCOL_BREAKDOWN_DATASET: MultiSeriesTimeSeriesDataset = {
	source: [],
	dimensions: ['timestamp']
}

type ProtocolBreakdownChartPresentation = {
	dataset: MultiSeriesTimeSeriesDataset
	charts: Array<MultiSeriesChartSeriesConfig>
}

export function buildProtocolBreakdownChartPresentation({
	data,
	seriesNames,
	chartInterval
}: {
	data: IAdapterBreakdownChartData
	seriesNames: Array<string>
	chartInterval: LowercaseDwmcGrouping
}): ProtocolBreakdownChartPresentation {
	if (seriesNames.length === 0) return { dataset: EMPTY_PROTOCOL_BREAKDOWN_DATASET, charts: [] }

	const isCumulative = chartInterval === 'cumulative'
	const aggregatedByDate = new Map<number, Array<number>>()
	for (const [date, valuesBySeries] of data) {
		const timestampMs = date * 1e3
		const finalDate = isCumulative ? timestampMs : getBucketTimestampMs(timestampMs, chartInterval)
		let values = aggregatedByDate.get(finalDate)
		if (!values) {
			values = new Array<number>(seriesNames.length).fill(0)
			aggregatedByDate.set(finalDate, values)
		}

		for (let seriesIndex = 0; seriesIndex < seriesNames.length; seriesIndex++) {
			const seriesName = seriesNames[seriesIndex]
			const currentValue = values[seriesIndex]
			if (seriesName === undefined || currentValue === undefined) {
				throw new Error(`Missing protocol breakdown series at index ${seriesIndex}`)
			}
			const value = valuesBySeries[seriesName]
			if (value === undefined) continue
			values[seriesIndex] = currentValue + value
		}
	}

	const sortedEntries = Array.from(aggregatedByDate.entries()).sort((a, b) => a[0] - b[0])
	const cumulative = new Array<number>(seriesNames.length).fill(0)
	const source: MultiSeriesTimeSeriesDataset['source'] = []
	for (const [date, values] of sortedEntries) {
		const row: MultiSeriesTimeSeriesRow = [date]
		row.length = seriesNames.length + 1
		for (let seriesIndex = 0; seriesIndex < seriesNames.length; seriesIndex++) {
			const value = values[seriesIndex]
			if (value === undefined) throw new Error(`Missing protocol breakdown value at index ${seriesIndex}`)
			if (isCumulative) {
				const previousCumulative = cumulative[seriesIndex]
				if (previousCumulative === undefined) {
					throw new Error(`Missing protocol breakdown cumulative value at index ${seriesIndex}`)
				}
				const cumulativeValue = previousCumulative + value
				cumulative[seriesIndex] = cumulativeValue
				row[seriesIndex + 1] = cumulativeValue
			} else {
				row[seriesIndex + 1] = value
			}
		}
		source.push(row)
	}

	// Preserve zeroes after a series starts, but hide leading zero-only buckets.
	for (let seriesIndex = 0; seriesIndex < seriesNames.length; seriesIndex++) {
		for (const row of source) {
			const valueIndex = seriesIndex + 1
			if (row[valueIndex] !== 0) break
			row[valueIndex] = null
		}
	}

	const chartType: 'line' | 'bar' = isCumulative ? 'line' : 'bar'
	const charts: Array<MultiSeriesChartSeriesConfig> = []
	for (let index = 0; index < seriesNames.length; index++) {
		const name = seriesNames[index]
		if (name === undefined) continue
		charts.push({
			type: chartType,
			name,
			encode: { x: 0, y: index + 1 },
			stack: 'chartType',
			color: name === 'Others' ? OTHERS_COLOR : chartColor(index)
		})
	}

	return {
		dataset: { source, dimensions: ['timestamp', ...seriesNames] },
		charts
	}
}

export const buildAdapterProtocolBreakdownApiUrl = ({
	adapterType,
	protocol,
	dataType,
	type
}: {
	adapterType: `${ADAPTER_TYPES}`
	protocol: string
	dataType?: `${ADAPTER_DATA_TYPES}`
	type: ProtocolBreakdownSplit
}) => {
	const searchParams = new URLSearchParams({
		kind: 'adapter-breakdown',
		adapterType,
		protocol,
		type
	})

	if (dataType) {
		searchParams.set('dataType', dataType)
	}

	return `/api/public/protocols/charts?${searchParams.toString()}`
}

export type ProtocolBreakdownSplit = 'chain' | 'version' | 'label'

const SPLIT_LABELS = {
	chain: { option: 'Chain', title: 'chain', filter: 'Chains' },
	// The API calls these versions, but most are a parent protocol's separate products (Jupiter Lend, Hyperliquid Perps);
	// only a few are true versions (Uniswap V3).
	version: { option: 'Product', title: 'product', filter: 'Products' },
	// The API calls these financial labels; readers know them as where the money comes from.
	label: { option: 'Source', title: 'source', filter: 'Sources' }
} as const satisfies Record<ProtocolBreakdownSplit, { option: string; title: string; filter: string }>

type BreakdownSplitOption = { type: ProtocolBreakdownSplit; names: Array<string> }

/** A split is offered only when it has more than one series; the first offered split is the default. */
export function resolveBreakdownSplit(
	splits: Array<BreakdownSplitOption>,
	queryValue: string | Array<string> | undefined
) {
	const options = splits.filter((split) => split.names.length > 1)
	return { options, split: options.find((option) => option.type === queryValue) ?? options[0] }
}

/** The URL value that opens `type`: the default split writes nothing, so the plain route stays the default view. */
export function breakdownSplitQueryValue(options: Array<BreakdownSplitOption>, type: ProtocolBreakdownSplit) {
	return type === options[0]?.type ? undefined : type
}

/* One panel per metric, split by chain, product (the API's version) or source (the API's financial label) from a
   switch in its header, so a page shows one breakdown per metric instead of one panel per split. The split decides
   which data the panel shows, so it lives in the URL under `splitParam`. The panel renders nothing when no split has
   more than one series. */
export function DimensionProtocolBreakdownPanel({
	metric,
	splitParam,
	splits,
	protocolName,
	protocolDisplayName,
	adapterType,
	dataType,
	hallmarks
}: {
	metric: string
	splitParam: string
	splits: Array<BreakdownSplitOption>
	protocolName: string
	protocolDisplayName: string
	adapterType: `${ADAPTER_TYPES}`
	dataType?: `${ADAPTER_DATA_TYPES}`
	hallmarks?: Array<[number, string]>
}) {
	const router = useRouter()
	const { options, split } = resolveBreakdownSplit(splits, router.query[splitParam])
	if (!split) return null

	return (
		<Panel className="col-span-full xl:col-span-1 xl:only:col-span-full">
			<BreakdownChart
				metric={metric}
				options={options}
				split={split}
				onSplitChange={(type) =>
					void pushShallowQuery(router, { [splitParam]: breakdownSplitQueryValue(options, type) })
				}
				protocolName={protocolName}
				protocolDisplayName={protocolDisplayName}
				adapterType={adapterType}
				{...(dataType !== undefined ? { dataType } : {})}
				{...(hallmarks !== undefined ? { hallmarks } : {})}
			/>
		</Panel>
	)
}

function BreakdownChart({
	metric,
	options,
	split,
	onSplitChange,
	protocolName,
	protocolDisplayName,
	adapterType,
	dataType,
	hallmarks
}: {
	metric: string
	options: Array<BreakdownSplitOption>
	split: BreakdownSplitOption
	onSplitChange: (type: ProtocolBreakdownSplit) => void
	protocolName: string
	protocolDisplayName: string
	adapterType: `${ADAPTER_TYPES}`
	dataType?: `${ADAPTER_DATA_TYPES}`
	hallmarks?: Array<[number, string]>
}) {
	const query = useQuery({
		queryKey: ['dimension-adapter-chart-breakdown', protocolName, adapterType, dataType ?? null, split.type],
		queryFn: () =>
			fetchJson<IAdapterBreakdownChartData>(
				buildAdapterProtocolBreakdownApiUrl({
					adapterType,
					protocol: protocolName,
					...(dataType !== undefined ? { dataType } : {}),
					type: split.type
				})
			),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})
	const [chartInterval, setChartInterval] = React.useState<LowercaseDwmcGrouping>('daily')
	const uniqueBreakdownNames = React.useMemo(() => Array.from(new Set(split.names)), [split.names])
	const {
		activeSeries: selectedTypes,
		selectableSeries,
		renderedCharts,
		setSelectedSeries: setSelectedTypes
	} = useLocalSelectionWithRemainder({
		scope: `${protocolName}:${adapterType}:${split.type}`,
		availableSeries: uniqueBreakdownNames
	})
	const exportChartExport = useGetChartInstance()
	const title = `${metric} by ${SPLIT_LABELS[split.type].title}`

	const chartBuilderConfig = React.useMemo<ChartBuilderConfig | null>(() => {
		// Revenue is a fees adapter metric with its own builder metric.
		const builderMetric = dataType === 'dailyRevenue' ? 'revenue' : getAdapterBuilderMetric(adapterType)

		// The chart builder splits a protocol only by chain.
		if (!builderMetric || split.type !== 'chain') return null

		let grouping: ChartBuilderConfig['grouping']
		switch (chartInterval) {
			case 'weekly':
				grouping = 'week'
				break
			case 'monthly':
				grouping = 'month'
				break
			case 'quarterly':
				grouping = 'quarter'
				break
			case 'yearly':
				grouping = 'year'
				break
			default:
				grouping = 'day'
				break
		}

		return {
			id: generateItemId('builder', `${protocolName}-${adapterType}`),
			kind: 'builder',
			name: title,
			config: {
				metric: builderMetric,
				mode: 'protocol',
				protocol: slug(protocolName),
				chains: [],
				categories: [],
				chainFilterMode: 'include',
				categoryFilterMode: 'include',
				chainCategoryFilterMode: 'include',
				protocolCategoryFilterMode: 'include',
				groupBy: 'protocol',
				limit: 10,
				chartType: 'stackedBar',
				displayAs: 'timeSeries'
			},
			grouping
		}
	}, [protocolName, adapterType, dataType, chartInterval, title, split.type])

	const data = query.data
	const mainChartData = React.useMemo(
		() => ({
			...buildProtocolBreakdownChartPresentation({
				data: data ?? [],
				seriesNames: uniqueBreakdownNames,
				chartInterval
			}),
			// Deferred together with the rows, so labels and exports never pair old rows with a new grouping.
			groupBy: chartInterval
		}),
		[uniqueBreakdownNames, chartInterval, data]
	)
	const deferredMainChartData = React.useDeferredValue(mainChartData)

	return (
		<>
			{/* The toolbar stays mounted while a new split loads, so the split switch keeps focus. */}
			<ChartPanelToolbar
				leading={
					options.length > 1 ? (
						<>
							{/* The switch names the split on screen; the heading names it for a screen reader's heading list. */}
							<ChartPanelTitle headingAs="h2">
								{metric} by<span className="sr-only"> {SPLIT_LABELS[split.type].title}</span>
							</ChartPanelTitle>
							<SegmentedControl<ProtocolBreakdownSplit>
								options={options.map((option) => ({ value: option.type, label: SPLIT_LABELS[option.type].option }))}
								value={split.type}
								onValueChange={onSplitChange}
								label={`${metric} by`}
								variant="default"
								size="md"
							/>
						</>
					) : (
						<ChartPanelTitle headingAs="h2">{title}</ChartPanelTitle>
					)
				}
			>
				<ChartGroupingSelector
					value={chartInterval}
					setValue={setChartInterval}
					options={DWMC_GROUPING_OPTIONS_LOWERCASE}
				/>
				{selectableSeries.length > 1 ? (
					<SelectWithCombobox
						allValues={selectableSeries}
						selectedValues={selectedTypes}
						setSelectedValues={setSelectedTypes}
						label={SPLIT_LABELS[split.type].filter}
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				{chartBuilderConfig ? <AddToDashboardButton chartConfig={chartBuilderConfig} smol /> : null}
				{data ? (
					<ChartExportButtons
						chart={exportChartExport}
						filename={title}
						title={`${protocolDisplayName} ${metric}`}
						iconUrl={tokenIconUrl(protocolDisplayName)}
						csvSource={{
							type: 'dataset',
							prepare: () => ({
								...selectChartDatasetColumns(
									deferredMainChartData.dataset,
									deferredMainChartData.charts.filter((chart) => renderedCharts.has(chart.name))
								),
								groupBy: deferredMainChartData.groupBy
							})
						}}
					/>
				) : null}
			</ChartPanelToolbar>
			{queryReadFailed(query) ? (
				<SurfaceBodyStatus variant="error" retry={query}>
					Couldn&apos;t load the {title} chart.
				</SurfaceBodyStatus>
			) : !data ? (
				<SurfaceBodyLoadingStatus label="Loading chart data" />
			) : (
				<React.Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" />}>
					<MultiSeriesChart
						exportButtons={exportChartExport}
						dataset={deferredMainChartData.dataset}
						charts={deferredMainChartData.charts}
						selectedCharts={renderedCharts}
						showLegend={renderedCharts.size > 1}
						groupBy={deferredMainChartData.groupBy}
						valueSymbol="$"
						showTotalInTooltip
						{...(hallmarks !== undefined ? { hallmarks } : {})}
					/>
				</React.Suspense>
			)}
		</>
	)
}
