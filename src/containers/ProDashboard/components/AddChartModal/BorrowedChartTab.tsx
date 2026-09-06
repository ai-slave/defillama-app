import { lazy, Suspense, useMemo, type ReactElement } from 'react'
import type { TimestampDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import { createTimeSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/timeSeriesOptions'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useProtocolBreakdownPresentation } from '~/containers/ProtocolOverview/useProtocolBreakdownPresentation'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { BORROWED_CHART_OPTIONS, BORROWED_CHART_TYPES } from '../../borrowedChartConstants'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { shouldSuppressBorrowedTokenBreakdown } from '../../services/protocolTvl'
import type { BorrowedChartType } from '../../types'
import { AriakitSelect } from '../AriakitSelect'
import { AriakitVirtualizedSelect, type VirtualizedSelectOption } from '../AriakitVirtualizedSelect'
import { useBorrowedChartData } from '../useBorrowedChartData'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const EMPTY_DATASET: TimestampDataset = {
	source: [],
	dimensions: ['timestamp']
}
const PREVIEW_EXPORTS = {
	csv: true,
	png: true,
	filename: 'chart',
	pngTitle: ''
} as const
const DOLLAR_CHART_OPTIONS = {
	...BORROWED_CHART_OPTIONS,
	...createTimeSeriesChartOptions('$')
}
const UNITLESS_CHART_OPTIONS = {
	...BORROWED_CHART_OPTIONS,
	...createTimeSeriesChartOptions('')
}

interface BorrowedChartTabProps {
	selectedBorrowedProtocol: string | null
	selectedBorrowedProtocolName: string | null
	selectedBorrowedChartType: string
	onSelectedBorrowedProtocolChange: (protocol: string | null) => void
	onSelectedBorrowedProtocolNameChange: (name: string | null) => void
	onSelectedBorrowedChartTypeChange: (chartType: string) => void
	protocolOptions: Array<VirtualizedSelectOption>
	protocolsLoading: boolean
}

export function BorrowedChartTab({
	selectedBorrowedProtocol,
	selectedBorrowedProtocolName,
	selectedBorrowedChartType,
	onSelectedBorrowedProtocolChange,
	onSelectedBorrowedProtocolNameChange,
	onSelectedBorrowedChartTypeChange,
	protocolOptions,
	protocolsLoading
}: BorrowedChartTabProps) {
	const activeChartType = BORROWED_CHART_TYPES.some((type) => type.value === selectedBorrowedChartType)
		? (selectedBorrowedChartType as BorrowedChartType)
		: 'chainsBorrowed'
	const { getProtocolInfo } = useProDashboardCatalog()
	const protocolMisrepresentsTokens =
		selectedBorrowedProtocol != null && getProtocolInfo(selectedBorrowedProtocol)?.misrepresentedTokens === true
	const suppressTokenBreakdown = shouldSuppressBorrowedTokenBreakdown(activeChartType, protocolMisrepresentsTokens)
	const { data: borrowedData, isLoading } = useBorrowedChartData({
		protocol: selectedBorrowedProtocol ?? '',
		chartType: activeChartType,
		enabled: !!selectedBorrowedProtocol && !suppressTokenBreakdown,
		staleTime: 60 * 60 * 1000
	})
	const seriesNames = borrowedData.seriesNames
	const pieSeriesNames = useMemo(
		() => borrowedData.pieSeries.peers.map((peer) => peer.name),
		[borrowedData.pieSeries.peers]
	)
	const isRuntimeBreakdown = activeChartType !== 'tokensBorrowedPie'
	const runtimePresentation = useProtocolBreakdownPresentation({
		breakdown: borrowedData.breakdown ?? [],
		availableSeries: isRuntimeBreakdown ? seriesNames : [],
		defaultSeries: borrowedData.defaultSeriesNames,
		aggregateOthers: activeChartType === 'chainsBorrowed' || activeChartType === 'tokenBorrowedUsd',
		type: 'line',
		fillMissingWithZero: true,
		selectionKey: `${selectedBorrowedProtocol}:${activeChartType}`
	})
	const dataset = isRuntimeBreakdown ? runtimePresentation.dataset : EMPTY_DATASET
	const charts = useMemo(
		() => runtimePresentation.charts.map((chart) => ({ ...chart, hideAreaStyle: true })),
		[runtimePresentation.charts]
	)
	const pieSelection = useAllSeriesSelection({
		availableSeries: pieSeriesNames,
		selectionKey: `${selectedBorrowedProtocol}:tokensBorrowedPie`
	})
	const piePresentation = useMemo(
		() =>
			buildRuntimePieChartPresentation({
				series: borrowedData.pieSeries,
				selectedSeries: pieSelection.selectedCharts,
				includeUpstreamOthers: pieSelection.includeUpstreamOthers
			}),
		[borrowedData.pieSeries, pieSelection.includeUpstreamOthers, pieSelection.selectedCharts]
	)
	const selectorLabel = activeChartType === 'chainsBorrowed' ? 'Chain' : 'Token'

	const handleProtocolChange = (option: VirtualizedSelectOption) => {
		onSelectedBorrowedProtocolChange(option.value)
		onSelectedBorrowedProtocolNameChange(option.label)
		onSelectedBorrowedChartTypeChange('chainsBorrowed')
	}

	const chartTypeLabel = BORROWED_CHART_TYPES.find((t) => t.value === selectedBorrowedChartType)?.label || ''
	const chartTypeOptions = useMemo(
		() =>
			BORROWED_CHART_TYPES.map((option) => ({
				...option,
				disabled: shouldSuppressBorrowedTokenBreakdown(option.value, protocolMisrepresentsTokens)
			})),
		[protocolMisrepresentsTokens]
	)
	const visibleDataset = activeChartType === 'tokensBorrowedPie' ? EMPTY_DATASET : dataset
	const previewTitle = chartTypeLabel
		? `${selectedBorrowedProtocolName} - ${chartTypeLabel}`
		: selectedBorrowedProtocolName || ''
	const hasProtocolSelection = Boolean(selectedBorrowedProtocol && selectedBorrowedProtocolName)
	const hasData =
		activeChartType === 'tokensBorrowedPie'
			? borrowedData.pieSeries.peers.length > 0 || borrowedData.pieSeries.upstreamOthersValue > 0
			: dataset.source.length > 0

	let chartContent: ReactElement | null = null
	if (isLoading) {
		chartContent = (
			<div className="flex h-[320px] items-center justify-center">
				<LocalLoader />
			</div>
		)
	} else {
		switch (selectedBorrowedChartType) {
			case 'chainsBorrowed':
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
							dataset={visibleDataset}
							charts={charts}
							selectedCharts={runtimePresentation.selectedCharts}
							valueSymbol="$"
							hideDefaultLegend
							chartOptions={DOLLAR_CHART_OPTIONS}
							csvSource={runtimePresentation.csvSource}
							exportButtons={PREVIEW_EXPORTS}
						/>
					</Suspense>
				)
				break
			case 'tokenBorrowedUsd':
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
							dataset={visibleDataset}
							charts={charts}
							selectedCharts={runtimePresentation.selectedCharts}
							valueSymbol="$"
							hideDefaultLegend
							chartOptions={DOLLAR_CHART_OPTIONS}
							csvSource={runtimePresentation.csvSource}
							exportButtons={PREVIEW_EXPORTS}
						/>
					</Suspense>
				)
				break
			case 'tokensBorrowedPie':
				chartContent = (
					<Suspense
						fallback={
							<div className="flex h-[320px] items-center justify-center">
								<LocalLoader />
							</div>
						}
					>
						<PieChart chartData={piePresentation.chartData} stackColors={piePresentation.stackColors} />
					</Suspense>
				)
				break
			case 'tokenBorrowedRaw':
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
							dataset={visibleDataset}
							charts={charts}
							selectedCharts={runtimePresentation.selectedCharts}
							valueSymbol=""
							hideDefaultLegend
							chartOptions={UNITLESS_CHART_OPTIONS}
							csvSource={runtimePresentation.csvSource}
							exportButtons={PREVIEW_EXPORTS}
						/>
					</Suspense>
				)
				break
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-3">
				<AriakitVirtualizedSelect
					label="Protocol"
					options={protocolOptions}
					selectedValue={selectedBorrowedProtocol || ''}
					onChange={handleProtocolChange}
					placeholder="Select protocol..."
					isLoading={protocolsLoading}
				/>

				<Tooltip content={!hasProtocolSelection ? 'Select protocol first' : null} className="w-full">
					<div className={`w-full ${!hasProtocolSelection ? 'pointer-events-none opacity-50' : ''}`}>
						<AriakitSelect
							label="Chart Type"
							options={chartTypeOptions}
							selectedValue={selectedBorrowedChartType}
							onChange={(option) => onSelectedBorrowedChartTypeChange(option.value)}
							placeholder="Select chart type..."
						/>
					</div>
				</Tooltip>

				{hasProtocolSelection && isLoading ? (
					<p className="text-xs text-pro-text-tertiary">Loading selected chart...</p>
				) : null}

				{hasProtocolSelection && !isLoading && !hasData ? (
					<p className="text-xs text-pro-text-tertiary">No data available for this chart type.</p>
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
								<h3 className="mb-1 text-sm font-semibold text-pro-text-primary">{previewTitle}</h3>
								<p className="text-xs text-pro-text-secondary">Borrowed Chart</p>
							</div>
							{activeChartType === 'tokensBorrowedPie' && pieSeriesNames.length > 1 ? (
								<SelectWithCombobox
									allValues={pieSeriesNames}
									selectedValues={pieSelection.activeSeries}
									setSelectedValues={pieSelection.setSelectedSeries}
									label="Token"
									labelType="smol"
									variant="filter"
									size="md"
								/>
							) : seriesNames.length > 1 ? (
								<SelectWithCombobox
									allValues={seriesNames}
									selectedValues={runtimePresentation.activeSeries}
									setSelectedValues={runtimePresentation.setSelectedSeries}
									label={selectorLabel}
									labelType="smol"
									variant="filter"
									size="md"
								/>
							) : null}
						</div>

						{!hasData && !isLoading ? (
							<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
								No data available for this chart type.
							</div>
						) : (
							<div className="h-[320px]">{chartContent}</div>
						)}
					</div>
				) : (
					<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
						<div>
							<Icon name="trending-up" height={32} width={32} className="mx-auto mb-1" />
							<p className="text-xs">Select a protocol to see available borrowed charts</p>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
