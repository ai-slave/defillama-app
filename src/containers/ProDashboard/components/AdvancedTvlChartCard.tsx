import { useQuery } from '@tanstack/react-query'
import { lazy, type ReactNode, Suspense, useContext, useMemo } from 'react'
import { buildTimeSeriesDataset, type TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { IProtocolValueChart } from '~/containers/ProtocolOverview/api.types'
import {
	buildProtocolBreakdownCsvDataset,
	buildProtocolBreakdownPresentation,
	MAX_PROTOCOL_BREAKDOWN_SERIES,
	type ProtocolBreakdownChart
} from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import {
	buildProtocolValueChartQueryKey,
	fetchProtocolValueChart
} from '~/containers/ProtocolOverview/valueChartSources'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { queryReadFailed } from '~/utils/query'
import { useProDashboardCatalog, useProDashboardTime } from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '../queryPolicy'
import { shouldSuppressAdvancedTvlTokenBreakdown } from '../services/protocolTvl'
import type { AdvancedTvlChartConfig } from '../types'
import { ProMeta } from '../ui'
import { buildAdvancedTvlPresentation } from './advancedTvlPresentation'
import { BoundParameterBadge } from './BoundParameterBadge'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { prepareProChartCsv } from './chartCsv'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { ProCardHeader } from './ProCardHeader'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'
import { useAdvancedTvlChartData } from './useAdvancedTvlChartData'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))

const EMPTY_DATASET: TimestampDataset = {
	source: [],
	dimensions: ['timestamp']
}
const EMPTY_STACKS: Array<string> = []
const EMPTY_BREAKDOWN: ProtocolBreakdownChart = []
const HIDDEN_EXPORTS = 'hidden' as const
const selectBasicTvlDataset = (data: IProtocolValueChart | null) => buildTimeSeriesDataset(data ?? [], 'TVL', 1)

interface AdvancedTvlChartCardProps {
	config: AdvancedTvlChartConfig
}

const CHART_TYPE_LABELS: Record<string, string> = {
	tvl: 'TVL',
	chainsTvl: 'TVL by Chains',
	tokenValuesUsd: 'Token Values (USD)',
	tokensPie: 'Tokens Breakdown',
	tokenBalances: 'Token Balances (Raw)',
	usdInflows: 'USD Inflows',
	tokenInflows: 'Inflows by Token'
}

export function AdvancedTvlChartCard({ config }: AdvancedTvlChartCardProps) {
	const { protocol, protocolName, chartType } = config
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const streamDone = useContext(StreamDoneContext)
	const { getProtocolInfo } = useProDashboardCatalog()
	const suppressTokenBreakdowns = shouldSuppressAdvancedTvlTokenBreakdown(
		chartType,
		getProtocolInfo(protocol)?.misrepresentedTokens
	)

	const basicTvlQuery = useQuery({
		queryKey: buildProtocolValueChartQueryKey({ source: 'tvl', protocol }),
		queryFn: () => fetchProtocolValueChart({ source: 'tvl', protocol }),
		enabled: streamDone && chartType === 'tvl',
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		select: selectBasicTvlDataset
	})
	const { data: basicTvlDataset, isLoading: isBasicTvlLoading } = basicTvlQuery
	const advancedQuery = useAdvancedTvlChartData({
		protocol,
		protocolName,
		chartType,
		extraTvlsEnabled,
		enabled: streamDone && chartType !== 'tvl' && !suppressTokenBreakdowns
	})
	const advancedData = advancedQuery.data
	const advancedSeriesNames = advancedData.seriesNames
	const pieSeriesNames = useMemo(
		() => advancedData.pieSeries.peers.map((peer) => peer.name),
		[advancedData.pieSeries.peers]
	)
	const resolvedBasicTvlDataset = basicTvlDataset ?? EMPTY_DATASET
	const isRuntimeBreakdown =
		chartType === 'chainsTvl' ||
		chartType === 'tokenValuesUsd' ||
		chartType === 'tokenBalances' ||
		chartType === 'tokenInflows'
	const selectorValues = isRuntimeBreakdown ? advancedSeriesNames : EMPTY_STACKS
	const aggregateOthers = chartType === 'chainsTvl' || chartType === 'tokenValuesUsd' || chartType === 'tokenInflows'
	const { activeSeries, setSelectedSeries, isDefaultSelection } = useLocalSelection({
		availableSeries: selectorValues,
		defaultSeries: advancedData.defaultSeriesNames,
		...(aggregateOthers ? {} : { maxSelectedSeries: MAX_PROTOCOL_BREAKDOWN_SERIES }),
		allowEmptySelection: true,
		scope: `${protocol}:${chartType}`
	})
	const runtimePresentation = useMemo(() => {
		const presentation = buildProtocolBreakdownPresentation({
			breakdown: advancedData.breakdown ?? EMPTY_BREAKDOWN,
			availableSeries: selectorValues,
			activeSeries,
			aggregateOthers,
			includeUpstreamOthers: aggregateOthers && isDefaultSelection,
			type: chartType === 'tokenInflows' ? 'bar' : 'line',
			...(chartType === 'tokenInflows' ? { stack: 'stackA' } : {}),
			fillMissingWithZero: true
		})
		return {
			...presentation,
			dataset: presentation.dataset ?? EMPTY_DATASET,
			activeSeries,
			setSelectedSeries,
			selectedCharts: new Set(presentation.charts.map((chart) => chart.name))
		}
	}, [
		activeSeries,
		advancedData.breakdown,
		aggregateOthers,
		chartType,
		isDefaultSelection,
		selectorValues,
		setSelectedSeries
	])
	const advancedDataset = isRuntimeBreakdown ? runtimePresentation.dataset : (advancedData.dataset ?? EMPTY_DATASET)
	const renderedSeries = useMemo(
		() => runtimePresentation.charts.map((chart) => chart.name),
		[runtimePresentation.charts]
	)

	const presentation = useMemo(
		() =>
			buildAdvancedTvlPresentation({
				chartType,
				chainsDataset: chartType === 'chainsTvl' ? advancedDataset : EMPTY_DATASET,
				chainNames: chartType === 'chainsTvl' ? renderedSeries : EMPTY_STACKS,
				tokenNames: chartType === 'chainsTvl' ? EMPTY_STACKS : renderedSeries
			}),
		[chartType, advancedDataset, renderedSeries]
	)
	const pieSelection = useLocalSelection({
		allowEmptySelection: true,
		availableSeries: pieSeriesNames,
		scope: `${protocol}:tokensPie`
	})
	const piePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: advancedData.pieSeries,
				selectedSeries: pieSelection.selectedCharts
			}),
		[advancedData.pieSeries, pieSelection.selectedCharts]
	)
	const selectorLabel = chartType === 'chainsTvl' ? 'Chain' : 'Token'

	const rawVisibleDataset = chartType === 'tvl' ? resolvedBasicTvlDataset : advancedDataset
	const filteredDataset = useMemo(
		() => filterChartDatasetByTimePeriod(rawVisibleDataset, timePeriod, customTimePeriod),
		[rawVisibleDataset, timePeriod, customTimePeriod]
	)
	const canonicalDataset = filteredDataset

	const prepareCsvExport = () => {
		let exportDataset: MultiSeriesChartDataset = filteredDataset
		const protocolSlug = protocol.toLowerCase().replace(/\s+/g, '-')
		let filename: string

		switch (chartType) {
			case 'tvl':
				filename = `${protocolSlug}-tvl`
				break
			case 'chainsTvl':
				filename = `${protocolSlug}-tvl-by-chains`
				break
			case 'tokenValuesUsd':
				filename = `${protocolSlug}-token-values-usd`
				break
			case 'tokensPie':
				exportDataset = buildRuntimePieChartCsvDataset({
					series: advancedData.pieSeries,
					selectedSeries: pieSelection.selectedCharts
				})
				filename = `${protocolSlug}-tokens-breakdown`
				break
			case 'tokenBalances':
				filename = `${protocolSlug}-token-balances`
				break
			case 'usdInflows':
				filename = `${protocolSlug}-usd-inflows`
				break
			case 'tokenInflows':
				filename = `${protocolSlug}-token-inflows`
				break
		}

		if (isRuntimeBreakdown) {
			const pickedDataset = buildProtocolBreakdownCsvDataset({
				breakdown: advancedData.breakdown,
				availableSeries: selectorValues,
				activeSeries,
				includeUpstreamOthers: aggregateOthers && isDefaultSelection,
				fillMissingWithZero: true
			})
			exportDataset = filterChartDatasetByTimePeriod(pickedDataset, timePeriod, customTimePeriod)
		}

		return prepareProChartCsv(exportDataset, filename)
	}

	const chartTypeLabel = CHART_TYPE_LABELS[chartType] || chartType
	const imageTitle = `${protocolName} - ${chartTypeLabel}`
	const imageFilename = `${protocol.toLowerCase().replace(/\s+/g, '-')}-${chartType}`
	const isLoading =
		chartType === 'tvl'
			? isBasicTvlLoading || (!streamDone && basicTvlDataset === undefined)
			: advancedQuery.isLoading || (!streamDone && !advancedQuery.hasSourceData && !suppressTokenBreakdowns)

	const hasError = chartType === 'tvl' ? queryReadFailed(basicTvlQuery) : advancedQuery.readFailed
	const hasLoadedData = chartType === 'tvl' ? basicTvlDataset !== undefined : advancedQuery.hasSourceData
	const retryChartData = chartType === 'tvl' ? basicTvlQuery : advancedQuery

	const hallmarks = useDashboardAnnotationHallmarks()
	const syncGroup = useChartSyncGroup()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(360, cardHeightScale)

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex min-h-[calc(402px*var(--card-scale,1))] flex-col p-0 md:min-h-[calc(418px*var(--card-scale,1))]">
			<ProCardHeader titleAs="h3" title={chartTypeLabel} subtitle={<ProMeta items={[protocolName]} />} />
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (hasError && !hasLoadedData) {
		return renderStatusShell(<ProCardError retry={retryChartData} />)
	}

	if (isLoading) {
		return renderStatusShell(<ProCardLoading />)
	}

	const chartContent =
		chartType === 'tokensPie' ? (
			<PieChart
				chartData={piePresentation.chartData}
				stackColors={piePresentation.stackColors}
				exportButtons="hidden"
				height={chartHeight}
				onReady={handleChartReady}
			/>
		) : (
			<MultiSeriesChart
				{...(hallmarks ? { hallmarks } : {})}
				{...(syncGroup ? { syncGroup } : {})}
				dataset={canonicalDataset}
				charts={presentation.charts}
				{...(selectorValues.length > 0 ? { selectedCharts: runtimePresentation.selectedCharts } : {})}
				valueSymbol={presentation.valueSymbol}
				hideDataZoom={presentation.hideDataZoom}
				solidChartAreaStyle={presentation.solidChartAreaStyle}
				{...(presentation.chartOptions ? { chartOptions: presentation.chartOptions } : {})}
				exportButtons={HIDDEN_EXPORTS}
				height={chartHeight}
				onReady={handleChartReady}
			/>
		)

	const hasChartData =
		chartType === 'tokensPie'
			? advancedData.pieSeries.peers.length > 0 || advancedData.pieSeries.upstreamOthersValue > 0
			: filteredDataset.source.length > 0

	return (
		<div className="flex min-h-[calc(402px*var(--card-scale,1))] flex-col p-0 md:min-h-[calc(418px*var(--card-scale,1))]">
			{hasError ? <ProCardRefreshFailed retry={retryChartData} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={chartTypeLabel}
				badge={<BoundParameterBadge {...(config.bindings === undefined ? {} : { bindings: config.bindings })} />}
				subtitle={<ProMeta items={[protocolName]} />}
				viewerControls={
					hasChartData ? (
						chartType === 'tokensPie' && pieSeriesNames.length > 1 ? (
							<SelectWithCombobox
								allValues={pieSeriesNames}
								selectedValues={pieSelection.activeSeries}
								setSelectedValues={pieSelection.setSelectedSeries}
								label="Token"
								labelType="smol"
								variant="filter"
								size="sm"
							/>
						) : selectorValues.length > 1 ? (
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
