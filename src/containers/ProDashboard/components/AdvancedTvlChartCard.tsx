import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import {
	buildTimeSeriesDataset,
	materializeZeroFilledDataset,
	type TimestampDataset
} from '~/components/ECharts/timeSeriesDataset'
import type { IMultiSeriesChart2Props, IPieChartProps, MultiSeriesChart2Dataset } from '~/components/ECharts/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import {
	formatProtocolV1TvlsByChain,
	useFetchProtocolV1AddlChartsData
} from '~/containers/ProtocolOverview/protocolV1AddlChartsData'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useSelectedValues } from '~/hooks/useSelectedValues'
import { toNiceCsvDate } from '~/utils'
import { download } from '~/utils/download'
import { useChartImageExport } from '../hooks/useChartImageExport'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext } from '../queries'
import { fetchAdvancedTvlBasicViaProxy, fetchProtocolFullViaProxy } from '../services/fetchViaProxy'
import ProtocolCharts from '../services/ProtocolCharts'
import type { AdvancedTvlChartConfig } from '../types'
import { buildAdvancedTvlPresentation } from './advancedTvlPresentation'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { LoadingSpinner } from './LoadingSpinner'
import { ProTableCSVButton } from './ProTable/CsvButton'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
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
	const authToken = useContext(ProxyAuthTokenContext)

	const { data: basicTvlDataset, isLoading: isBasicTvlLoading } = useQuery({
		queryKey: ['pro-dashboard', 'advanced-tvl-basic', protocol],
		queryFn: () => (authToken ? fetchAdvancedTvlBasicViaProxy(protocol, authToken) : ProtocolCharts.tvl(protocol)),
		enabled: streamDone && chartType === 'tvl',
		staleTime: Infinity,
		select: (data) => buildTimeSeriesDataset(data, 'TVL', 1000)
	})

	// Pre-seed protocol full data via proxy so useFetchProtocolV1AddlChartsData uses cached data
	useQuery({
		queryKey: ['protocol-overview-v1', protocol, 'metrics'],
		queryFn: () => (authToken ? fetchProtocolFullViaProxy(protocol, authToken) : null),
		enabled: streamDone && !!authToken && chartType !== 'tvl',
		staleTime: Infinity
	})

	const {
		data: addlData,
		historicalChainTvls,
		isLoading: isAddlLoading
	} = useFetchProtocolV1AddlChartsData(protocol, false, undefined, streamDone && chartType !== 'tvl')

	const { dataset: chainsDataset, chainsUnique } = useMemo(() => {
		if (chartType !== 'chainsTvl' || !historicalChainTvls) {
			return { dataset: EMPTY_DATASET, chainsUnique: EMPTY_STACKS }
		}
		return formatProtocolV1TvlsByChain({
			historicalChainTvls,
			extraTvlsEnabled
		})
	}, [historicalChainTvls, extraTvlsEnabled, chartType])

	const {
		tokensUnique,
		rawTokensUnique,
		tokenBreakdownUSDDataset,
		tokenBreakdownPieChart,
		tokenBreakdownDataset,
		usdInflowsDataset,
		tokenInflowsDataset
	} = addlData ?? {}
	const resolvedTokensUnique = tokensUnique ?? EMPTY_STACKS
	const resolvedRawTokensUnique = rawTokensUnique ?? resolvedTokensUnique
	const resolvedTokenBreakdownUSDDataset = tokenBreakdownUSDDataset ?? EMPTY_DATASET
	const resolvedTokenBreakdownPieChart = tokenBreakdownPieChart ?? []
	const resolvedTokenBreakdownDataset = tokenBreakdownDataset ?? EMPTY_DATASET
	const resolvedUsdInflowsDataset = usdInflowsDataset ?? EMPTY_DATASET
	const resolvedTokenInflowsDataset = tokenInflowsDataset ?? EMPTY_DATASET
	const resolvedBasicTvlDataset = basicTvlDataset ?? EMPTY_DATASET
	const presentationTokenNames = chartType === 'tokenBalances' ? resolvedRawTokensUnique : resolvedTokensUnique

	const presentation = useMemo(
		() =>
			buildAdvancedTvlPresentation({
				chartType,
				chainsDataset,
				chainNames: chainsUnique,
				tokenNames: presentationTokenNames
			}),
		[chartType, chainsDataset, chainsUnique, presentationTokenNames]
	)

	const selectorValues =
		chartType === 'chainsTvl'
			? presentation.orderedChainNames
			: chartType === 'tokenValuesUsd' || chartType === 'tokenBalances' || chartType === 'tokenInflows'
				? presentationTokenNames
				: EMPTY_STACKS
	const [selectedSeries, setSelectedSeries] = useSelectedValues(selectorValues, `${protocol}:${chartType}`)
	const selectedCharts = useMemo(() => new Set(selectedSeries), [selectedSeries])
	const selectorLabel = chartType === 'chainsTvl' ? 'Chain' : 'Token'

	const rawVisibleDataset = useMemo(() => {
		switch (chartType) {
			case 'tvl':
				return resolvedBasicTvlDataset
			case 'chainsTvl':
				return chainsDataset
			case 'tokenValuesUsd':
				return resolvedTokenBreakdownUSDDataset
			case 'tokenBalances':
				return resolvedTokenBreakdownDataset
			case 'usdInflows':
				return resolvedUsdInflowsDataset
			case 'tokenInflows':
				return resolvedTokenInflowsDataset
			default:
				return EMPTY_DATASET
		}
	}, [
		chartType,
		resolvedBasicTvlDataset,
		chainsDataset,
		resolvedTokenBreakdownUSDDataset,
		resolvedTokenBreakdownDataset,
		resolvedUsdInflowsDataset,
		resolvedTokenInflowsDataset
	])
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
		const buildRows = (dataset: MultiSeriesChart2Dataset, seriesNames: string[]) => [
			['Date', ...seriesNames],
			...dataset.source.map((row) => [
				toNiceCsvDate((row.timestamp as number) / 1000),
				...seriesNames.map((name) => row[name] ?? '')
			])
		]

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
				rows = buildRows(filteredDataset, resolvedTokensUnique)
				filename = `${protocolSlug}-token-values-usd`
				break
			case 'tokensPie':
				rows = [['Token', 'Value'], ...resolvedTokenBreakdownPieChart.map((row) => [row.name, row.value])]
				filename = `${protocolSlug}-tokens-breakdown`
				break
			case 'tokenBalances':
				rows = buildRows(filteredDataset, resolvedRawTokensUnique)
				filename = `${protocolSlug}-token-balances`
				break
			case 'usdInflows':
				rows = buildRows(filteredDataset, ['USD Inflows'])
				filename = `${protocolSlug}-usd-inflows`
				break
			case 'tokenInflows':
				rows = buildRows(filteredDataset, resolvedTokensUnique)
				filename = `${protocolSlug}-token-inflows`
				break
		}

		if (rows.length > 0) download(filename, rows.map((row) => row.join(',')).join('\n'))
	}

	const chartTypeLabel = CHART_TYPE_LABELS[chartType] || chartType
	const imageTitle = `${protocolName} - ${chartTypeLabel}`
	const imageFilename = `${protocol.toLowerCase().replace(/\s+/g, '-')}-${chartType}`
	const isLoading = (chartType === 'tvl' ? isBasicTvlLoading : isAddlLoading) || !streamDone

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
				chartData={resolvedTokenBreakdownPieChart}
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
			<MultiSeriesChart2
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

	const hasChartData =
		chartType === 'tokensPie' ? resolvedTokenBreakdownPieChart.length > 0 : filteredDataset.source.length > 0

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
