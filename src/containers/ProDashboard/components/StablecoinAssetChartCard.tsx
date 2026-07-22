import { lazy, Suspense, useMemo, type ReactElement } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IMultiSeriesChartProps, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { useStablecoinAssetChartData } from '~/containers/ProDashboard/components/datasets/StablecoinAssetDataset/useStablecoinAssetChartData'
import {
	filterStablecoinDatasetByTimePeriod,
	STABLECOIN_DOLLAR_CHART_OPTIONS,
	STABLECOIN_PERCENT_CHART_OPTIONS
} from '~/containers/ProDashboard/components/datasets/stablecoinChartUtils'
import { colorManager } from '~/containers/ProDashboard/utils/colorManager'
import { LocalLoader } from '~/ui/Loaders'
import { formattedNum, toNiceCsvDate } from '~/utils'
import { download } from '~/utils/download'
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

export function StablecoinAssetChartCard({ config }: StablecoinAssetChartCardProps) {
	const { stablecoin, stablecoinId, chartType } = config
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const piePeriodBounds = useMemo(
		() => (chartType === 'chainPie' ? getTimePeriodBounds(timePeriod, customTimePeriod) : null),
		[chartType, customTimePeriod, timePeriod]
	)

	const { presentation, chainsUnique, stablecoinName, stablecoinSymbol, isLoading } = useStablecoinAssetChartData(
		stablecoinId,
		chartType,
		piePeriodBounds
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
			chainsUnique.map((name) => ({
				type: 'line',
				name,
				encode: { x: 'timestamp', y: name },
				color: chainColors[name],
				hideAreaStyle: true
			})),
		[chainsUnique, chainColors]
	)
	const chainDominanceCharts = useMemo<MultiSeriesChartSeriesConfig[]>(
		() =>
			chainsUnique.map((name) => ({
				type: 'line',
				name,
				encode: { x: 'timestamp', y: name },
				color: chainColors[name]
			})),
		[chainsUnique, chainColors]
	)

	const filteredDataset = useMemo(
		() =>
			'dataset' in presentation
				? filterStablecoinDatasetByTimePeriod(presentation.dataset, timePeriod, customTimePeriod)
				: null,
		[presentation, timePeriod, customTimePeriod]
	)
	const chainsCirculatingValues = presentation.chartType === 'chainPie' ? presentation.slices : []
	const latestCirculating =
		presentation.chartType === 'totalCirc'
			? ((filteredDataset?.source.at(-1)?.[1] as number | undefined) ?? null)
			: null

	const handleCsvExport = () => {
		let rows: (string | number)[][] = []
		let filename = ''

		const assetSlug = stablecoin.toLowerCase().replace(/\s+/g, '-')

		switch (chartType) {
			case 'totalCirc':
				rows = [
					['Date', 'Circulating'],
					...(filteredDataset?.source ?? []).map((row) => [toNiceCsvDate((row[0] as number) / 1000), row[1] ?? ''])
				]
				filename = `${assetSlug}-total-circulating`
				break
			case 'chainMcaps':
				rows = [
					['Date', ...chainsUnique],
					...(filteredDataset?.source ?? []).map((row) => [
						toNiceCsvDate((row[0] as number) / 1000),
						...chainsUnique.map((_, index) => row[index + 1] ?? '')
					])
				]
				filename = `${assetSlug}-by-chain`
				break
			case 'chainDominance':
				rows = [
					['Date', ...chainsUnique],
					...(filteredDataset?.source ?? []).map((row) => [
						toNiceCsvDate((row[0] as number) / 1000),
						...chainsUnique.map((_, index) => row[index + 1] ?? '')
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
					<PieChart chartData={chainsCirculatingValues} stackColors={chainColors} />
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
						expandTo100Percent={true}
						chartOptions={STABLECOIN_PERCENT_CHART_OPTIONS}
						exportButtons="hidden"
						onReady={handleChartReady}
					/>
				</Suspense>
			)
			break
	}

	const hasChartData = (filteredDataset?.source.length ?? 0) > 0 || chainsCirculatingValues.length > 0

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
					<div className="flex gap-2">
						{chartType !== 'chainPie' ? (
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

			{latestCirculating !== null && chartType === 'totalCirc' ? (
				<div className="mb-2 flex gap-4">
					<p className="flex flex-col">
						<span className="text-[10px] text-pro-text-tertiary uppercase">Total Circulating</span>
						<span className="font-jetbrains text-sm font-semibold" style={{ color: '#3e79cc' }}>
							{formattedNum(latestCirculating, true)}
						</span>
					</p>
				</div>
			) : null}

			<div className="flex-1">{chartContent}</div>
		</div>
	)
}
