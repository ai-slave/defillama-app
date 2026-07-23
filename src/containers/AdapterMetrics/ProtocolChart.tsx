import { useQuery } from '@tanstack/react-query'
import * as React from 'react'
import { AddToDashboardButton } from '~/components/AddToDashboard'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { buildSelectedSeriesCsv } from '~/components/ECharts/MultiSeriesChart/selection'
import type { ChartTimeGrouping } from '~/components/ECharts/MultiSeriesChart/types'
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
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from './constants'

const MultiSeriesChart = React.lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const buildAdapterProtocolBreakdownApiUrl = ({
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

export const DimensionProtocolChartByType = ({
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
	breakdownNames: string[]
	hallmarks?: [number, string][]
	title: string
}) => {
	const { data, isLoading, error } = useQuery({
		queryKey: ['dimension-adapter-chart-breakdown', protocolName, adapterType, dataType ?? null, chartType],
		queryFn: () =>
			fetchJson<Array<[number, Record<string, number>]>>(
				buildAdapterProtocolBreakdownApiUrl({
					adapterType,
					protocol: protocolName,
					dataType,
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
			protocolDisplayName={protocolDisplayName}
			adapterType={adapterType}
			hallmarks={hallmarks}
		/>
	)
}

const ChartByType = ({
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
	breakdownNames: string[]
	chartType: 'chain' | 'version'
	protocolName: string
	protocolDisplayName?: string
	adapterType: string
	hallmarks?: [number, string][]
}) => {
	const [chartInterval, changeChartInterval] = React.useState<LowercaseDwmcGrouping>('daily')
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
				groupBy: 'protocol',
				limit: 10,
				chartType: 'stackedBar',
				displayAs: 'timeSeries'
			},
			grouping
		}
	}, [protocolName, adapterType, chartInterval, title, chartType])

	const mainChartData = React.useMemo(() => {
		if (uniqueBreakdownNames.length === 0) return { dataset: { source: [], dimensions: ['timestamp'] }, charts: [] }

		// Helper to compute final date based on interval
		const computeFinalDate = (date: number) =>
			chartInterval === 'cumulative'
				? +date * 1e3
				: getBucketTimestampMs(+date * 1e3, chartInterval as ChartTimeGrouping)

		// Aggregate by date with interval grouping
		const aggregatedByDate = new Map<number, number[]>()
		const addChart = (chart: Array<[number, Record<string, number>]> | undefined) => {
			for (const [date, versions] of chart ?? []) {
				const finalDate = computeFinalDate(date)
				let values = aggregatedByDate.get(finalDate)
				if (!values) {
					values = new Array(uniqueBreakdownNames.length).fill(0)
					aggregatedByDate.set(finalDate, values)
				}
				for (let typeIndex = 0; typeIndex < uniqueBreakdownNames.length; typeIndex++) {
					values[typeIndex] += versions[uniqueBreakdownNames[typeIndex]] ?? 0
				}
			}
		}
		addChart(data)

		// Sort dates and build dataset rows
		const sortedDates = Array.from(aggregatedByDate.keys()).sort((a, b) => a - b)
		const isCumulative = chartInterval === 'cumulative'
		const cumulative = new Array<number>(uniqueBreakdownNames.length).fill(0)

		const source = sortedDates.map((date) => {
			const entry = aggregatedByDate.get(date)!
			const row = new Array<number | null>(uniqueBreakdownNames.length + 1)
			row[0] = date
			for (let typeIndex = 0; typeIndex < uniqueBreakdownNames.length; typeIndex++) {
				const value = entry[typeIndex]
				if (isCumulative) {
					cumulative[typeIndex] += value
					row[typeIndex + 1] = cumulative[typeIndex]
				} else {
					row[typeIndex + 1] = value
				}
			}
			return row
		})

		// Replace leading zeros with null for cleaner charts
		for (let typeIndex = 0; typeIndex < uniqueBreakdownNames.length; typeIndex++) {
			for (let i = 0; i < source.length && source[i][typeIndex + 1] === 0; i++) {
				source[i][typeIndex + 1] = null
			}
		}

		// Build chart config
		const allColors = getNDistinctColors(uniqueBreakdownNames.length)
		const stackColors = {}
		for (let i = 0; i < uniqueBreakdownNames.length; i++) {
			stackColors[uniqueBreakdownNames[i]] = allColors[i]
		}

		const chartType2: 'line' | 'bar' = isCumulative ? 'line' : 'bar'
		const chartsConfig = uniqueBreakdownNames.map((type, index) => ({
			type: chartType2,
			name: type,
			encode: { x: 0, y: index + 1 },
			stack: 'chartType',
			color: stackColors[type]
		}))

		return {
			dataset: { source, dimensions: ['timestamp', ...uniqueBreakdownNames] },
			charts: chartsConfig
		}
	}, [uniqueBreakdownNames, chartInterval, data])
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
					setValue={changeChartInterval}
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
					prepareCsvDirect={() =>
						buildSelectedSeriesCsv({
							dataset: deferredMainChartData.dataset,
							charts: deferredMainChartData.charts,
							selectedCharts: renderedCharts,
							filename: exportFilename
						})
					}
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
					hallmarks={hallmarks}
					onReady={handleChartReady}
				/>
			</React.Suspense>
		</>
	)
}
