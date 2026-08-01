import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { buildTimeSeriesDataset, type TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useProtocolBreakdownPresentation } from '~/containers/ProtocolOverview/useProtocolBreakdownPresentation'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { formatIsoDate } from '~/utils/dateFormat'
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
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
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
		select: (data) => buildTimeSeriesDataset(data, 'TVL', 1)
	})
	const { data: advancedData, isLoading: isAdvancedLoading } = useAdvancedTvlChartData({
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
	const runtimePresentation = useProtocolBreakdownPresentation({
		breakdown: advancedData.breakdown ?? [],
		availableSeries: selectorValues,
		defaultSeries: advancedData.defaultSeriesNames,
		aggregateOthers: chartType === 'chainsTvl' || chartType === 'tokenValuesUsd' || chartType === 'tokenInflows',
		type: chartType === 'tokenInflows' ? 'bar' : 'line',
		...(chartType === 'tokenInflows' ? { stack: 'stackA' } : {}),
		fillMissingWithZero: true,
		selectionKey: `${protocol}:${chartType}`
	})
	const advancedDataset = isRuntimeBreakdown ? runtimePresentation.dataset : (advancedData.dataset ?? EMPTY_DATASET)
	const renderedSeries = runtimePresentation.charts.map((chart) => chart.name)

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

	const handleCsvExport = () => {
		let rows: (string | number)[][] = []
		let filename = ''
		const protocolSlug = protocol.toLowerCase().replace(/\s+/g, '-')
		const buildRows = (dataset: MultiSeriesChartDataset, columnNames: string[]) => {
			const indexes = columnNames.map((name) => dataset.dimensions.indexOf(name))
			return [
				['Date', ...columnNames],
				...dataset.source.map((row) => [
					formatIsoDate(row[0] as number, { input: 'milliseconds' }) ?? '',
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
				rows = buildRows(filteredDataset, renderedSeries)
				filename = `${protocolSlug}-tvl-by-chains`
				break
			case 'tokenValuesUsd':
				rows = buildRows(filteredDataset, renderedSeries)
				filename = `${protocolSlug}-token-values-usd`
				break
			case 'tokensPie':
				rows = [['Token', 'Value'], ...piePresentation.chartData.map((row) => [row.name, row.value])]
				filename = `${protocolSlug}-tokens-breakdown`
				break
			case 'tokenBalances':
				rows = buildRows(filteredDataset, renderedSeries)
				filename = `${protocolSlug}-token-balances`
				break
			case 'usdInflows':
				rows = buildRows(filteredDataset, ['USD Inflows'])
				filename = `${protocolSlug}-usd-inflows`
				break
			case 'tokenInflows':
				rows = buildRows(filteredDataset, renderedSeries)
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
				chartOptions={presentation.chartOptions}
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
						<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
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
