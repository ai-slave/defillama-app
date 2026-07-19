import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChart2Props, IPieChartProps } from '~/components/ECharts/types'
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
import { STABLECOIN_BREAKDOWN_SERIES_LIMIT } from '~/containers/Stablecoins/chartSeries'
import { formattedNum, toNiceCsvDate } from '~/utils'
import { download } from '~/utils/download'
import { useChartImageExport } from '../hooks/useChartImageExport'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import type { StablecoinsChartConfig } from '../types'
import { LoadingSpinner } from './LoadingSpinner'
import { ProTableCSVButton } from './ProTable/CsvButton'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
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
	const [selectedSeries, setSelectedSeries] = useState<string[] | null>(null)

	useEffect(() => {
		setSelectedSeries(null)
	}, [chain, chartType])

	const { chartPayload, chainsCirculatingValues, seriesNames, availableSeries, defaultSeries, isLoading } =
		useStablecoinsChartData(chain, chartType, selectedSeries)

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
	const activeSeries = selectedSeries ?? defaultSeries
	const setActiveSeries: Dispatch<SetStateAction<string[]>> = (next) => {
		setSelectedSeries((current) => {
			const values = typeof next === 'function' ? next(current ?? defaultSeries) : next
			return values.slice(0, STABLECOIN_BREAKDOWN_SERIES_LIMIT)
		})
	}

	const latestMcap = useMemo(() => {
		return (dataset.source.at(-1)?.Mcap as number | undefined) ?? null
	}, [dataset])

	const handleCsvExport = () => {
		let rows: (string | number)[][] = []
		const chainSlug = chain === 'All' ? 'all' : chain.toLowerCase().replace(/\s+/g, '-')
		let filename = `stablecoins-${chainSlug}-${chartType}`

		if (chartType === 'pie') {
			rows = [['Token', 'Market Cap'], ...chainsCirculatingValues.map((slice: any) => [slice.name, slice.value])]
			filename = `stablecoins-${chainSlug}-pie`
		} else {
			const dimensions = dataset.dimensions.slice(1)
			rows = [
				['Date', ...dimensions],
				...dataset.source.map((row) => [
					toNiceCsvDate(Number(row.timestamp) / 1000),
					...dimensions.map((name) => row[name] ?? '')
				])
			]
		}

		if (rows.length > 0) download(filename, rows.map((row) => row.join(',')).join('\n'))
	}

	const chartTypeLabel = CHART_TYPE_LABELS[chartType] || chartType
	const chainLabel = chain === 'All' ? 'All Chains' : chain
	const imageTitle = `${chainLabel} Stablecoins - ${chartTypeLabel}`
	const imageFilename = `stablecoins-${chain === 'All' ? 'all' : chain.toLowerCase().replace(/\s+/g, '-')}-${chartType}`
	const hasChartData = chartType === 'pie' ? chainsCirculatingValues.length > 0 : dataset.source.length > 0

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
					<div className="flex gap-2">
						{chartType !== 'pie' ? (
							<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
						) : null}
						<ProTableCSVButton
							onClick={handleCsvExport}
							smol
							className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
						/>
					</div>
				) : null}
			</div>

			{SERIES_SELECTION_CHARTS.has(chartType) && availableSeries.length > 1 ? (
				<div className="mb-2 flex justify-end">
					<SelectWithCombobox
						size="sm"
						allValues={availableSeries}
						selectedValues={activeSeries}
						setSelectedValues={setActiveSeries}
						label="Token"
						labelType="smol"
						variant="filter"
						popoverVariant="legacy"
					/>
				</div>
			) : null}

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
						<PieChart chartData={chainsCirculatingValues} stackColors={stackColors} />
					) : (
						<MultiSeriesChart2
							title=""
							dataset={dataset}
							charts={charts}
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
