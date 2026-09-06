import { lazy, Suspense, useContext, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { buildCompleteProtocolBreakdownDataset } from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { useProtocolBreakdownPresentation } from '~/containers/ProtocolOverview/useProtocolBreakdownPresentation'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { BORROWED_CHART_OPTIONS, BORROWED_CHART_TYPE_LABELS } from '../borrowedChartConstants'
import { useProDashboardCatalog, useProDashboardTime } from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '../queryPolicy'
import { shouldSuppressBorrowedTokenBreakdown } from '../services/protocolTvl'
import type { BorrowedChartConfig } from '../types'
import { prepareProChartCsv } from './chartCsv'
import { CSVExportButton } from './CSVExportButton'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { LoadingSpinner } from './LoadingSpinner'
import { useBorrowedChartData } from './useBorrowedChartData'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))

const EMPTY_DATASET: TimestampDataset = {
	source: [],
	dimensions: ['timestamp']
}
const EMPTY_CHARTS: Array<MultiSeriesChartSeriesConfig> = []
const HIDDEN_EXPORTS = 'hidden' as const
const DOLLAR_CHART_OPTIONS = {
	...BORROWED_CHART_OPTIONS,
	...createTimeSeriesChartOptions('$')
}
const UNITLESS_CHART_OPTIONS = {
	...BORROWED_CHART_OPTIONS,
	...createTimeSeriesChartOptions('')
}

interface BorrowedChartCardProps {
	config: BorrowedChartConfig
}

export function BorrowedChartCard({ config }: BorrowedChartCardProps) {
	const { protocol, protocolName, chartType } = config
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const streamDone = useContext(StreamDoneContext)
	const { getProtocolInfo } = useProDashboardCatalog()
	const suppressTokenBreakdown = shouldSuppressBorrowedTokenBreakdown(
		chartType,
		getProtocolInfo(protocol)?.misrepresentedTokens
	)
	const {
		data: borrowedData,
		isLoading,
		hasSourceData
	} = useBorrowedChartData({
		protocol,
		chartType,
		enabled: streamDone && !suppressTokenBreakdown,
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME
	})
	const seriesNames = borrowedData.seriesNames
	const pieSeriesNames = useMemo(
		() => borrowedData.pieSeries.peers.map((peer) => peer.name),
		[borrowedData.pieSeries.peers]
	)
	const isRuntimeBreakdown = chartType !== 'tokensBorrowedPie'
	const runtimePresentation = useProtocolBreakdownPresentation({
		breakdown: borrowedData.breakdown ?? [],
		availableSeries: isRuntimeBreakdown ? seriesNames : [],
		defaultSeries: borrowedData.defaultSeriesNames,
		aggregateOthers: chartType === 'chainsBorrowed' || chartType === 'tokenBorrowedUsd',
		type: 'line',
		fillMissingWithZero: true,
		selectionKey: `${protocol}:${chartType}`
	})
	const rawDataset = isRuntimeBreakdown ? runtimePresentation.dataset : EMPTY_DATASET
	const visibleCharts = useMemo(() => {
		if (chartType === 'tokensBorrowedPie') return EMPTY_CHARTS
		return runtimePresentation.charts.map((chart) => ({ ...chart, hideAreaStyle: true }))
	}, [chartType, runtimePresentation.charts])

	const selectorValues = seriesNames
	const pieSelection = useAllSeriesSelection({
		availableSeries: pieSeriesNames,
		selectionKey: `${protocol}:tokensBorrowedPie`
	})
	const piePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: borrowedData.pieSeries,
				selectedSeries: pieSelection.selectedCharts,
				includeUpstreamOthers: pieSelection.includeUpstreamOthers
			}),
		[borrowedData.pieSeries, pieSelection.includeUpstreamOthers, pieSelection.selectedCharts]
	)
	const selectorLabel = chartType === 'chainsBorrowed' ? 'Chain' : 'Token'

	const rawVisibleDataset = chartType === 'tokensBorrowedPie' ? EMPTY_DATASET : rawDataset
	const filteredDataset = useMemo(
		() => filterChartDatasetByTimePeriod(rawVisibleDataset, timePeriod, customTimePeriod),
		[rawVisibleDataset, timePeriod, customTimePeriod]
	)
	const canonicalDataset = chartType === 'tokensBorrowedPie' ? EMPTY_DATASET : filteredDataset

	const prepareCsvExport = () => {
		let exportDataset: MultiSeriesChartDataset = filteredDataset
		const protocolSlug = protocol.toLowerCase().replace(/\s+/g, '-')
		let filename: string

		switch (chartType) {
			case 'chainsBorrowed':
				filename = `${protocolSlug}-borrowed-by-chain`
				break
			case 'tokenBorrowedUsd':
				filename = `${protocolSlug}-borrowed-by-token-usd`
				break
			case 'tokensBorrowedPie':
				exportDataset = buildRuntimePieChartCsvDataset(borrowedData.pieSeries)
				filename = `${protocolSlug}-borrowed-tokens-breakdown`
				break
			case 'tokenBorrowedRaw':
				filename = `${protocolSlug}-borrowed-by-token-raw`
				break
		}

		if (isRuntimeBreakdown) {
			const completeDataset = buildCompleteProtocolBreakdownDataset({
				breakdown: borrowedData.breakdown,
				availableSeries: seriesNames,
				includeUpstreamOthers: chartType === 'chainsBorrowed' || chartType === 'tokenBorrowedUsd',
				fillMissingWithZero: true
			})
			if (!completeDataset) throw new Error('Borrowed chart data is unavailable')
			exportDataset = filterChartDatasetByTimePeriod(completeDataset, timePeriod, customTimePeriod)
		}

		return prepareProChartCsv(exportDataset, filename)
	}

	const chartTypeLabel = BORROWED_CHART_TYPE_LABELS[chartType] || chartType
	const imageTitle = `${protocolName} - ${chartTypeLabel}`
	const imageFilename = `${protocol.toLowerCase().replace(/\s+/g, '-')}-${chartType}`

	if (isLoading || (!streamDone && !hasSourceData && !suppressTokenBreakdown)) {
		return (
			<div className="flex h-full min-h-[360px] items-center justify-center">
				<LoadingSpinner />
			</div>
		)
	}

	const chartContent = (() => {
		switch (chartType) {
			case 'chainsBorrowed':
				return (
					<MultiSeriesChart
						title=""
						dataset={canonicalDataset}
						charts={visibleCharts}
						selectedCharts={runtimePresentation.selectedCharts}
						valueSymbol="$"
						hideDefaultLegend
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORTS}
						onReady={handleChartReady}
					/>
				)
			case 'tokenBorrowedUsd':
				return (
					<MultiSeriesChart
						title=""
						dataset={canonicalDataset}
						charts={visibleCharts}
						selectedCharts={runtimePresentation.selectedCharts}
						valueSymbol="$"
						hideDefaultLegend
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORTS}
						onReady={handleChartReady}
					/>
				)
			case 'tokensBorrowedPie':
				return (
					<PieChart
						chartData={piePresentation.chartData}
						stackColors={piePresentation.stackColors}
						exportButtons="hidden"
						onReady={handleChartReady}
					/>
				)
			case 'tokenBorrowedRaw':
				return (
					<MultiSeriesChart
						title=""
						dataset={canonicalDataset}
						charts={visibleCharts}
						selectedCharts={runtimePresentation.selectedCharts}
						valueSymbol=""
						hideDefaultLegend
						chartOptions={UNITLESS_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORTS}
						onReady={handleChartReady}
					/>
				)
			default:
				return null
		}
	})()

	const hasChartData =
		chartType === 'tokensBorrowedPie'
			? borrowedData.pieSeries.peers.length > 0 || borrowedData.pieSeries.upstreamOthersValue > 0
			: filteredDataset.source.length > 0

	return (
		<div className="flex h-full flex-col p-2">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{chartTypeLabel}</h3>
					<p className="text-xs text-pro-text-secondary">{protocolName}</p>
				</div>
				{hasChartData ? (
					<div className="flex flex-wrap items-center justify-end gap-2">
						{chartType === 'tokensBorrowedPie' && pieSeriesNames.length > 1 ? (
							<SelectWithCombobox
								allValues={pieSeriesNames}
								selectedValues={pieSelection.activeSeries}
								setSelectedValues={pieSelection.setSelectedSeries}
								label="Token"
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : chartType !== 'tokensBorrowedPie' && selectorValues.length > 1 ? (
							<SelectWithCombobox
								allValues={selectorValues}
								selectedValues={runtimePresentation.activeSeries}
								setSelectedValues={runtimePresentation.setSelectedSeries}
								label={selectorLabel}
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : null}
						<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
						<CSVExportButton
							prepareCsv={prepareCsvExport}
							smol
							className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
						/>
					</div>
				) : null}
			</div>

			<div className="flex-1">
				<Suspense fallback={<div className="min-h-[360px]" />}>{chartContent}</Suspense>
			</div>
		</div>
	)
}
