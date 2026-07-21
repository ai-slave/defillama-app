import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import {
	buildTimeSeriesDataset,
	materializeZeroFilledDataset,
	type TimestampDataset
} from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useSelectedValues } from '~/hooks/useSelectedValues'
import { toNiceCsvDate } from '~/utils'
import { download } from '~/utils/download'
import { useChartImageExport } from '../hooks/useChartImageExport'
import { useProDashboardCatalog, useProDashboardTime } from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import {
	fetchProtocolTvlValueForDashboard,
	getProtocolTvlValueQueryKey,
	shouldSuppressAdvancedTvlTokenBreakdown
} from '../services/protocolTvl'
import type { AdvancedTvlChartConfig } from '../types'
import { buildAdvancedTvlPresentation } from './advancedTvlPresentation'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { LoadingSpinner } from './LoadingSpinner'
import { ProTableCSVButton } from './ProTable/CsvButton'
import { useAdvancedTvlChartData } from './useAdvancedTvlChartData'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const EMPTY_DATASET: TimestampDataset = {
	source: [],
	dimensions: ['timestamp']
}
const EMPTY_STACKS: string[] = []
const HIDDEN_EXPORTS = 'hidden' as const

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
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl_fees')
	const streamDone = useContext(StreamDoneContext)
	const { getProtocolInfo } = useProDashboardCatalog()
	const suppressTokenBreakdowns = shouldSuppressAdvancedTvlTokenBreakdown(
		chartType,
		getProtocolInfo(protocol)?.misrepresentedTokens
	)

	const { data: basicTvlDataset, isLoading: isBasicTvlLoading } = useQuery({
		queryKey: getProtocolTvlValueQueryKey(protocol),
		queryFn: () => fetchProtocolTvlValueForDashboard(protocol),
		enabled: streamDone && chartType === 'tvl',
		staleTime: Infinity,
		select: (data) => buildTimeSeriesDataset(data ?? [], 'TVL', 1)
	})
	const { data: advancedData, isLoading: isAdvancedLoading } = useAdvancedTvlChartData({
		protocol,
		protocolName,
		chartType,
		extraTvlsEnabled,
		enabled: streamDone && chartType !== 'tvl' && !suppressTokenBreakdowns
	})
	const advancedDataset = advancedData.dataset ?? EMPTY_DATASET
	const advancedSeriesNames = advancedData.seriesNames
	const resolvedBasicTvlDataset = basicTvlDataset ?? EMPTY_DATASET

	const presentation = useMemo(
		() =>
			buildAdvancedTvlPresentation({
				chartType,
				chainsDataset: chartType === 'chainsTvl' ? advancedDataset : EMPTY_DATASET,
				chainNames: chartType === 'chainsTvl' ? advancedSeriesNames : EMPTY_STACKS,
				tokenNames: chartType === 'chainsTvl' ? EMPTY_STACKS : advancedSeriesNames
			}),
		[chartType, advancedDataset, advancedSeriesNames]
	)

	const selectorValues =
		chartType === 'chainsTvl'
			? presentation.orderedChainNames
			: chartType === 'tokenValuesUsd' || chartType === 'tokenBalances' || chartType === 'tokenInflows'
				? advancedSeriesNames
				: EMPTY_STACKS
	const [selectedSeries, setSelectedSeries] = useSelectedValues(selectorValues, `${protocol}:${chartType}`)
	const selectedCharts = useMemo(() => new Set(selectedSeries), [selectedSeries])
	const selectorLabel = chartType === 'chainsTvl' ? 'Chain' : 'Token'

	const rawVisibleDataset = useMemo(() => {
		return chartType === 'tvl' ? resolvedBasicTvlDataset : advancedDataset
	}, [chartType, resolvedBasicTvlDataset, advancedDataset])
	const filteredDataset = useMemo(
		() => filterChartDatasetByTimePeriod(rawVisibleDataset, timePeriod, customTimePeriod),
		[rawVisibleDataset, timePeriod, customTimePeriod]
	)
	const visibleDataset = useMemo(() => {
		switch (chartType) {
			case 'chainsTvl':
				return materializeZeroFilledDataset(filteredDataset, selectedSeries)
			case 'tokenValuesUsd':
				return materializeZeroFilledDataset(filteredDataset, selectedSeries)
			case 'tokenBalances':
				return materializeZeroFilledDataset(filteredDataset, selectedSeries)
			case 'usdInflows':
				return materializeZeroFilledDataset(filteredDataset, ['USD Inflows'])
			case 'tokenInflows':
				return materializeZeroFilledDataset(filteredDataset, selectedSeries)
			default:
				return filteredDataset
		}
	}, [chartType, filteredDataset, selectedSeries])

	const handleCsvExport = () => {
		let rows: (string | number)[][] = []
		let filename = ''
		const protocolSlug = protocol.toLowerCase().replace(/\s+/g, '-')
		const buildRows = (dataset: MultiSeriesChartDataset, columnNames: string[]) => {
			const indexes = columnNames.map((name) => dataset.dimensions.indexOf(name))
			return [
				['Date', ...columnNames],
				...dataset.source.map((row) => [
					toNiceCsvDate((row[0] as number) / 1000),
					...indexes.map((index) => row[index] ?? '')
				])
			]
		}

		switch (chartType) {
			case 'tvl':
				rows = buildRows(filteredDataset, ['TVL'])
				filename = `${protocolSlug}-tvl`
				break
			case 'chainsTvl':
				rows = buildRows(filteredDataset, presentation.orderedChainNames)
				filename = `${protocolSlug}-tvl-by-chains`
				break
			case 'tokenValuesUsd':
				rows = buildRows(filteredDataset, advancedSeriesNames)
				filename = `${protocolSlug}-token-values-usd`
				break
			case 'tokensPie':
				rows = [['Token', 'Value'], ...advancedData.pieChart.map((row) => [row.name, row.value])]
				filename = `${protocolSlug}-tokens-breakdown`
				break
			case 'tokenBalances':
				rows = buildRows(filteredDataset, advancedSeriesNames)
				filename = `${protocolSlug}-token-balances`
				break
			case 'usdInflows':
				rows = buildRows(filteredDataset, ['USD Inflows'])
				filename = `${protocolSlug}-usd-inflows`
				break
			case 'tokenInflows':
				rows = buildRows(filteredDataset, advancedSeriesNames)
				filename = `${protocolSlug}-token-inflows`
				break
		}

		if (rows.length > 0) download(filename, rows.map((row) => row.join(',')).join('\n'))
	}

	const chartTypeLabel = CHART_TYPE_LABELS[chartType] || chartType
	const imageTitle = `${protocolName} - ${chartTypeLabel}`
	const imageFilename = `${protocol.toLowerCase().replace(/\s+/g, '-')}-${chartType}`
	const isLoading = (chartType === 'tvl' ? isBasicTvlLoading : isAdvancedLoading) || !streamDone

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
				chartData={advancedData.pieChart}
				stackColors={presentation.stackColors}
				exportButtons={{
					png: true,
					csv: false,
					filename: imageFilename,
					pngTitle: imageTitle
				}}
				height="360px"
			/>
		) : (
			<MultiSeriesChart
				title=""
				dataset={visibleDataset}
				charts={presentation.charts}
				selectedCharts={selectorValues.length > 0 ? selectedCharts : undefined}
				valueSymbol={presentation.valueSymbol}
				hideDefaultLegend
				hideDataZoom={presentation.hideDataZoom}
				solidChartAreaStyle={presentation.solidChartAreaStyle}
				chartOptions={presentation.chartOptions}
				exportButtons={HIDDEN_EXPORTS}
				height="360px"
				onReady={handleChartReady}
			/>
		)

	const hasChartData = chartType === 'tokensPie' ? advancedData.pieChart.length > 0 : filteredDataset.source.length > 0

	return (
		<div className="flex min-h-[402px] flex-col p-2 md:min-h-[418px]">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">{chartTypeLabel}</h3>
					<p className="text-xs text-pro-text-secondary">{protocolName}</p>
				</div>
				{hasChartData ? (
					<div className="flex items-center gap-2">
						{selectorValues.length > 1 ? (
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
						{chartType !== 'tokensPie' ? (
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

			<div className="flex-1" key={chartType}>
				<Suspense fallback={<div className="min-h-[360px]" />}>{chartContent}</Suspense>
			</div>
		</div>
	)
}
