import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useMemo } from 'react'
import { buildTimeSeriesDataset, type TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useProtocolBreakdownPresentation } from '~/containers/ProtocolOverview/useProtocolBreakdownPresentation'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
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

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
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
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
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
		select: (data) => buildTimeSeriesDataset(data, 'TVL', 1)
	})
	const { data: advancedData, isLoading: isAdvancedLoading } = useAdvancedTvlChartData({
		protocol: selectedAdvancedTvlProtocol ?? '',
		protocolName: selectedAdvancedTvlProtocolName ?? '',
		chartType,
		extraTvlsEnabled,
		enabled: !!selectedAdvancedTvlProtocol && chartType !== 'tvl' && !suppressTokenBreakdowns
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
		selectionKey: `${selectedAdvancedTvlProtocol}:${selectedAdvancedTvlChartType}`
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
		selectionKey: `${selectedAdvancedTvlProtocol}:tokensPie`
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
	const canonicalDataset = chartType === 'tvl' ? resolvedBasicTvlDataset : advancedDataset

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

		const hasData =
			chartType === 'tokensPie'
				? advancedData.pieSeries.peers.length > 0 || advancedData.pieSeries.upstreamOthersValue > 0
				: canonicalDataset.source.length > 0
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
					<PieChart
						chartData={piePresentation.chartData}
						stackColors={{ ...piePresentation.stackColors, ...presentation.stackColors }}
					/>
				) : (
					<MultiSeriesChart
						title=""
						dataset={canonicalDataset}
						charts={presentation.charts}
						valueSymbol={presentation.valueSymbol}
						hideDefaultLegend
						hideDataZoom={presentation.hideDataZoom}
						solidChartAreaStyle={presentation.solidChartAreaStyle}
						{...(selectorValues.length > 0 ? { selectedCharts: runtimePresentation.selectedCharts } : {})}
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
						<div className="mb-3 flex flex-wrap items-start justify-between gap-2">
							<div>
								<h3 className="mb-1 text-sm font-semibold text-pro-text-primary">
									{selectedAdvancedTvlProtocolName} - {chartTypeLabel}
								</h3>
								<p className="text-xs text-pro-text-secondary">Advanced TVL Chart</p>
							</div>
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
						</div>

						<div className="h-[320px]">{chartContent}</div>
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
