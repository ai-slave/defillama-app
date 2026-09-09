import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useMemo } from 'react'
import { buildTimeSeriesDataset, type TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { IProtocolValueChart } from '~/containers/ProtocolOverview/api.types'
import {
	buildCompleteProtocolBreakdownDataset,
	buildProtocolBreakdownPresentation,
	MAX_PROTOCOL_BREAKDOWN_SERIES,
	type ProtocolBreakdownChart
} from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import {
	buildProtocolValueChartQueryKey,
	fetchProtocolValueChart
} from '~/containers/ProtocolOverview/valueChartSources'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useAllSeriesSelection, useSeriesSelection } from '~/hooks/useSeriesSelection'
import { useProDashboardCatalog, useProDashboardTime } from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import { PRO_DASHBOARD_METRIC_STALE_TIME } from '../queryPolicy'
import { shouldSuppressAdvancedTvlTokenBreakdown } from '../services/protocolTvl'
import type { AdvancedTvlChartConfig } from '../types'
import { buildAdvancedTvlPresentation } from './advancedTvlPresentation'
import { prepareProChartCsv } from './chartCsv'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { LoadingSpinner } from './LoadingSpinner'
import { ProCardOverflowMenu } from './ProCardActions'
import { useAdvancedTvlChartData } from './useAdvancedTvlChartData'

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
	const { chartInstance, handleChartReady } = useChartImageExport()
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const streamDone = useContext(StreamDoneContext)
	const { getProtocolInfo } = useProDashboardCatalog()
	const suppressTokenBreakdowns = shouldSuppressAdvancedTvlTokenBreakdown(
		chartType,
		getProtocolInfo(protocol)?.misrepresentedTokens
	)

	const { data: basicTvlDataset, isLoading: isBasicTvlLoading } = useQuery({
		queryKey: buildProtocolValueChartQueryKey({ source: 'tvl', protocol }),
		queryFn: () => fetchProtocolValueChart({ source: 'tvl', protocol }),
		enabled: streamDone && chartType === 'tvl',
		staleTime: PRO_DASHBOARD_METRIC_STALE_TIME,
		select: selectBasicTvlDataset
	})
	const {
		data: advancedData,
		isLoading: isAdvancedLoading,
		hasSourceData: hasAdvancedSourceData
	} = useAdvancedTvlChartData({
		protocol,
		protocolName,
		chartType,
		extraTvlsEnabled,
		enabled: streamDone && chartType !== 'tvl' && !suppressTokenBreakdowns
	})
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
	const { activeSeries, setSelectedSeries, isDefaultSelection } = useSeriesSelection({
		availableSeries: selectorValues,
		defaultSeries: advancedData.defaultSeriesNames,
		...(aggregateOthers ? {} : { maxSelectedSeries: MAX_PROTOCOL_BREAKDOWN_SERIES }),
		allowEmptySelection: true,
		resetToDefaultWhenStale: true,
		selectionKey: `${protocol}:${chartType}`,
		storeDefaultAsIntent: true
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
				tokenNames:
					chartType === 'chainsTvl' ? EMPTY_STACKS : chartType === 'tokensPie' ? pieSeriesNames : renderedSeries
			}),
		[chartType, advancedDataset, pieSeriesNames, renderedSeries]
	)
	const pieSelection = useAllSeriesSelection({
		availableSeries: pieSeriesNames,
		selectionKey: `${protocol}:tokensPie`
	})
	const piePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: advancedData.pieSeries,
				selectedSeries: pieSelection.selectedCharts,
				includeUpstreamOthers: pieSelection.includeUpstreamOthers
			}),
		[advancedData.pieSeries, pieSelection.includeUpstreamOthers, pieSelection.selectedCharts]
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
				exportDataset = buildRuntimePieChartCsvDataset(advancedData.pieSeries)
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
			const completeDataset = buildCompleteProtocolBreakdownDataset({
				breakdown: advancedData.breakdown,
				availableSeries: selectorValues,
				includeUpstreamOthers: aggregateOthers,
				fillMissingWithZero: true
			})
			if (!completeDataset) throw new Error('Advanced TVL data is unavailable')
			exportDataset = filterChartDatasetByTimePeriod(completeDataset, timePeriod, customTimePeriod)
		}

		return prepareProChartCsv(exportDataset, filename)
	}

	const chartTypeLabel = CHART_TYPE_LABELS[chartType] || chartType
	const imageTitle = `${protocolName} - ${chartTypeLabel}`
	const imageFilename = `${protocol.toLowerCase().replace(/\s+/g, '-')}-${chartType}`
	const isLoading =
		chartType === 'tvl'
			? isBasicTvlLoading || (!streamDone && basicTvlDataset === undefined)
			: isAdvancedLoading || (!streamDone && !hasAdvancedSourceData && !suppressTokenBreakdowns)

	if (isLoading) {
		return (
			<div className="flex min-h-[402px] items-center justify-center md:min-h-[418px]">
				<LoadingSpinner />
			</div>
		)
	}

	const chartContent =
		chartType === 'tokensPie' ? (
			<PieChart
				chartData={piePresentation.chartData}
				stackColors={{ ...piePresentation.stackColors, ...presentation.stackColors }}
				exportButtons="hidden"
				height="360px"
				onReady={handleChartReady}
			/>
		) : (
			<MultiSeriesChart
				title=""
				dataset={canonicalDataset}
				charts={presentation.charts}
				{...(selectorValues.length > 0 ? { selectedCharts: runtimePresentation.selectedCharts } : {})}
				valueSymbol={presentation.valueSymbol}
				hideDefaultLegend
				hideDataZoom={presentation.hideDataZoom}
				solidChartAreaStyle={presentation.solidChartAreaStyle}
				{...(presentation.chartOptions ? { chartOptions: presentation.chartOptions } : {})}
				exportButtons={HIDDEN_EXPORTS}
				height="360px"
				onReady={handleChartReady}
			/>
		)

	const hasChartData =
		chartType === 'tokensPie'
			? advancedData.pieSeries.peers.length > 0 || advancedData.pieSeries.upstreamOthersValue > 0
			: filteredDataset.source.length > 0

	return (
		<div className="flex min-h-[402px] flex-col p-2 md:min-h-[418px]">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{chartTypeLabel}</h3>
					<p className="text-xs text-pro-text-secondary">{protocolName}</p>
				</div>
				{hasChartData ? (
					<div className="flex flex-wrap items-center justify-end gap-2">
						{chartType === 'tokensPie' && pieSeriesNames.length > 1 ? (
							<SelectWithCombobox
								allValues={pieSeriesNames}
								selectedValues={pieSelection.activeSeries}
								setSelectedValues={pieSelection.setSelectedSeries}
								label="Token"
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : selectorValues.length > 1 ? (
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
						<ProCardOverflowMenu
							image={{ chartInstance, filename: imageFilename, title: imageTitle }}
							csv={{ prepareCsv: prepareCsvExport }}
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
