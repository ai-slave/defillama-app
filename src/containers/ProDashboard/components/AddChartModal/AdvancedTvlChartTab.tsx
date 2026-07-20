import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useMemo } from 'react'
import {
	buildTimeSeriesDataset,
	materializeZeroFilledDataset,
	type TimestampDataset
} from '~/components/ECharts/timeSeriesDataset'
import type { IMultiSeriesChart2Props, IPieChartProps } from '~/components/ECharts/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useSelectedValues } from '~/hooks/useSelectedValues'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import {
	fetchProtocolTvlValueForDashboard,
	getProtocolTvlValueQueryKey,
	shouldSuppressAdvancedTvlTokenBreakdown
} from '../../services/protocolTvl'
import type { AdvancedTvlChartType } from '../../types'
import { buildAdvancedTvlPresentation } from '../advancedTvlPresentation'
import { AriakitSelect } from '../AriakitSelect'
import { AriakitVirtualizedSelect, type VirtualizedSelectOption } from '../AriakitVirtualizedSelect'
import { useAdvancedTvlChartData } from '../useAdvancedTvlChartData'

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

const ADVANCED_TVL_CHART_TYPES: Array<{ value: AdvancedTvlChartType; label: string }> = [
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
	const { getProtocolInfo } = useProDashboardCatalog()
	const chartType = selectedAdvancedTvlChartType as AdvancedTvlChartType
	const protocolMisrepresentsTokens =
		selectedAdvancedTvlProtocol != null && getProtocolInfo(selectedAdvancedTvlProtocol)?.misrepresentedTokens === true
	const suppressTokenBreakdowns = shouldSuppressAdvancedTvlTokenBreakdown(chartType, protocolMisrepresentsTokens)

	const { data: basicTvlDataset, isLoading: isBasicTvlLoading } = useQuery({
		queryKey: getProtocolTvlValueQueryKey(selectedAdvancedTvlProtocol ?? ''),
		queryFn: () => fetchProtocolTvlValueForDashboard(selectedAdvancedTvlProtocol!),
		enabled: !!selectedAdvancedTvlProtocol && selectedAdvancedTvlChartType === 'tvl',
		staleTime: 60 * 60 * 1000,
		select: (data) => buildTimeSeriesDataset(data ?? [], 'TVL', 1)
	})
	const { data: advancedData, isLoading: isAdvancedLoading } = useAdvancedTvlChartData({
		protocol: selectedAdvancedTvlProtocol ?? '',
		protocolName: selectedAdvancedTvlProtocolName ?? '',
		chartType,
		extraTvlsEnabled,
		enabled: !!selectedAdvancedTvlProtocol && chartType !== 'tvl' && !suppressTokenBreakdowns
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
	const [selectedTokenInflows, setSelectedTokenInflows] = useSelectedValues(
		advancedSeriesNames,
		`${selectedAdvancedTvlProtocol}:${selectedAdvancedTvlChartType}`
	)
	const selectedTokenInflowsSet = useMemo(() => new Set(selectedTokenInflows), [selectedTokenInflows])
	const visibleDataset = useMemo(() => {
		switch (chartType) {
			case 'chainsTvl':
				return materializeZeroFilledDataset(advancedDataset, presentation.orderedChainNames)
			case 'tokenValuesUsd':
				return materializeZeroFilledDataset(advancedDataset, advancedSeriesNames)
			case 'tokenBalances':
				return materializeZeroFilledDataset(advancedDataset, advancedSeriesNames)
			case 'usdInflows':
				return materializeZeroFilledDataset(advancedDataset, ['USD Inflows'])
			case 'tokenInflows':
				return materializeZeroFilledDataset(advancedDataset, selectedTokenInflows)
			default:
				return resolvedBasicTvlDataset
		}
	}, [
		chartType,
		advancedDataset,
		advancedSeriesNames,
		presentation.orderedChainNames,
		selectedTokenInflows,
		resolvedBasicTvlDataset
	])

	const chartTypeOptions = useMemo(
		() =>
			ADVANCED_TVL_CHART_TYPES.map((option) => ({
				...option,
				disabled: shouldSuppressAdvancedTvlTokenBreakdown(option.value, protocolMisrepresentsTokens)
			})),
		[protocolMisrepresentsTokens]
	)

	const isLoading = selectedAdvancedTvlChartType === 'tvl' ? isBasicTvlLoading : isAdvancedLoading

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

		const hasData = chartType === 'tokensPie' ? advancedData.pieChart.length > 0 : visibleDataset.source.length > 0
		if (!hasData) {
			return (
				<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
					No data available for this chart type.
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
					<PieChart chartData={advancedData.pieChart} stackColors={presentation.stackColors} />
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
					options={protocolOptions}
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

				{hasProtocolSelection && isLoading ? (
					<p className="text-xs text-pro-text-tertiary">Loading selected chart...</p>
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
							{selectedAdvancedTvlChartType === 'tokenInflows' && advancedSeriesNames.length > 1 ? (
								<SelectWithCombobox
									allValues={advancedSeriesNames}
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
