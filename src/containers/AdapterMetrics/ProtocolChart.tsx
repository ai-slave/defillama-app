import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard/AddToDashboardButton'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
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
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { ChartBuilderConfig } from '~/containers/ProDashboard/types'
import { getAdapterBuilderMetric } from '~/containers/ProDashboard/utils/adapterChartMapping'
import { generateItemId } from '~/containers/ProDashboard/utils/dashboardUtils'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useSeriesSelectionWithFixedRemainder } from '~/hooks/useSeriesSelection'
import { ChartPanelBodyFallback, ChartPanelExportShellFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { LoadingIndicator } from '~/ui/Status'
import { getNDistinctColors, slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { tokenIconUrl } from '~/utils/icons'
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

function getPaletteColor(colors: Array<string>, index: number): string {
	const color = colors[index]
	if (color === undefined) throw new Error(`Protocol breakdown palette is missing color ${index}`)
	return color
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

	const colors = getNDistinctColors(seriesNames.length)
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
			color: getPaletteColor(colors, index)
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
	type: 'chain' | 'version'
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

export function DimensionProtocolChartByType({
	protocolName,
	protocolDisplayName,
	adapterType,
	dataType,
	chartType,
	breakdownNames,
	hallmarks,
	title
}: {
	protocolName: string
	protocolDisplayName?: string
	adapterType: `${ADAPTER_TYPES}`
	dataType?: `${ADAPTER_DATA_TYPES}`
	chartType: 'chain' | 'version'
	breakdownNames: Array<string>
	hallmarks?: Array<[number, string]>
	title: string
}) {
	const { data, isLoading, error } = useQuery({
		queryKey: ['dimension-adapter-chart-breakdown', protocolName, adapterType, dataType ?? null, chartType],
		queryFn: () =>
			fetchJson<Array<[number, Record<string, number>]>>(
				buildAdapterProtocolBreakdownApiUrl({
					adapterType,
					protocol: protocolName,
					...(dataType !== undefined ? { dataType } : {}),
					type: chartType
				})
			),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	if (isLoading) {
		return (
			<ChartPanelExportShellFallback
				role="status"
				aria-live="polite"
				className="col-span-2 flex flex-col items-center justify-center"
			>
				<LoadingIndicator />
				<span className="sr-only">Loading chart data</span>
			</ChartPanelExportShellFallback>
		)
	}

	if (error) {
		return (
			<ChartPanelExportShellFallback role="alert" className="col-span-2 flex flex-col items-center justify-center">
				<div className="flex flex-col gap-2 p-2">
					<p className="text-xs break-all text-error">
						{error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)}
					</p>
				</div>
			</ChartPanelExportShellFallback>
		)
	}

	return (
		<ChartByType
			data={data ?? []}
			breakdownNames={breakdownNames}
			title={title}
			chartType={chartType}
			protocolName={protocolName}
			adapterType={adapterType}
			{...(protocolDisplayName !== undefined ? { protocolDisplayName } : {})}
			{...(hallmarks !== undefined ? { hallmarks } : {})}
		/>
	)
}

function ChartByType({
	data,
	title,
	breakdownNames,
	chartType,
	protocolName,
	protocolDisplayName,
	adapterType,
	hallmarks
}: {
	data: Array<[number, Record<string, number>]>
	title?: string
	breakdownNames: Array<string>
	chartType: 'chain' | 'version'
	protocolName: string
	protocolDisplayName?: string
	adapterType: string
	hallmarks?: Array<[number, string]>
}) {
	const [chartInterval, setChartInterval] = React.useState<LowercaseDwmcGrouping>('daily')
	const uniqueBreakdownNames = React.useMemo(() => Array.from(new Set(breakdownNames)), [breakdownNames])
	const {
		activeSeries: selectedTypes,
		selectableSeries,
		renderedCharts,
		setSelectedSeries: setSelectedTypes
	} = useSeriesSelectionWithFixedRemainder({ availableSeries: uniqueBreakdownNames })
	const { chartInstance: exportChartInstance, handleChartReady } = useGetChartInstance()

	const chartBuilderConfig = React.useMemo<ChartBuilderConfig | null>(() => {
		const builderMetric = getAdapterBuilderMetric(adapterType)

		if (!builderMetric || chartType === 'version') return null

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
			name: title || `${protocolName} – ${adapterType}`,
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
	}, [protocolName, adapterType, chartInterval, title, chartType])

	const mainChartData = React.useMemo(
		() =>
			buildProtocolBreakdownChartPresentation({
				data,
				seriesNames: uniqueBreakdownNames,
				chartInterval
			}),
		[uniqueBreakdownNames, chartInterval, data]
	)
	const deferredMainChartData = React.useDeferredValue(mainChartData)
	const exportProtocolName = protocolDisplayName ?? protocolName
	const exportMetricTitle = title?.replace(/\s+by\s+(?:chain|protocol version)$/i, '')
	const exportTitle = exportMetricTitle ? `${exportProtocolName} ${exportMetricTitle}` : exportProtocolName
	const exportFilename = title ? title : `${protocolName}-${chartType}`

	return (
		<>
			<ChartPanelToolbar className="justify-end">
				{title ? <h2 className="mr-auto heading-xs">{title}</h2> : null}
				<ChartGroupingSelector
					value={chartInterval}
					setValue={setChartInterval}
					options={DWMC_GROUPING_OPTIONS_LOWERCASE}
					className="ml-auto"
				/>
				{selectableSeries.length > 1 ? (
					<SelectWithCombobox
						allValues={selectableSeries}
						selectedValues={selectedTypes}
						setSelectedValues={setSelectedTypes}
						label={chartType === 'version' ? 'Versions' : 'Chains'}
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
				<ChartExportButtons
					chartInstance={exportChartInstance}
					filename={exportFilename}
					title={exportTitle}
					iconUrl={tokenIconUrl(exportProtocolName)}
					csvSource={{ type: 'dataset', prepare: () => deferredMainChartData.dataset }}
				/>
				{chartBuilderConfig ? <AddToDashboardButton chartConfig={chartBuilderConfig} smol /> : null}
			</ChartPanelToolbar>
			<React.Suspense fallback={<ChartPanelBodyFallback />}>
				<MultiSeriesChart
					dataset={deferredMainChartData.dataset}
					charts={deferredMainChartData.charts}
					selectedCharts={renderedCharts}
					groupBy={chartInterval}
					valueSymbol="$"
					showTotalInTooltip
					{...(hallmarks !== undefined ? { hallmarks } : {})}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</>
	)
}
