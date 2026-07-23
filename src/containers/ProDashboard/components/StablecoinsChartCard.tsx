import { lazy, Suspense, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import {
	filterStablecoinDatasetByTimePeriod,
	STABLECOIN_DOLLAR_CHART_OPTIONS,
	STABLECOIN_INFLOWS_CHART_OPTIONS,
	STABLECOIN_PERCENT_CHART_OPTIONS,
	STABLECOIN_SINGLE_UNITLESS_CHART_OPTIONS
} from '~/containers/ProDashboard/components/datasets/stablecoinChartUtils'
import { useStablecoinsChartData } from '~/containers/ProDashboard/components/datasets/StablecoinsDataset/useStablecoinsChartData'
import { generateConsistentChartColor, STABLECOIN_TOKEN_COLORS } from '~/containers/ProDashboard/utils/colorManager'
import { getStablecoinRuntimeSeries } from '~/containers/Stablecoins/chartSeries'
import {
	useStablecoinChartSelection,
	useStablecoinSelectionIntent
} from '~/containers/Stablecoins/useStablecoinChartSelection'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { formattedNum, toNiceCsvDate } from '~/utils'
import { download } from '~/utils/download'
import { useChartImageExport } from '../hooks/useChartImageExport'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import type { StablecoinsChartConfig } from '../types'
import { LoadingSpinner } from './LoadingSpinner'
import { ProTableCSVButton } from './ProTable/CsvButton'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

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

const EMPTY_HALLMARKS: [number, string][] = []
const SERIES_SELECTION_CHARTS = new Set<StablecoinsChartConfig['chartType']>([
	'tokenMcaps',
	'dominance',
	'tokenInflows'
])
export function StablecoinsChartCard({ config }: StablecoinsChartCardProps) {
	const { chain, chartType } = config
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const { selectionIntent, setSelectionIntent } = useStablecoinSelectionIntent(`${chain}:${chartType}`)
	const selectionOptions = useMemo(
		() => ({
			selectedNames: selectionIntent?.mode === 'include' ? selectionIntent.names : null,
			excludedNames: selectionIntent?.mode === 'exclude' ? selectionIntent.names : null
		}),
		[selectionIntent]
	)
	const { chartPayload, pieSeries, seriesNames, isLoading } = useStablecoinsChartData(
		chain,
		chartType,
		true,
		selectionOptions
	)
	const runtimeSeries = useMemo(() => getStablecoinRuntimeSeries(chartPayload), [chartPayload])
	const { activeSeries, selectableSeries, renderedCharts, setSelectedSeries } = useStablecoinChartSelection({
		marketCapSeries: null,
		runtimeSeries,
		selectionIntent,
		setSelectionIntent
	})
	const pieSeriesNames = useMemo(() => pieSeries.peers.map((peer) => peer.name), [pieSeries.peers])
	const pieSelection = useAllSeriesSelection({
		availableSeries: pieSeriesNames,
		selectionKey: `${chain}:pie`
	})
	const piePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: pieSeries,
				selectedSeries: pieSelection.selectedCharts,
				includeUpstreamOthers: pieSelection.includeUpstreamOthers
			}),
		[pieSelection.includeUpstreamOthers, pieSelection.selectedCharts, pieSeries]
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
			chartPayload.charts.map((chart) => ({
				...chart,
				color: stackColors[chart.name] ?? chart.color,
				...(chartType === 'tokenMcaps' ? { hideAreaStyle: true } : {})
			})),
		[chartPayload.charts, chartType, stackColors]
	)
	const dataset = useMemo(
		() => filterStablecoinDatasetByTimePeriod(chartPayload.dataset, timePeriod, customTimePeriod),
		[chartPayload.dataset, timePeriod, customTimePeriod]
	)
	const latestMcapIndex = dataset.dimensions.indexOf('Mcap')
	const latestMcap =
		latestMcapIndex < 0 ? null : ((dataset.source.at(-1)?.[latestMcapIndex] as number | undefined) ?? null)

	const handleCsvExport = () => {
		let rows: (string | number)[][] = []
		const chainSlug = chain === 'All' ? 'all' : chain.toLowerCase().replace(/\s+/g, '-')
		let filename = `stablecoins-${chainSlug}-${chartType}`

		if (chartType === 'pie') {
			rows = [['Token', 'Market Cap'], ...piePresentation.chartData.map((slice) => [slice.name, slice.value])]
			filename = `stablecoins-${chainSlug}-pie`
		} else {
			const dimensions = charts.filter((chart) => renderedCharts.has(chart.name)).map((chart) => chart.name)
			const indexes = dimensions.map((name) => dataset.dimensions.indexOf(name))
			rows = [
				['Date', ...dimensions],
				...dataset.source.map((row) => [
					toNiceCsvDate((row[0] as number) / 1000),
					...indexes.map((index) => row[index] ?? '')
				])
			]
		}

		if (rows.length > 0) download(filename, rows.map((row) => row.join(',')).join('\n'))
	}

	const chartTypeLabel = CHART_TYPE_LABELS[chartType] || chartType
	const chainLabel = chain === 'All' ? 'All Chains' : chain
	const imageTitle = `${chainLabel} Stablecoins - ${chartTypeLabel}`
	const imageFilename = `stablecoins-${chain === 'All' ? 'all' : chain.toLowerCase().replace(/\s+/g, '-')}-${chartType}`
	const hasChartData =
		chartType === 'pie' ? pieSeries.peers.length > 0 || pieSeries.upstreamOthersValue > 0 : dataset.source.length > 0

	if (isLoading) {
		return (
			<div className="flex h-full min-h-[360px] items-center justify-center">
				<LoadingSpinner />
			</div>
		)
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
		<div className="flex h-full flex-col p-2">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{chartTypeLabel}</h3>
					<p className="text-xs text-pro-text-secondary">{chainLabel} Stablecoins</p>
				</div>
				{hasChartData ? (
					<div className="flex flex-wrap justify-end gap-2">
						{chartType === 'pie' && pieSeries.peers.length > 1 ? (
							<SelectWithCombobox
								size="sm"
								allValues={pieSeriesNames}
								selectedValues={pieSelection.activeSeries}
								setSelectedValues={pieSelection.setSelectedSeries}
								label="Token"
								labelType="smol"
								variant="filter"
								popoverVariant="legacy"
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
			{latestMcap !== null && chartType === 'totalMcap' ? (
				<div className="mb-2 flex gap-4">
					<div className="flex flex-col">
						<span className="text-[10px] text-pro-text-tertiary uppercase">Total Market Cap</span>
						<span className="font-jetbrains text-sm font-semibold" style={{ color: '#3e79cc' }}>
							{formattedNum(latestMcap, true)}
						</span>
					</div>
				</div>
			) : null}

			<div className="flex-1" key={chartType}>
				<Suspense
					fallback={
						<div className="flex h-[320px] items-center justify-center">
							<LoadingSpinner />
						</div>
					}
				>
					{chartType === 'pie' ? (
						<PieChart
							chartData={piePresentation.chartData}
							stackColors={{ ...piePresentation.stackColors, ...stackColors }}
							exportButtons="hidden"
							onReady={handleChartReady}
						/>
					) : (
						<MultiSeriesChart
							title=""
							dataset={dataset}
							charts={charts}
							selectedCharts={SERIES_SELECTION_CHARTS.has(chartType) ? renderedCharts : undefined}
							valueSymbol={chartPayload.valueSymbol ?? ''}
							stacked={chartPayload.stacked}
							expandTo100Percent={chartPayload.expandTo100Percent}
							showTotalInTooltip={chartPayload.showTotalInTooltip}
							hallmarks={chartType === 'totalMcap' ? EMPTY_HALLMARKS : undefined}
							chartOptions={chartOptions}
							exportButtons="hidden"
							onReady={handleChartReady}
						/>
					)}
				</Suspense>
			</div>
		</div>
	)
}
