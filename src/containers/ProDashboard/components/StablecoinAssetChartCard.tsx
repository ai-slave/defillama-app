import { lazy, Suspense, useMemo, type ReactElement } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useStablecoinAssetChartData } from '~/containers/ProDashboard/components/datasets/StablecoinAssetDataset/useStablecoinAssetChartData'
import {
	filterStablecoinDatasetByTimePeriod,
	STABLECOIN_DOLLAR_CHART_OPTIONS,
	STABLECOIN_PERCENT_CHART_OPTIONS
} from '~/containers/ProDashboard/components/datasets/stablecoinChartUtils'
import { colorManager } from '~/containers/ProDashboard/utils/colorManager'
import { getStablecoinRuntimeSeries } from '~/containers/Stablecoins/chartSeries'
import {
	useStablecoinChartSelection,
	useStablecoinSelectionIntent
} from '~/containers/Stablecoins/useStablecoinChartSelection'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { LocalLoader } from '~/ui/Loaders'
import { formatIsoDate } from '~/utils/dateFormat'
import { download } from '~/utils/download'
import { formatUsd } from '~/utils/numberFormat'
import { useChartImageExport } from '../hooks/useChartImageExport'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import { getTimePeriodBounds } from '../queries'
import type { StablecoinAssetChartConfig } from '../types'
import { ProTableCSVButton } from './ProTable/CsvButton'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

interface StablecoinAssetChartCardProps {
	config: StablecoinAssetChartConfig
}

const CHART_TYPE_LABELS: Record<string, string> = {
	totalCirc: 'Total Circulating',
	chainMcaps: 'By Chain',
	chainPie: 'Pie',
	chainDominance: 'Dominance'
}

const EMPTY_HALLMARKS: [number, string][] = []
const TOTAL_CIRCULATING_CHARTS: MultiSeriesChartSeriesConfig[] = [
	{ type: 'line', name: 'Circulating', encode: { x: 'timestamp', y: 'Circulating' }, color: '#3e79cc' }
]
const EMPTY_SERIES: string[] = []

export function StablecoinAssetChartCard({ config }: StablecoinAssetChartCardProps) {
	const { stablecoin, stablecoinId, chartType } = config
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const { selectionIntent, setSelectionIntent } = useStablecoinSelectionIntent(`${stablecoinId}:${chartType}`)
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

	const { presentation, chainsUnique, stablecoinName, stablecoinSymbol, isLoading } = useStablecoinAssetChartData(
		stablecoinId,
		chartType,
		piePeriodBounds,
		selectionOptions
	)

	const chainColors = useMemo(() => {
		const colors: Record<string, string> = {}
		for (const chain of chainsUnique) {
			colors[chain] = colorManager.getItemColor(chain, 'chain')
		}
		return colors
	}, [chainsUnique])
	const chainCharts = useMemo<MultiSeriesChartSeriesConfig[]>(
		() =>
			presentation.chartType === 'chainMcaps'
				? presentation.charts.map((chart) => ({
						...chart,
						color: chainColors[chart.name] ?? chart.color,
						hideAreaStyle: true
					}))
				: [],
		[presentation, chainColors]
	)
	const chainDominanceCharts = useMemo<MultiSeriesChartSeriesConfig[]>(
		() =>
			presentation.chartType === 'chainDominance'
				? presentation.charts.map((chart) => ({
						...chart,
						color: chainColors[chart.name] ?? chart.color
					}))
				: [],
		[presentation, chainColors]
	)
	const runtimeSeries = useMemo(
		() =>
			presentation.chartType === 'chainMcaps' || presentation.chartType === 'chainDominance'
				? getStablecoinRuntimeSeries({
						dataset: presentation.dataset,
						charts: presentation.charts,
						availableSeries: presentation.availableSeries
					})
				: {
						selectableSeries: EMPTY_SERIES,
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
	const pieSelection = useAllSeriesSelection({
		availableSeries: pieSeriesNames,
		selectionKey: `${stablecoinId}:chainPie`
	})
	const piePresentation = useMemo(
		() =>
			pieSeries
				? buildRuntimePieChartPresentation({
						series: pieSeries,
						selectedSeries: pieSelection.selectedCharts,
						includeUpstreamOthers: pieSelection.includeUpstreamOthers
					})
				: { chartData: [], stackColors: {} },
		[pieSelection.includeUpstreamOthers, pieSelection.selectedCharts, pieSeries]
	)

	const filteredDataset = useMemo(
		() =>
			'dataset' in presentation
				? filterStablecoinDatasetByTimePeriod(presentation.dataset, timePeriod, customTimePeriod)
				: null,
		[presentation, timePeriod, customTimePeriod]
	)
	const chainsCirculatingValues = piePresentation.chartData
	const latestCirculating =
		presentation.chartType === 'totalCirc'
			? ((filteredDataset?.source.at(-1)?.[1] as number | undefined) ?? null)
			: null
	const visibleSeries =
		chartType === 'chainMcaps'
			? chainCharts.filter((chart) => selectedCharts.has(chart.name)).map((chart) => chart.name)
			: chartType === 'chainDominance'
				? chainDominanceCharts.filter((chart) => selectedCharts.has(chart.name)).map((chart) => chart.name)
				: EMPTY_SERIES

	const handleCsvExport = () => {
		let rows: (string | number)[][] = []
		let filename = ''

		const assetSlug = stablecoin.toLowerCase().replace(/\s+/g, '-')
		const selectedDimensionIndexes = visibleSeries.map((name) => filteredDataset?.dimensions.indexOf(name) ?? -1)

		switch (chartType) {
			case 'totalCirc':
				rows = [
					['Date', 'Circulating'],
					...(filteredDataset?.source ?? []).map((row) => [
						formatIsoDate(row[0] as number, { input: 'milliseconds' }) ?? '',
						row[1] ?? ''
					])
				]
				filename = `${assetSlug}-total-circulating`
				break
			case 'chainMcaps':
				rows = [
					['Date', ...visibleSeries],
					...(filteredDataset?.source ?? []).map((row) => [
						formatIsoDate(row[0] as number, { input: 'milliseconds' }) ?? '',
						...selectedDimensionIndexes.map((index) => row[index] ?? '')
					])
				]
				filename = `${assetSlug}-by-chain`
				break
			case 'chainDominance':
				rows = [
					['Date', ...visibleSeries],
					...(filteredDataset?.source ?? []).map((row) => [
						formatIsoDate(row[0] as number, { input: 'milliseconds' }) ?? '',
						...selectedDimensionIndexes.map((index) => row[index] ?? '')
					])
				]
				filename = `${assetSlug}-chain-dominance`
				break
			case 'chainPie':
				rows = [['Chain', 'Circulating'], ...chainsCirculatingValues.map((slice) => [slice.name, slice.value])]
				filename = `${assetSlug}-chain-pie`
				break
		}

		if (rows.length > 0) {
			const csvContent = rows.map((row) => row.join(',')).join('\n')
			download(filename, csvContent)
		}
	}

	const chartTypeLabel = CHART_TYPE_LABELS[chartType] || chartType
	const displayName = stablecoinName || stablecoin
	const imageTitle = `${displayName} - ${chartTypeLabel}`
	const imageFilename = `${stablecoin.toLowerCase().replace(/\s+/g, '-')}-${chartType}`

	if (isLoading) {
		return (
			<div className="flex h-full min-h-[360px] items-center justify-center">
				<LocalLoader />
			</div>
		)
	}

	let chartContent: ReactElement | null = null
	switch (chartType) {
		case 'totalCirc':
			chartContent = (
				<Suspense
					fallback={
						<div className="flex h-[320px] items-center justify-center">
							<LocalLoader />
						</div>
					}
				>
					<MultiSeriesChart
						title=""
						dataset={filteredDataset!}
						charts={TOTAL_CIRCULATING_CHARTS}
						valueSymbol="$"
						hallmarks={EMPTY_HALLMARKS}
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
						<div className="flex h-[320px] items-center justify-center">
							<LocalLoader />
						</div>
					}
				>
					<MultiSeriesChart
						title=""
						dataset={filteredDataset!}
						charts={chainCharts}
						selectedCharts={selectedCharts}
						valueSymbol="$"
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
						<div className="flex h-[320px] items-center justify-center">
							<LocalLoader />
						</div>
					}
				>
					<PieChart
						chartData={chainsCirculatingValues}
						stackColors={{ ...piePresentation.stackColors, ...chainColors }}
						exportButtons="hidden"
						onReady={handleChartReady}
					/>
				</Suspense>
			)
			break
		case 'chainDominance':
			chartContent = (
				<Suspense
					fallback={
						<div className="flex h-[320px] items-center justify-center">
							<LocalLoader />
						</div>
					}
				>
					<MultiSeriesChart
						title=""
						valueSymbol="%"
						dataset={filteredDataset!}
						charts={chainDominanceCharts}
						selectedCharts={selectedCharts}
						expandTo100Percent={true}
						chartOptions={STABLECOIN_PERCENT_CHART_OPTIONS}
						exportButtons="hidden"
						onReady={handleChartReady}
					/>
				</Suspense>
			)
			break
	}

	const hasChartData =
		(filteredDataset?.source.length ?? 0) > 0 ||
		(pieSeries != null && (pieSeries.peers.length > 0 || pieSeries.upstreamOthersValue > 0))

	return (
		<div className="flex h-full flex-col p-2">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{chartTypeLabel}</h3>
					<p className="text-xs text-pro-text-secondary">
						{displayName} {stablecoinSymbol ? `(${stablecoinSymbol})` : ''}
					</p>
				</div>
				{hasChartData ? (
					<div className="flex flex-wrap justify-end gap-2">
						{chartType === 'chainPie' && pieSeriesNames.length > 1 ? (
							<SelectWithCombobox
								size="sm"
								allValues={pieSeriesNames}
								selectedValues={pieSelection.activeSeries}
								setSelectedValues={pieSelection.setSelectedSeries}
								label="Chain"
								labelType="smol"
								variant="filter"
								popoverVariant="legacy"
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
								popoverVariant="legacy"
							/>
						) : null}
						<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
						<ProTableCSVButton
							onClick={handleCsvExport}
							smol
							className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
						/>
					</div>
				) : null}
			</div>

			{latestCirculating !== null && chartType === 'totalCirc' ? (
				<div className="mb-2 flex gap-4">
					<p className="flex flex-col">
						<span className="text-[10px] text-pro-text-tertiary uppercase">Total Circulating</span>
						<span className="font-jetbrains text-sm font-semibold" style={{ color: '#3e79cc' }}>
							{formatUsd(latestCirculating, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
					</p>
				</div>
			) : null}

			<div className="flex-1">{chartContent}</div>
		</div>
	)
}
