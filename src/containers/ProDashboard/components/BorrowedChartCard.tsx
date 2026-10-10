import { lazy, type ReactNode, Suspense, useContext, useMemo } from 'react'
import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { buildProtocolBreakdownCsvDataset } from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import { useProtocolBreakdownPresentation } from '~/containers/ProtocolOverview/useProtocolBreakdownPresentation'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { BORROWED_CHART_OPTIONS, BORROWED_CHART_TYPE_LABELS } from '../borrowedChartConstants'
import { useProDashboardCatalog, useProDashboardTime } from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '../queryPolicy'
import { shouldSuppressBorrowedTokenBreakdown } from '../services/protocolTvl'
import type { BorrowedChartConfig } from '../types'
import { ProMeta } from '../ui'
import { BoundParameterBadge } from './BoundParameterBadge'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { prepareProChartCsv } from './chartCsv'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { ProCardHeader } from './ProCardHeader'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'
import { useBorrowedChartData } from './useBorrowedChartData'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'

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
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const streamDone = useContext(StreamDoneContext)
	const { getProtocolInfo } = useProDashboardCatalog()
	const suppressTokenBreakdown = shouldSuppressBorrowedTokenBreakdown(
		chartType,
		getProtocolInfo(protocol)?.misrepresentedTokens
	)
	const borrowedQuery = useBorrowedChartData({
		protocol,
		chartType,
		enabled: streamDone && !suppressTokenBreakdown,
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME
	})
	const { data: borrowedData, isLoading, readFailed, refreshFailed, hasSourceData } = borrowedQuery
	const seriesNames = borrowedData.seriesNames
	const pieSeriesNames = useMemo(
		() => borrowedData.pieSeries.peers.map((peer) => peer.name),
		[borrowedData.pieSeries.peers]
	)
	const isRuntimeBreakdown = chartType !== 'tokensBorrowedPie'
	const aggregateOthers = chartType === 'chainsBorrowed' || chartType === 'tokenBorrowedUsd'
	const runtimePresentation = useProtocolBreakdownPresentation({
		breakdown: borrowedData.breakdown ?? [],
		availableSeries: isRuntimeBreakdown ? seriesNames : [],
		defaultSeries: borrowedData.defaultSeriesNames,
		aggregateOthers,
		type: 'line',
		fillMissingWithZero: true,
		scope: `${protocol}:${chartType}`
	})
	const rawDataset = isRuntimeBreakdown ? runtimePresentation.dataset : EMPTY_DATASET
	const visibleCharts = useMemo(() => {
		if (chartType === 'tokensBorrowedPie') return EMPTY_CHARTS
		return runtimePresentation.charts.map((chart) => ({ ...chart, hideAreaStyle: true }))
	}, [chartType, runtimePresentation.charts])

	const selectorValues = seriesNames
	const pieSelection = useLocalSelection({
		allowEmptySelection: true,
		availableSeries: pieSeriesNames,
		scope: `${protocol}:tokensBorrowedPie`
	})
	const piePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: borrowedData.pieSeries,
				selectedSeries: pieSelection.selectedCharts
			}),
		[borrowedData.pieSeries, pieSelection.selectedCharts]
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
				exportDataset = buildRuntimePieChartCsvDataset({
					series: borrowedData.pieSeries,
					selectedSeries: pieSelection.selectedCharts
				})
				filename = `${protocolSlug}-borrowed-tokens-breakdown`
				break
			case 'tokenBorrowedRaw':
				filename = `${protocolSlug}-borrowed-by-token-raw`
				break
		}

		if (isRuntimeBreakdown) {
			const pickedDataset = buildProtocolBreakdownCsvDataset({
				breakdown: borrowedData.breakdown,
				availableSeries: seriesNames,
				activeSeries: runtimePresentation.activeSeries,
				includeUpstreamOthers: aggregateOthers && runtimePresentation.isDefaultSelection,
				fillMissingWithZero: true
			})
			exportDataset = filterChartDatasetByTimePeriod(pickedDataset, timePeriod, customTimePeriod)
		}

		return prepareProChartCsv(exportDataset, filename)
	}

	const chartTypeLabel = BORROWED_CHART_TYPE_LABELS[chartType] || chartType
	const imageTitle = `${protocolName} - ${chartTypeLabel}`
	const imageFilename = `${protocol.toLowerCase().replace(/\s+/g, '-')}-${chartType}`

	const hallmarks = useDashboardAnnotationHallmarks()
	const syncGroup = useChartSyncGroup()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(360, cardHeightScale)

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex h-full min-h-[calc(360px*var(--card-scale,1))] flex-col p-0">
			<ProCardHeader titleAs="h3" title={chartTypeLabel} subtitle={<ProMeta items={[protocolName]} />} />
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (readFailed) {
		return renderStatusShell(<ProCardError retry={borrowedQuery} />)
	}

	if (isLoading || (!streamDone && !hasSourceData && !suppressTokenBreakdown)) {
		return renderStatusShell(<ProCardLoading />)
	}

	const chartContent = (() => {
		switch (chartType) {
			case 'chainsBorrowed':
				return (
					<MultiSeriesChart
						height={chartHeight}
						{...(hallmarks ? { hallmarks } : {})}
						{...(syncGroup ? { syncGroup } : {})}
						dataset={canonicalDataset}
						charts={visibleCharts}
						selectedCharts={runtimePresentation.selectedCharts}
						valueSymbol="$"
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORTS}
						onReady={handleChartReady}
					/>
				)
			case 'tokenBorrowedUsd':
				return (
					<MultiSeriesChart
						height={chartHeight}
						{...(hallmarks ? { hallmarks } : {})}
						{...(syncGroup ? { syncGroup } : {})}
						dataset={canonicalDataset}
						charts={visibleCharts}
						selectedCharts={runtimePresentation.selectedCharts}
						valueSymbol="$"
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
						height={chartHeight}
						onReady={handleChartReady}
					/>
				)
			case 'tokenBorrowedRaw':
				return (
					<MultiSeriesChart
						height={chartHeight}
						{...(hallmarks ? { hallmarks } : {})}
						{...(syncGroup ? { syncGroup } : {})}
						dataset={canonicalDataset}
						charts={visibleCharts}
						selectedCharts={runtimePresentation.selectedCharts}
						valueSymbol=""
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
		<div className="flex h-full flex-col p-0">
			{refreshFailed ? <ProCardRefreshFailed retry={borrowedQuery} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={chartTypeLabel}
				badge={<BoundParameterBadge {...(config.bindings === undefined ? {} : { bindings: config.bindings })} />}
				subtitle={<ProMeta items={[protocolName]} />}
				viewerControls={
					hasChartData ? (
						chartType === 'tokensBorrowedPie' && pieSeriesNames.length > 1 ? (
							<SelectWithCombobox
								allValues={pieSeriesNames}
								selectedValues={pieSelection.activeSeries}
								setSelectedValues={pieSelection.setSelectedSeries}
								label="Token"
								labelType="smol"
								variant="filter"
								size="sm"
							/>
						) : chartType !== 'tokensBorrowedPie' && selectorValues.length > 1 ? (
							<SelectWithCombobox
								allValues={selectorValues}
								selectedValues={runtimePresentation.activeSeries}
								setSelectedValues={runtimePresentation.setSelectedSeries}
								label={selectorLabel}
								labelType="smol"
								variant="filter"
								size="sm"
							/>
						) : null
					) : null
				}
				menu={
					hasChartData
						? {
								image: { chartInstance, filename: imageFilename, title: imageTitle },
								csv: { prepareCsv: prepareCsvExport }
							}
						: {}
				}
			/>
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
				<div className="flex-1">
					<Suspense fallback={<div className="min-h-[calc(360px*var(--card-scale,1))]" />}>{chartContent}</Suspense>
				</div>
			</div>
		</div>
	)
}
