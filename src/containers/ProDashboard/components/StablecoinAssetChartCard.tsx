import { lazy, type ReactElement, type ReactNode, Suspense, useMemo } from 'react'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartCsvDataset, buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { useLocalSelection, useSelectionIntent } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useStablecoinAssetChartData } from '~/containers/ProDashboard/components/datasets/StablecoinAssetDataset/useStablecoinAssetChartData'
import {
	filterStablecoinDatasetByTimePeriod,
	STABLECOIN_DOLLAR_CHART_OPTIONS,
	STABLECOIN_PERCENT_CHART_OPTIONS
} from '~/containers/ProDashboard/components/datasets/stablecoinChartUtils'
import { colorManager } from '~/containers/ProDashboard/utils/colorManager'
import { getStablecoinRuntimeSeries } from '~/containers/Stablecoins/chartSeries'
import { useStablecoinChartSelection } from '~/containers/Stablecoins/useStablecoinChartSelection'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { formatCompactNumber } from '~/utils/numberFormat'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import { getTimePeriodBounds } from '../queries'
import type { StablecoinAssetChartConfig } from '../types'
import { ProMeta } from '../ui'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { prepareProChartCsv } from './chartCsv'
import { ProCardHeader } from './ProCardHeader'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))

interface StablecoinAssetChartCardProps {
	config: StablecoinAssetChartConfig
}

const CHART_TYPE_LABELS: Record<string, string> = {
	totalCirc: 'Total Circulating',
	chainMcaps: 'By Chain',
	chainPie: 'Pie',
	chainDominance: 'Dominance'
}

const TOTAL_CIRCULATING_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
	{ type: 'line', name: 'Circulating', encode: { x: 'timestamp', y: 'Circulating' }, color: '#3e79cc' }
]
const EMPTY_SERIES: Array<string> = []

export function StablecoinAssetChartCard({ config }: StablecoinAssetChartCardProps) {
	const { stablecoin, stablecoinId, chartType } = config
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const { intent: selectionIntent, setIntent: setSelectionIntent } = useSelectionIntent(`${stablecoinId}:${chartType}`)
	const selectionOptions = useMemo(
		() => ({
			selectedNames: selectionIntent?.mode === 'include' ? selectionIntent.names : null,
			excludedNames: selectionIntent?.mode === 'exclude' ? selectionIntent.names : null
		}),
		[selectionIntent]
	)
	const piePeriodBounds = useMemo(
		() => (chartType === 'chainPie' ? getTimePeriodBounds(timePeriod, customTimePeriod) : null),
		[chartType, customTimePeriod, timePeriod]
	)

	const {
		presentation,
		chainsUnique,
		stablecoinName,
		stablecoinSymbol,
		isInactive,
		prepareCsvDataset,
		isLoading,
		isFetching,
		error,
		refetch
	} = useStablecoinAssetChartData(stablecoinId, chartType, piePeriodBounds, selectionOptions)

	const chainColors = useMemo(() => {
		const colors: Record<string, string> = {}
		for (const chain of chainsUnique) {
			colors[chain] = colorManager.getItemColor(chain, 'chain')
		}
		return colors
	}, [chainsUnique])
	const chainCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() =>
			presentation.chartType === 'chainMcaps'
				? presentation.charts.map((chart) => {
						const { color, ...chartWithoutColor } = chart
						const resolvedColor = chainColors[chart.name] ?? color
						return {
							...chartWithoutColor,
							...(resolvedColor ? { color: resolvedColor } : {}),
							hideAreaStyle: true
						}
					})
				: [],
		[presentation, chainColors]
	)
	const chainDominanceCharts = useMemo<Array<MultiSeriesChartSeriesConfig>>(
		() =>
			presentation.chartType === 'chainDominance'
				? presentation.charts.map((chart) => {
						const { color, ...chartWithoutColor } = chart
						const resolvedColor = chainColors[chart.name] ?? color
						return { ...chartWithoutColor, ...(resolvedColor ? { color: resolvedColor } : {}) }
					})
				: [],
		[presentation, chainColors]
	)
	const runtimeSeries = useMemo(
		() =>
			presentation.chartType === 'chainMcaps' || presentation.chartType === 'chainDominance'
				? getStablecoinRuntimeSeries(presentation)
				: {
						selectableSeries: EMPTY_SERIES,
						defaultSeries: EMPTY_SERIES,
						renderedSelectableSeries: EMPTY_SERIES,
						fixedRemainderSeries: [],
						alwaysVisibleSeries: []
					},
		[presentation]
	)
	const {
		activeSeries,
		selectableSeries,
		renderedCharts: selectedCharts,
		setSelectedSeries
	} = useStablecoinChartSelection({
		marketCapSeries: null,
		runtimeSeries,
		selectionIntent,
		setSelectionIntent
	})
	const pieSeries = presentation.chartType === 'chainPie' ? presentation.pieSeries : null
	const pieSeriesNames = useMemo(() => pieSeries?.peers.map((peer) => peer.name) ?? EMPTY_SERIES, [pieSeries])
	const pieSelection = useLocalSelection({
		allowEmptySelection: true,
		availableSeries: pieSeriesNames,
		scope: `${stablecoinId}:chainPie`
	})
	const piePresentation = useMemo(
		() =>
			pieSeries
				? buildRuntimePieChartPresentation({
						series: pieSeries,
						selectedSeries: pieSelection.selectedCharts,
						includeUpstreamOthers: pieSelection.isDefaultSelection
					})
				: { chartData: [], stackColors: {} },
		[pieSelection.isDefaultSelection, pieSelection.selectedCharts, pieSeries]
	)

	const filteredDataset = useMemo(
		() =>
			'dataset' in presentation
				? filterStablecoinDatasetByTimePeriod(presentation.dataset, timePeriod, customTimePeriod)
				: null,
		[presentation, timePeriod, customTimePeriod]
	)
	const chainsCirculatingValues = piePresentation.chartData
	const latestCirculatingValue =
		presentation.chartType === 'totalCirc' ? filteredDataset?.source.at(-1)?.[1] : undefined
	const latestCirculating = !isInactive && typeof latestCirculatingValue === 'number' ? latestCirculatingValue : null
	const prepareCsvExport = () => {
		const assetSlug = stablecoin.toLowerCase().replace(/\s+/g, '-')
		let filename: string
		switch (chartType) {
			case 'totalCirc':
				filename = `${assetSlug}-total-circulating`
				break
			case 'chainMcaps':
				filename = `${assetSlug}-by-chain`
				break
			case 'chainDominance':
				filename = `${assetSlug}-chain-dominance`
				break
			case 'chainPie':
				filename = `${assetSlug}-chain-pie`
				break
		}
		const exportDataset = pieSeries
			? buildRuntimePieChartCsvDataset({
					series: pieSeries,
					selectedSeries: pieSelection.selectedCharts,
					includeUpstreamOthers: pieSelection.isDefaultSelection
				})
			: filterStablecoinDatasetByTimePeriod(prepareCsvDataset(), timePeriod, customTimePeriod)
		return prepareProChartCsv(exportDataset, filename)
	}

	const chartTypeLabel = CHART_TYPE_LABELS[chartType] || chartType
	const displayName = stablecoinName || stablecoin
	const imageTitle = `${displayName} - ${chartTypeLabel}`
	const imageFilename = `${stablecoin.toLowerCase().replace(/\s+/g, '-')}-${chartType}`

	const hallmarks = useDashboardAnnotationHallmarks()
	const syncGroup = useChartSyncGroup()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(320, cardHeightScale)

	const hasChartData =
		(filteredDataset?.source.length ?? 0) > 0 ||
		(pieSeries != null && (pieSeries.peers.length > 0 || pieSeries.upstreamOthersValue > 0))
	const retryChartData = () => {
		void refetch()
	}

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex h-full min-h-[calc(360px*var(--card-scale,1))] flex-col p-0">
			<ProCardHeader
				titleAs="h3"
				title={chartTypeLabel}
				subtitle={<ProMeta items={[displayName, stablecoinSymbol || null]} />}
			/>
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (isLoading) {
		return renderStatusShell(<ProCardLoading />)
	}

	if (error && !hasChartData) {
		return renderStatusShell(isFetching ? <ProCardLoading /> : <ProCardError onRetry={retryChartData} />)
	}

	let chartContent: ReactElement | null = null
	switch (chartType) {
		case 'totalCirc':
			chartContent = (
				<Suspense
					fallback={
						<div className="flex h-[calc(320px*var(--card-scale,1))] items-center justify-center">
							<ProCardLoading />
						</div>
					}
				>
					<MultiSeriesChart
						title=""
						height={chartHeight}
						{...(hallmarks ? { hallmarks } : {})}
						hallmarkStyle="mark-line"
						{...(syncGroup ? { syncGroup } : {})}
						dataset={filteredDataset!}
						charts={TOTAL_CIRCULATING_CHARTS}
						valueSymbol={stablecoinSymbol}
						chartOptions={STABLECOIN_DOLLAR_CHART_OPTIONS}
						exportButtons="hidden"
						onReady={handleChartReady}
					/>
				</Suspense>
			)
			break
		case 'chainMcaps':
			chartContent = (
				<Suspense
					fallback={
						<div className="flex h-[calc(320px*var(--card-scale,1))] items-center justify-center">
							<ProCardLoading />
						</div>
					}
				>
					<MultiSeriesChart
						title=""
						height={chartHeight}
						{...(hallmarks ? { hallmarks } : {})}
						hallmarkStyle="mark-line"
						{...(syncGroup ? { syncGroup } : {})}
						dataset={filteredDataset!}
						charts={chainCharts}
						selectedCharts={selectedCharts}
						valueSymbol={stablecoinSymbol}
						chartOptions={STABLECOIN_DOLLAR_CHART_OPTIONS}
						exportButtons="hidden"
						onReady={handleChartReady}
					/>
				</Suspense>
			)
			break
		case 'chainPie':
			chartContent = (
				<Suspense
					fallback={
						<div className="flex h-[calc(320px*var(--card-scale,1))] items-center justify-center">
							<ProCardLoading />
						</div>
					}
				>
					<PieChart
						chartData={chainsCirculatingValues}
						stackColors={{ ...piePresentation.stackColors, ...chainColors }}
						valueSymbol={stablecoinSymbol}
						exportButtons="hidden"
						height={chartHeight}
						onReady={handleChartReady}
					/>
				</Suspense>
			)
			break
		case 'chainDominance':
			chartContent = (
				<Suspense
					fallback={
						<div className="flex h-[calc(320px*var(--card-scale,1))] items-center justify-center">
							<ProCardLoading />
						</div>
					}
				>
					<MultiSeriesChart
						title=""
						height={chartHeight}
						{...(hallmarks ? { hallmarks } : {})}
						hallmarkStyle="mark-line"
						{...(syncGroup ? { syncGroup } : {})}
						valueSymbol="%"
						dataset={filteredDataset!}
						charts={chainDominanceCharts}
						selectedCharts={selectedCharts}
						expandTo100Percent
						chartOptions={STABLECOIN_PERCENT_CHART_OPTIONS}
						exportButtons="hidden"
						onReady={handleChartReady}
					/>
				</Suspense>
			)
			break
	}

	return (
		<div className="flex h-full flex-col p-0">
			{error ? <ProCardRefreshFailed onRetry={retryChartData} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={chartTypeLabel}
				subtitle={<ProMeta items={[displayName, stablecoinSymbol || null]} />}
				viewerControls={
					hasChartData ? (
						chartType === 'chainPie' && pieSeriesNames.length > 1 ? (
							<SelectWithCombobox
								size="sm"
								allValues={pieSeriesNames}
								selectedValues={pieSelection.activeSeries}
								setSelectedValues={pieSelection.setSelectedSeries}
								label="Chain"
								labelType="smol"
								variant="filter"
							/>
						) : selectableSeries.length > 1 ? (
							<SelectWithCombobox
								size="sm"
								allValues={selectableSeries}
								selectedValues={activeSeries}
								setSelectedValues={setSelectedSeries}
								label="Chain"
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
				{latestCirculating !== null && chartType === 'totalCirc' ? (
					<div className="mb-2 flex gap-4">
						<p className="flex flex-col">
							<span className="text-xs text-pro-text-tertiary uppercase">Total Circulating</span>
							<span className="font-jetbrains text-sm font-semibold" style={{ color: '#3e79cc' }}>
								{formatCompactNumber(latestCirculating, {
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}{' '}
								{stablecoinSymbol}
							</span>
						</p>
					</div>
				) : null}

				<div className="flex-1">{chartContent}</div>
			</div>
		</div>
	)
}
