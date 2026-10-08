import { lazy, type ReactNode, Suspense, useMemo } from 'react'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { useLocalSelection, useSelectionIntent } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { filterChartDatasetByTimePeriod } from '~/containers/ProDashboard/components/datasets/filterChartDataset'
import {
	STABLECOIN_DOLLAR_CHART_OPTIONS,
	STABLECOIN_INFLOWS_CHART_OPTIONS,
	STABLECOIN_PERCENT_CHART_OPTIONS,
	STABLECOIN_SINGLE_UNITLESS_CHART_OPTIONS
} from '~/containers/ProDashboard/components/datasets/stablecoinChartUtils'
import { useStablecoinsChartData } from '~/containers/ProDashboard/components/datasets/StablecoinsDataset/useStablecoinsChartData'
import { generateConsistentChartColor, STABLECOIN_TOKEN_COLORS } from '~/containers/ProDashboard/utils/colorManager'
import { getStablecoinRuntimeSeries } from '~/containers/Stablecoins/chartSeries'
import { useStablecoinChartSelection } from '~/containers/Stablecoins/useStablecoinChartSelection'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { formatUsd } from '~/utils/numberFormat'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import type { StablecoinsChartConfig } from '../types'
import { ProMeta } from '../ui'
import { BoundParameterBadge } from './BoundParameterBadge'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { prepareProChartCsv } from './chartCsv'
import { ProCardHeader } from './ProCardHeader'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))

interface StablecoinsChartCardProps {
	config: StablecoinsChartConfig
}

const CHART_TYPE_LABELS: Record<string, string> = {
	totalMcap: 'Total Market Cap',
	tokenMcaps: 'Token Market Caps',
	pie: 'Pie',
	dominance: 'Dominance',
	usdInflows: 'USD Inflows',
	tokenInflows: 'Token Inflows'
}

const SERIES_SELECTION_CHARTS = new Set<StablecoinsChartConfig['chartType']>([
	'tokenMcaps',
	'dominance',
	'tokenInflows'
])
export function StablecoinsChartCard({ config }: StablecoinsChartCardProps) {
	const { chain, chartType } = config
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const { intent: selectionIntent, setIntent: setSelectionIntent } = useSelectionIntent(`${chain}:${chartType}`)
	const selectionOptions = useMemo(
		() => ({
			selectedNames: selectionIntent?.mode === 'include' ? selectionIntent.names : null,
			excludedNames: selectionIntent?.mode === 'exclude' ? selectionIntent.names : null
		}),
		[selectionIntent]
	)
	const chartRead = useStablecoinsChartData(chain, chartType, true, selectionOptions)
	const { chartPayload, pieSeries, seriesNames, defaultSeries, prepareCsvDataset, isLoading, readFailed } = chartRead
	const runtimeSeries = useMemo(() => getStablecoinRuntimeSeries(chartPayload), [chartPayload])
	const { activeSeries, selectableSeries, renderedCharts, setSelectedSeries } = useStablecoinChartSelection({
		marketCapSeries: null,
		runtimeSeries,
		selectionIntent,
		setSelectionIntent
	})
	const pieSeriesNames = useMemo(() => pieSeries.peers.map((peer) => peer.name), [pieSeries.peers])
	const pieSelection = useLocalSelection({
		availableSeries: pieSeriesNames,
		defaultSeries,
		allowEmptySelection: true,
		scope: `${chain}:pie`
	})
	const piePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: pieSeries,
				selectedSeries: pieSelection.selectedCharts
			}),
		[pieSelection.selectedCharts, pieSeries]
	)

	const stackColors = useMemo(() => {
		const colors: Record<string, string> = { ...STABLECOIN_TOKEN_COLORS }
		for (const name of seriesNames) {
			if (!colors[name]) colors[name] = generateConsistentChartColor(name, '#8884d8', 'protocol')
		}
		return colors
	}, [seriesNames])

	const charts = useMemo(
		() =>
			chartPayload.charts.map((chart) => {
				const { color, ...chartWithoutColor } = chart
				const resolvedColor = stackColors[chart.name] ?? color
				return {
					...chartWithoutColor,
					...(resolvedColor ? { color: resolvedColor } : {}),
					...(chartType === 'tokenMcaps' ? { hideAreaStyle: true } : {})
				}
			}),
		[chartPayload.charts, chartType, stackColors]
	)
	const dataset = useMemo(
		() => filterChartDatasetByTimePeriod(chartPayload.dataset, timePeriod, customTimePeriod),
		[chartPayload.dataset, timePeriod, customTimePeriod]
	)
	const latestMcapIndex = dataset.dimensions.indexOf('Mcap')
	const latestMcapValue = latestMcapIndex < 0 ? undefined : dataset.source.at(-1)?.[latestMcapIndex]
	const latestMcap = typeof latestMcapValue === 'number' ? latestMcapValue : null

	const prepareCsvExport = () => {
		const chainSlug = chain === 'All' ? 'all' : chain.toLowerCase().replace(/\s+/g, '-')
		let filename = `stablecoins-${chainSlug}-${chartType}`
		const exportDataset =
			chartType === 'pie'
				? buildRuntimePieChartCsvDataset({
						series: pieSeries,
						selectedSeries: pieSelection.selectedCharts
					})
				: filterChartDatasetByTimePeriod(prepareCsvDataset(), timePeriod, customTimePeriod)
		if (chartType === 'pie') filename = `stablecoins-${chainSlug}-pie`
		return prepareProChartCsv(exportDataset, filename)
	}

	const chartTypeLabel = CHART_TYPE_LABELS[chartType] || chartType
	const chainLabel = chain === 'All' ? 'All Chains' : chain
	const imageTitle = `${chainLabel} Stablecoins - ${chartTypeLabel}`
	const imageFilename = `stablecoins-${chain === 'All' ? 'all' : chain.toLowerCase().replace(/\s+/g, '-')}-${chartType}`
	const hasChartData =
		chartType === 'pie' ? pieSeries.peers.length > 0 || pieSeries.upstreamOthersValue > 0 : dataset.source.length > 0

	const hallmarks = useDashboardAnnotationHallmarks()
	const syncGroup = useChartSyncGroup()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(320, cardHeightScale)

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex h-full min-h-[calc(360px*var(--card-scale,1))] flex-col p-0">
			<ProCardHeader titleAs="h3" title={chartTypeLabel} subtitle={<ProMeta items={[`${chainLabel} Stablecoins`]} />} />
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (readFailed && !hasChartData) {
		return renderStatusShell(<ProCardError retry={chartRead} />)
	}

	if (isLoading) {
		return renderStatusShell(<ProCardLoading />)
	}

	const chartOptions =
		chartType === 'dominance'
			? STABLECOIN_PERCENT_CHART_OPTIONS
			: chartType === 'tokenInflows'
				? STABLECOIN_INFLOWS_CHART_OPTIONS
				: chartType === 'usdInflows'
					? STABLECOIN_SINGLE_UNITLESS_CHART_OPTIONS
					: STABLECOIN_DOLLAR_CHART_OPTIONS

	return (
		<div className="flex h-full flex-col p-0">
			{readFailed ? <ProCardRefreshFailed retry={chartRead} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={chartTypeLabel}
				badge={<BoundParameterBadge {...(config.bindings === undefined ? {} : { bindings: config.bindings })} />}
				subtitle={<ProMeta items={[`${chainLabel} Stablecoins`]} />}
				viewerControls={
					hasChartData ? (
						chartType === 'pie' && pieSeries.peers.length > 1 ? (
							<SelectWithCombobox
								size="sm"
								allValues={pieSeriesNames}
								selectedValues={pieSelection.activeSeries}
								setSelectedValues={pieSelection.setSelectedSeries}
								label="Token"
								labelType="smol"
								variant="filter"
							/>
						) : SERIES_SELECTION_CHARTS.has(chartType) && selectableSeries.length > 1 ? (
							<SelectWithCombobox
								size="sm"
								allValues={selectableSeries}
								selectedValues={activeSeries}
								setSelectedValues={setSelectedSeries}
								label="Token"
								labelType="smol"
								variant="filter"
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
				{latestMcap !== null && chartType === 'totalMcap' ? (
					<div className="mb-2 flex gap-4">
						<div className="flex flex-col">
							<span className="body-sm text-tertiary uppercase">Total Market Cap</span>
							<span className="mono-md-bold" style={{ color: '#3e79cc' }}>
								{formatUsd(latestMcap, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
							</span>
						</div>
					</div>
				) : null}

				<div className="flex-1" key={chartType}>
					<Suspense
						fallback={
							<div className="flex h-[calc(320px*var(--card-scale,1))] items-center justify-center">
								<ProCardLoading />
							</div>
						}
					>
						{chartType === 'pie' ? (
							<PieChart
								chartData={piePresentation.chartData}
								stackColors={{ ...piePresentation.stackColors, ...stackColors }}
								exportButtons="hidden"
								height={chartHeight}
								onReady={handleChartReady}
							/>
						) : (
							<MultiSeriesChart
								title=""
								height={chartHeight}
								{...(hallmarks ? { hallmarks } : {})}
								hallmarkStyle="mark-line"
								{...(syncGroup ? { syncGroup } : {})}
								dataset={dataset}
								charts={charts}
								{...(SERIES_SELECTION_CHARTS.has(chartType) ? { selectedCharts: renderedCharts } : {})}
								valueSymbol={chartPayload.valueSymbol ?? ''}
								{...(chartPayload.stacked === undefined ? {} : { stacked: chartPayload.stacked })}
								{...(chartPayload.expandTo100Percent === undefined
									? {}
									: { expandTo100Percent: chartPayload.expandTo100Percent })}
								{...(chartPayload.showTotalInTooltip === undefined
									? {}
									: { showTotalInTooltip: chartPayload.showTotalInTooltip })}
								{...(chartOptions ? { chartOptions } : {})}
								exportButtons="hidden"
								onReady={handleChartReady}
							/>
						)}
					</Suspense>
				</div>
			</div>
		</div>
	)
}
