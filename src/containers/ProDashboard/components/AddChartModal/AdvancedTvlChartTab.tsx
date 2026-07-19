import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useContext, useMemo } from 'react'
import {
	buildTimeSeriesDataset,
	materializeZeroFilledDataset,
	type TimestampDataset
} from '~/components/ECharts/timeSeriesDataset'
import type { IMultiSeriesChart2Props, IPieChartProps } from '~/components/ECharts/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import {
	formatProtocolV1TvlsByChain,
	useFetchProtocolV1AddlChartsData
} from '~/containers/ProtocolOverview/protocolV1AddlChartsData'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useSelectedValues } from '~/hooks/useSelectedValues'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { ProxyAuthTokenContext } from '../../queries'
import { fetchAdvancedTvlBasicViaProxy, fetchProtocolFullViaProxy } from '../../services/fetchViaProxy'
import ProtocolCharts from '../../services/ProtocolCharts'
import type { AdvancedTvlChartType } from '../../types'
import { buildAdvancedTvlPresentation } from '../advancedTvlPresentation'
import { AriakitSelect } from '../AriakitSelect'
import { AriakitVirtualizedSelect, type VirtualizedSelectOption } from '../AriakitVirtualizedSelect'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

interface AdvancedTvlChartTabProps {
	selectedAdvancedTvlProtocol: string | null
	selectedAdvancedTvlProtocolName: string | null
	selectedAdvancedTvlChartType: string
	onSelectedAdvancedTvlProtocolChange: (protocol: string | null) => void
	onSelectedAdvancedTvlProtocolNameChange: (name: string | null) => void
	onSelectedAdvancedTvlChartTypeChange: (chartType: string) => void
	protocolOptions: VirtualizedSelectOption[]
	protocolsLoading: boolean
}

const ADVANCED_TVL_CHART_TYPES = [
	{ value: 'tvl', label: 'TVL' },
	{ value: 'chainsTvl', label: 'TVL by Chains' },
	{ value: 'tokenValuesUsd', label: 'Token Values (USD)' },
	{ value: 'tokensPie', label: 'Tokens Breakdown' },
	{ value: 'tokenBalances', label: 'Token Balances (Raw)' },
	{ value: 'usdInflows', label: 'USD Inflows' },
	{ value: 'tokenInflows', label: 'Inflows by Token' }
]

const AREA_PREVIEW_EXPORTS = {
	csv: true,
	png: true,
	filename: 'chart',
	pngTitle: ''
} as const
const BAR_PREVIEW_EXPORTS = {
	csv: true,
	png: false,
	filename: 'bar-chart-data'
} as const
const EMPTY_DATASET: TimestampDataset = {
	source: [],
	dimensions: ['timestamp']
}
const EMPTY_STACKS: string[] = []
const EMPTY_PIE_DATA: Array<{ name: string; value: number }> = []

export function AdvancedTvlChartTab({
	selectedAdvancedTvlProtocol,
	selectedAdvancedTvlProtocolName,
	selectedAdvancedTvlChartType,
	onSelectedAdvancedTvlProtocolChange,
	onSelectedAdvancedTvlProtocolNameChange,
	onSelectedAdvancedTvlChartTypeChange,
	protocolOptions,
	protocolsLoading
}: AdvancedTvlChartTabProps) {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl_fees')
	const authToken = useContext(ProxyAuthTokenContext)
	const filteredProtocolOptions = protocolOptions

	const { data: basicTvlDataset, isLoading: isBasicTvlLoading } = useQuery({
		queryKey: ['pro-dashboard', 'advanced-tvl-preview-basic', selectedAdvancedTvlProtocol],
		queryFn: () =>
			authToken
				? fetchAdvancedTvlBasicViaProxy(selectedAdvancedTvlProtocol!, authToken)
				: ProtocolCharts.tvl(selectedAdvancedTvlProtocol!),
		enabled: !!selectedAdvancedTvlProtocol && selectedAdvancedTvlChartType === 'tvl',
		staleTime: 60 * 60 * 1000,
		select: (data) => buildTimeSeriesDataset(data, 'TVL', 1000)
	})

	// Pre-seed protocol full data via proxy for useFetchProtocolV1AddlChartsData
	useQuery({
		queryKey: ['protocol-overview-v1', selectedAdvancedTvlProtocol, 'metrics'],
		queryFn: () =>
			authToken && selectedAdvancedTvlProtocol
				? fetchProtocolFullViaProxy(selectedAdvancedTvlProtocol, authToken)
				: null,
		enabled: !!selectedAdvancedTvlProtocol && !!authToken,
		staleTime: Infinity
	})

	const {
		data: addlData,
		historicalChainTvls,
		isLoading: isAddlLoading
	} = useFetchProtocolV1AddlChartsData(selectedAdvancedTvlProtocol || '')

	const { dataset: chainsDataset, chainsUnique } = useMemo(() => {
		if (!historicalChainTvls) return { dataset: EMPTY_DATASET, chainsUnique: EMPTY_STACKS }
		return formatProtocolV1TvlsByChain({
			historicalChainTvls,
			extraTvlsEnabled
		})
	}, [historicalChainTvls, extraTvlsEnabled])

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
	const resolvedTokenBreakdownPieChart = tokenBreakdownPieChart ?? EMPTY_PIE_DATA
	const resolvedTokenBreakdownDataset = tokenBreakdownDataset ?? EMPTY_DATASET
	const resolvedUsdInflowsDataset = usdInflowsDataset ?? EMPTY_DATASET
	const resolvedTokenInflowsDataset = tokenInflowsDataset ?? EMPTY_DATASET
	const resolvedBasicTvlDataset = basicTvlDataset ?? EMPTY_DATASET

	const chartType = selectedAdvancedTvlChartType as AdvancedTvlChartType
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
	const [selectedTokenInflows, setSelectedTokenInflows] = useSelectedValues(
		resolvedTokensUnique,
		`${selectedAdvancedTvlProtocol}:${selectedAdvancedTvlChartType}`
	)
	const selectedTokenInflowsSet = useMemo(() => new Set(selectedTokenInflows), [selectedTokenInflows])
	const visibleDataset = useMemo(() => {
		switch (chartType) {
			case 'chainsTvl':
				return materializeZeroFilledDataset(chainsDataset, presentation.orderedChainNames)
			case 'tokenValuesUsd':
				return materializeZeroFilledDataset(resolvedTokenBreakdownUSDDataset, resolvedTokensUnique)
			case 'tokenBalances':
				return materializeZeroFilledDataset(resolvedTokenBreakdownDataset, resolvedRawTokensUnique)
			case 'usdInflows':
				return materializeZeroFilledDataset(resolvedUsdInflowsDataset, ['USD Inflows'])
			case 'tokenInflows':
				return materializeZeroFilledDataset(resolvedTokenInflowsDataset, selectedTokenInflows)
			default:
				return resolvedBasicTvlDataset
		}
	}, [
		chartType,
		chainsDataset,
		presentation.orderedChainNames,
		resolvedTokenBreakdownUSDDataset,
		resolvedTokenBreakdownDataset,
		resolvedRawTokensUnique,
		resolvedTokensUnique,
		resolvedUsdInflowsDataset,
		resolvedTokenInflowsDataset,
		selectedTokenInflows,
		resolvedBasicTvlDataset
	])

	const availableChartTypes = useMemo(() => {
		const available = new Set<string>(['tvl'])

		if (chainsDataset.source.length > 0 && chainsUnique.length > 1) {
			available.add('chainsTvl')
		}
		if (resolvedTokenBreakdownUSDDataset.source.length > 1 && resolvedTokensUnique.length > 0) {
			available.add('tokenValuesUsd')
		}
		if (resolvedTokenBreakdownPieChart.length > 0) {
			available.add('tokensPie')
		}
		if (resolvedTokenBreakdownDataset.source.length > 1 && resolvedRawTokensUnique.length > 0) {
			available.add('tokenBalances')
		}
		if (resolvedUsdInflowsDataset.source.length > 0) {
			available.add('usdInflows')
		}
		if (resolvedTokenInflowsDataset.source.length > 0 && resolvedTokensUnique.length > 0) {
			available.add('tokenInflows')
		}

		return available
	}, [
		chainsDataset,
		chainsUnique,
		resolvedTokenBreakdownUSDDataset,
		resolvedTokenBreakdownPieChart,
		resolvedTokenBreakdownDataset,
		resolvedRawTokensUnique,
		resolvedTokensUnique,
		resolvedUsdInflowsDataset,
		resolvedTokenInflowsDataset
	])

	const chartTypeOptions = useMemo(() => {
		return ADVANCED_TVL_CHART_TYPES.map((type) => ({
			...type,
			disabled: !availableChartTypes.has(type.value)
		}))
	}, [availableChartTypes])

	const isLoading = selectedAdvancedTvlChartType === 'tvl' ? isBasicTvlLoading : isAddlLoading

	const handleProtocolChange = (option: VirtualizedSelectOption) => {
		onSelectedAdvancedTvlProtocolChange(option.value)
		onSelectedAdvancedTvlProtocolNameChange(option.label)
		onSelectedAdvancedTvlChartTypeChange('tvl')
	}

	const chartTypeLabel = ADVANCED_TVL_CHART_TYPES.find((t) => t.value === selectedAdvancedTvlChartType)?.label || ''

	const chartContent = (() => {
		if (isLoading) {
			return (
				<div className="flex h-[320px] items-center justify-center">
					<LocalLoader />
				</div>
			)
		}

		return (
			<Suspense
				fallback={
					<div className="flex h-[320px] items-center justify-center">
						<LocalLoader />
					</div>
				}
			>
				{chartType === 'tokensPie' ? (
					<PieChart chartData={resolvedTokenBreakdownPieChart} stackColors={presentation.stackColors} />
				) : (
					<MultiSeriesChart2
						title=""
						dataset={visibleDataset}
						charts={presentation.charts}
						valueSymbol={presentation.valueSymbol}
						hideDefaultLegend
						hideDataZoom={presentation.hideDataZoom}
						solidChartAreaStyle={presentation.solidChartAreaStyle}
						selectedCharts={chartType === 'tokenInflows' ? selectedTokenInflowsSet : undefined}
						chartOptions={presentation.chartOptions}
						exportButtons={
							chartType === 'usdInflows' || chartType === 'tokenInflows' ? BAR_PREVIEW_EXPORTS : AREA_PREVIEW_EXPORTS
						}
					/>
				)}
			</Suspense>
		)
	})()

	const hasProtocolSelection = selectedAdvancedTvlProtocol && selectedAdvancedTvlProtocolName

	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-3">
				<AriakitVirtualizedSelect
					label="Protocol"
					options={filteredProtocolOptions}
					selectedValue={selectedAdvancedTvlProtocol || ''}
					onChange={handleProtocolChange}
					placeholder="Select protocol..."
					isLoading={protocolsLoading}
				/>

				<Tooltip content={!hasProtocolSelection ? 'Select protocol first' : null} className="w-full">
					<div className={`w-full ${!hasProtocolSelection ? 'pointer-events-none opacity-50' : ''}`}>
						<AriakitSelect
							label="Chart Type"
							options={chartTypeOptions}
							selectedValue={selectedAdvancedTvlChartType}
							onChange={(option) => onSelectedAdvancedTvlChartTypeChange(option.value)}
							placeholder="Select chart type..."
						/>
					</div>
				</Tooltip>

				{hasProtocolSelection && isAddlLoading ? (
					<p className="text-xs text-pro-text-tertiary">Loading available chart types...</p>
				) : null}

				{hasProtocolSelection && !isAddlLoading ? (
					<div className="text-xs text-pro-text-tertiary">
						<p>
							Available charts: <span className="font-semibold text-pro-text-primary">{availableChartTypes.size}</span>
						</p>
					</div>
				) : null}
			</div>

			<div className="overflow-hidden rounded-lg border pro-border">
				<h4 className="border-b border-pro-cards-border px-3 py-2 text-xs font-medium text-pro-text-secondary">
					Preview
				</h4>

				{hasProtocolSelection ? (
					<div className="bg-pro-cards-bg p-3">
						<div className="mb-3 flex items-start justify-between gap-2">
							<div>
								<h3 className="mb-1 text-sm font-semibold text-pro-text-primary">
									{selectedAdvancedTvlProtocolName} - {chartTypeLabel}
								</h3>
								<p className="text-xs text-pro-text-secondary">Advanced TVL Chart</p>
							</div>
							{selectedAdvancedTvlChartType === 'tokenInflows' && resolvedTokensUnique.length > 1 ? (
								<SelectWithCombobox
									allValues={resolvedTokensUnique}
									selectedValues={selectedTokenInflows}
									setSelectedValues={setSelectedTokenInflows}
									label="Token"
									labelType="smol"
									variant="filter"
									size="md"
								/>
							) : null}
						</div>

						<div className="h-[320px]" key={selectedAdvancedTvlChartType}>
							{chartContent}
						</div>
					</div>
				) : (
					<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
						<div>
							<Icon name="trending-up" height={32} width={32} className="mx-auto mb-1" />
							<p className="text-xs">Select a protocol to see available TVL charts</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
