import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useMemo } from 'react'
import { buildTimeSeriesDataset, type TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualizedSelect, type VirtualizedSelectOption } from '~/components/Select/VirtualizedSelect'
import type { IProtocolValueChart } from '~/containers/ProtocolOverview/api.types'
import {
	buildProtocolBreakdownPresentation,
	MAX_PROTOCOL_BREAKDOWN_SERIES,
	type ProtocolBreakdownChart
} from '~/containers/ProtocolOverview/useProtocolBreakdownCharts'
import {
	buildProtocolValueChartQueryKey,
	fetchProtocolValueChart
} from '~/containers/ProtocolOverview/valueChartSources'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { shouldSuppressAdvancedTvlTokenBreakdown } from '../../services/protocolTvl'
import type { AdvancedTvlChartType } from '../../types'
import { buildAdvancedTvlPresentation } from '../advancedTvlPresentation'
import { useAdvancedTvlChartData } from '../useAdvancedTvlChartData'
import { BoundParameterChip, useModalFieldBinding } from './bindingContext'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))

interface AdvancedTvlChartTabProps {
	/** What Add still needs, shown under the protocol once Add was pressed. */
	error: string | null
	selectedAdvancedTvlProtocol: string | null
	selectedAdvancedTvlProtocolName: string | null
	selectedAdvancedTvlChartType: AdvancedTvlChartType
	onSelectedAdvancedTvlProtocolChange: (protocol: string | null) => void
	onSelectedAdvancedTvlProtocolNameChange: (name: string | null) => void
	onSelectedAdvancedTvlChartTypeChange: (chartType: AdvancedTvlChartType) => void
	protocolOptions: Array<VirtualizedSelectOption>
	protocolsLoading: boolean
}

const ADVANCED_TVL_CHART_TYPES: Array<{ value: AdvancedTvlChartType; label: string }> = [
	{ value: 'tvl', label: 'TVL' },
	{ value: 'chainsTvl', label: 'TVL by Chains' },
	{ value: 'tokenValuesUsd', label: 'Token Values (USD)' },
	{ value: 'tokensPie', label: 'Tokens breakdown' },
	{ value: 'tokenBalances', label: 'Token Balances (Raw)' },
	{ value: 'usdInflows', label: 'USD Inflows' },
	{ value: 'tokenInflows', label: 'Inflows by token' }
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
const EMPTY_STACKS: Array<string> = []
const EMPTY_BREAKDOWN: ProtocolBreakdownChart = []
const selectBasicTvlDataset = (data: IProtocolValueChart | null) => buildTimeSeriesDataset(data ?? [], 'TVL', 1)

export function AdvancedTvlChartTab({
	error,
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
	const chartType = selectedAdvancedTvlChartType
	const protocolMisrepresentsTokens =
		selectedAdvancedTvlProtocol != null && getProtocolInfo(selectedAdvancedTvlProtocol)?.misrepresentedTokens === true
	const suppressTokenBreakdowns = shouldSuppressAdvancedTvlTokenBreakdown(chartType, protocolMisrepresentsTokens)

	const { data: basicTvlDataset, isLoading: isBasicTvlLoading } = useQuery({
		queryKey: buildProtocolValueChartQueryKey({ source: 'tvl', protocol: selectedAdvancedTvlProtocol ?? '' }),
		queryFn: () => {
			if (!selectedAdvancedTvlProtocol) throw new Error('Missing advanced TVL protocol')
			return fetchProtocolValueChart({ source: 'tvl', protocol: selectedAdvancedTvlProtocol })
		},
		enabled: !!selectedAdvancedTvlProtocol && selectedAdvancedTvlChartType === 'tvl',
		staleTime: 60 * 60 * 1000,
		select: selectBasicTvlDataset
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
	const breakdown = advancedData.breakdown ?? EMPTY_BREAKDOWN
	const { activeSeries, setSelectedSeries, isDefaultSelection } = useLocalSelection({
		availableSeries: selectorValues,
		defaultSeries: advancedData.defaultSeriesNames,
		...(chartType === 'chainsTvl' || chartType === 'tokenValuesUsd' || chartType === 'tokenInflows'
			? {}
			: { maxSelectedSeries: MAX_PROTOCOL_BREAKDOWN_SERIES }),
		allowEmptySelection: true,
		scope: `${selectedAdvancedTvlProtocol}:${selectedAdvancedTvlChartType}`
	})
	const runtimePresentation = useMemo(() => {
		const aggregateOthers = chartType === 'chainsTvl' || chartType === 'tokenValuesUsd' || chartType === 'tokenInflows'
		const presentation = buildProtocolBreakdownPresentation({
			breakdown,
			availableSeries: selectorValues,
			activeSeries,
			aggregateOthers: chartType === 'chainsTvl' || chartType === 'tokenValuesUsd' || chartType === 'tokenInflows',
			includeUpstreamOthers: aggregateOthers && isDefaultSelection,
			type: chartType === 'tokenInflows' ? 'bar' : 'line',
			...(chartType === 'tokenInflows' ? { stack: 'stackA' } : {}),
			fillMissingWithZero: true
		})
		return {
			...presentation,
			dataset: presentation.dataset ?? EMPTY_DATASET,
			activeSeries,
			setSelectedSeries,
			selectedCharts: new Set(presentation.charts.map((chart) => chart.name))
		}
	}, [breakdown, selectorValues, activeSeries, chartType, isDefaultSelection, setSelectedSeries])
	const advancedDataset = isRuntimeBreakdown ? runtimePresentation.dataset : (advancedData.dataset ?? EMPTY_DATASET)
	const renderedSeries = useMemo(
		() => runtimePresentation.charts.map((chart) => chart.name),
		[runtimePresentation.charts]
	)

	const presentation = useMemo(
		() =>
			buildAdvancedTvlPresentation({
				chartType,
				chainsDataset: chartType === 'chainsTvl' ? advancedDataset : EMPTY_DATASET,
				chainNames: chartType === 'chainsTvl' ? renderedSeries : EMPTY_STACKS,
				tokenNames: chartType === 'chainsTvl' ? EMPTY_STACKS : renderedSeries
			}),
		[chartType, advancedDataset, renderedSeries]
	)
	const pieSelection = useLocalSelection({
		allowEmptySelection: true,
		availableSeries: pieSeriesNames,
		scope: `${selectedAdvancedTvlProtocol}:tokensPie`
	})
	const piePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: advancedData.pieSeries,
				selectedSeries: pieSelection.selectedCharts
			}),
		[advancedData.pieSeries, pieSelection.selectedCharts]
	)
	const selectorLabel = chartType === 'chainsTvl' ? 'Chain' : 'Token'
	const canonicalDataset = chartType === 'tvl' ? resolvedBasicTvlDataset : advancedDataset
	const csvSource = isRuntimeBreakdown
		? runtimePresentation.csvSource
		: { type: 'dataset' as const, prepare: () => canonicalDataset }

	const chartTypeOptions = useMemo(
		() =>
			ADVANCED_TVL_CHART_TYPES.map((option) => ({
				...option,
				disabled: shouldSuppressAdvancedTvlTokenBreakdown(option.value, protocolMisrepresentsTokens)
			})),
		[protocolMisrepresentsTokens]
	)

	const isLoading = selectedAdvancedTvlChartType === 'tvl' ? isBasicTvlLoading : isAdvancedLoading

	const protocolParameter = useModalFieldBinding('protocol', 'protocol')
	const selectableProtocolOptions = useMemo(
		() => (protocolParameter.options.length > 0 ? [...protocolParameter.options, ...protocolOptions] : protocolOptions),
		[protocolParameter.options, protocolOptions]
	)

	const handleProtocolChange = (option: VirtualizedSelectOption) => {
		const variable = protocolParameter.resolveSelection(option.value)
		if (variable) {
			onSelectedAdvancedTvlProtocolChange(variable.value)
			onSelectedAdvancedTvlProtocolNameChange(
				protocolOptions.find((item) => item.value === variable.value)?.label ?? variable.value
			)
			onSelectedAdvancedTvlChartTypeChange('tvl')
			protocolParameter.bind(variable.id)
			return
		}
		onSelectedAdvancedTvlProtocolChange(option.value)
		onSelectedAdvancedTvlProtocolNameChange(option.label)
		onSelectedAdvancedTvlChartTypeChange('tvl')
	}

	const chartTypeLabel = ADVANCED_TVL_CHART_TYPES.find((t) => t.value === selectedAdvancedTvlChartType)?.label || ''

	const chartContent = (() => {
		if (isLoading) {
			return <SurfaceBodyLoadingStatus />
		}

		const hasData =
			chartType === 'tokensPie'
				? advancedData.pieSeries.peers.length > 0 || advancedData.pieSeries.upstreamOthersValue > 0
				: canonicalDataset.source.length > 0
		if (!hasData) {
			return <SurfaceBodyStatus variant="empty">No data available for this chart type.</SurfaceBodyStatus>
		}

		return (
			<Suspense fallback={<ChartPanelExportShellFallback />}>
				{chartType === 'tokensPie' ? (
					<PieChart chartData={piePresentation.chartData} stackColors={piePresentation.stackColors} />
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
						{...(presentation.chartOptions ? { chartOptions: presentation.chartOptions } : {})}
						csvSource={csvSource}
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
				{protocolParameter.boundVariable ? (
					<BoundParameterChip label={protocolParameter.boundVariable.label} onUnbind={protocolParameter.unbind} />
				) : null}
				<VirtualizedSelect
					variant="field"
					label="Protocol"
					error={error}
					options={selectableProtocolOptions}
					selectedValue={selectedAdvancedTvlProtocol || null}
					onChange={handleProtocolChange}
					placeholder="Select protocol…"
					isLoading={protocolsLoading}
				/>

				<Tooltip
					content={!hasProtocolSelection ? 'Select protocol first' : null}
					className={`w-full ${!hasProtocolSelection ? 'pointer-events-none opacity-50' : ''}`}
					render={<div />}
				>
					<VirtualizedSelect
						variant="field"
						label="Chart type"
						options={chartTypeOptions}
						selectedValue={selectedAdvancedTvlChartType}
						onChange={(option) => onSelectedAdvancedTvlChartTypeChange(option.value)}
						placeholder="Select chart type…"
					/>
				</Tooltip>

				{hasProtocolSelection && isLoading ? <p className="body-sm text-tertiary">Loading selected chart…</p> : null}
			</div>

			<div className="overflow-hidden rounded-lg border border-subtle">
				<h4 className="border-b border-subtle px-3 py-2 label-sm text-secondary">Preview</h4>

				{hasProtocolSelection ? (
					<div className="bg-surface p-3">
						<div className="mb-3 flex flex-wrap items-start justify-between gap-2">
							<div>
								<h3 className="mb-1 title-md text-primary">
									{selectedAdvancedTvlProtocolName} - {chartTypeLabel}
								</h3>
								<p className="body-sm text-secondary">Advanced TVL Chart</p>
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

						<div className="flex min-h-[400px] flex-col">{chartContent}</div>
					</div>
				) : (
					<div className="flex h-[320px] items-center justify-center text-center text-tertiary">
						<div>
							<Icon name="trending-up" height={32} width={32} className="mx-auto mb-1" />
							<p className="body-sm">Select a protocol to see available TVL charts</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
