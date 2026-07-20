import { lazy, Suspense, useContext, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { createTimeSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import { materializeZeroFilledDataset, type TimestampDataset } from '~/components/ECharts/timeSeriesDataset'
import type {
	IMultiSeriesChart2Props,
	IPieChartProps,
	MultiSeriesChart2Dataset,
	MultiSeriesChart2SeriesConfig
} from '~/components/ECharts/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { buildProtocolV1ChartConfigs } from '~/containers/ProtocolOverview/protocolV1AddlChartsData'
import { useSelectedValues } from '~/hooks/useSelectedValues'
import { toNiceCsvDate } from '~/utils'
import { download } from '~/utils/download'
import { BORROWED_CHART_OPTIONS, BORROWED_CHART_TYPE_LABELS } from '../borrowedChartConstants'
import { useChartImageExport } from '../hooks/useChartImageExport'
import { useProDashboardCatalog, useProDashboardTime } from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import { shouldSuppressBorrowedTokenBreakdown } from '../services/protocolTvl'
import type { BorrowedChartConfig } from '../types'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { LoadingSpinner } from './LoadingSpinner'
import { ProTableCSVButton } from './ProTable/CsvButton'
import { useBorrowedChartData } from './useBorrowedChartData'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const EMPTY_DATASET: TimestampDataset = {
	source: [],
	dimensions: ['timestamp']
}
const EMPTY_CHARTS: MultiSeriesChart2SeriesConfig[] = []
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
	const { data: borrowedData, isLoading } = useBorrowedChartData({
		protocol,
		chartType,
		enabled: streamDone && !suppressTokenBreakdown,
		staleTime: Infinity
	})
	const rawDataset = borrowedData.dataset ?? EMPTY_DATASET
	const seriesNames = borrowedData.seriesNames
	const pieChart = borrowedData.pieChart
	const visibleCharts = useMemo(() => {
		if (chartType === 'tokensBorrowedPie') return EMPTY_CHARTS
		return buildProtocolV1ChartConfigs({ seriesNames, type: 'line', hideAreaStyle: true })
	}, [chartType, seriesNames])

	const selectorValues = seriesNames
	const [selectedSeries, setSelectedSeries] = useSelectedValues(selectorValues)
	const selectedCharts = useMemo(() => new Set(selectedSeries), [selectedSeries])
	const selectorLabel = chartType === 'chainsBorrowed' ? 'Chain' : 'Token'

	const rawVisibleDataset = chartType === 'tokensBorrowedPie' ? EMPTY_DATASET : rawDataset
	const filteredDataset = useMemo(
		() => filterChartDatasetByTimePeriod(rawVisibleDataset, timePeriod, customTimePeriod),
		[rawVisibleDataset, timePeriod, customTimePeriod]
	)
	const visibleDataset = useMemo(() => {
		switch (chartType) {
			case 'chainsBorrowed':
				return materializeZeroFilledDataset(filteredDataset, selectedSeries)
			case 'tokenBorrowedUsd':
				return materializeZeroFilledDataset(filteredDataset, selectedSeries)
			case 'tokenBorrowedRaw':
				return materializeZeroFilledDataset(filteredDataset, selectedSeries)
			default:
				return EMPTY_DATASET
		}
	}, [chartType, filteredDataset, selectedSeries])

	const handleCsvExport = () => {
		let rows: (string | number)[][] = []
		let filename = ''
		const protocolSlug = protocol.toLowerCase().replace(/\s+/g, '-')
		const buildRows = (dataset: MultiSeriesChart2Dataset, columnNames: string[]) => [
			['Date', ...columnNames],
			...dataset.source.map((row) => [
				toNiceCsvDate((row.timestamp as number) / 1000),
				...columnNames.map((name) => row[name] ?? '')
			])
		]

		switch (chartType) {
			case 'chainsBorrowed':
				rows = buildRows(filteredDataset, seriesNames)
				filename = `${protocolSlug}-borrowed-by-chain`
				break
			case 'tokenBorrowedUsd':
				rows = buildRows(filteredDataset, seriesNames)
				filename = `${protocolSlug}-borrowed-by-token-usd`
				break
			case 'tokensBorrowedPie':
				rows = [['Token', 'Value'], ...pieChart.map((row) => [row.name, row.value])]
				filename = `${protocolSlug}-borrowed-tokens-breakdown`
				break
			case 'tokenBorrowedRaw':
				rows = buildRows(filteredDataset, seriesNames)
				filename = `${protocolSlug}-borrowed-by-token-raw`
				break
		}

		if (rows.length > 0) download(filename, rows.map((row) => row.join(',')).join('\n'))
	}

	const chartTypeLabel = BORROWED_CHART_TYPE_LABELS[chartType] || chartType
	const imageTitle = `${protocolName} - ${chartTypeLabel}`
	const imageFilename = `${protocol.toLowerCase().replace(/\s+/g, '-')}-${chartType}`

	if (isLoading || !streamDone) {
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
					<MultiSeriesChart2
						title=""
						dataset={visibleDataset}
						charts={visibleCharts}
						selectedCharts={selectedCharts}
						valueSymbol="$"
						hideDefaultLegend
						chartOptions={DOLLAR_CHART_OPTIONS}
						exportButtons={HIDDEN_EXPORTS}
						onReady={handleChartReady}
					/>
				)
			case 'tokenBorrowedUsd':
				return (
					<MultiSeriesChart2
						title=""
						dataset={visibleDataset}
						charts={visibleCharts}
						selectedCharts={selectedCharts}
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
						chartData={pieChart}
						exportButtons={{
							png: true,
							csv: false,
							filename: imageFilename,
							pngTitle: imageTitle
						}}
					/>
				)
			case 'tokenBorrowedRaw':
				return (
					<MultiSeriesChart2
						title=""
						dataset={visibleDataset}
						charts={visibleCharts}
						selectedCharts={selectedCharts}
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

	const hasChartData = chartType === 'tokensBorrowedPie' ? pieChart.length > 0 : filteredDataset.source.length > 0

	return (
		<div className="flex h-full flex-col p-2">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{chartTypeLabel}</h3>
					<p className="text-xs text-pro-text-secondary">{protocolName}</p>
				</div>
				{hasChartData ? (
					<div className="flex items-center gap-2">
						{chartType !== 'tokensBorrowedPie' && selectorValues.length > 1 ? (
							<SelectWithCombobox
								allValues={selectorValues}
								selectedValues={selectedSeries}
								setSelectedValues={setSelectedSeries}
								label={selectorLabel}
								labelType="smol"
								variant="filter"
								size="md"
							/>
						) : null}
						{chartType !== 'tokensBorrowedPie' ? (
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

			<div className="flex-1">
				<Suspense fallback={<div className="min-h-[360px]" />}>{chartContent}</Suspense>
			</div>
		</div>
	)
}
