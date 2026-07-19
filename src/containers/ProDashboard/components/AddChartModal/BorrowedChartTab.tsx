import { lazy, Suspense, useEffect, useMemo, type ReactElement } from 'react'
import { createTimeSeriesChartOptions } from '~/components/ECharts/timeSeriesChartOptions'
import { materializeZeroFilledDataset, type TimestampDataset } from '~/components/ECharts/timeSeriesDataset'
import type { IMultiSeriesChart2Props, IPieChartProps } from '~/components/ECharts/types'
import {
	buildProtocolV1ChartConfigs,
	formatProtocolV1TvlsByChain,
	useFetchProtocolV1AddlChartsData
} from '~/containers/ProtocolOverview/protocolV1AddlChartsData'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { BORROWED_CHART_OPTIONS, BORROWED_CHART_TYPES } from '../../borrowedChartConstants'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { AriakitSelect } from '../AriakitSelect'
import { AriakitVirtualizedSelect, type VirtualizedSelectOption } from '../AriakitVirtualizedSelect'

const MultiSeriesChart2 = lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const EMPTY_DATASET: TimestampDataset = {
	source: [],
	dimensions: ['timestamp']
}
const EMPTY_STACKS: string[] = []
const EMPTY_PIE_DATA: Array<{ name: string; value: number }> = []
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
	protocolOptions: VirtualizedSelectOption[]
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
	const { protocols } = useProDashboardCatalog()

	const filteredProtocolOptions = useMemo(() => {
		const parentIds = new Set(protocols.filter((p: any) => p.parentProtocol).map((p: any) => p.parentProtocol))
		const parentIdToSlug = new Map(protocols.filter((p: any) => parentIds.has(p.id)).map((p: any) => [p.id, p.slug]))
		const parentSlugs = new Set(parentIdToSlug.values())
		return protocolOptions
			.filter((opt: any) => !parentSlugs.has(opt.value))
			.map((opt: any) => ({ ...opt, isChild: false }))
	}, [protocolOptions, protocols])

	const {
		data: addlData,
		historicalChainTvls,
		isLoading: isAddlLoading
	} = useFetchProtocolV1AddlChartsData(selectedBorrowedProtocolName || '', true)

	const { dataset: chainsDataset, chainsUnique } = useMemo(() => {
		if (!historicalChainTvls) return { dataset: EMPTY_DATASET, chainsUnique: EMPTY_STACKS }
		return formatProtocolV1TvlsByChain({
			historicalChainTvls,
			extraTvlsEnabled: {}
		})
	}, [historicalChainTvls])

	const { tokensUnique, rawTokensUnique, tokenBreakdownUSDDataset, tokenBreakdownPieChart, tokenBreakdownDataset } =
		addlData ?? {}
	const resolvedTokensUnique = tokensUnique ?? EMPTY_STACKS
	const resolvedRawTokensUnique = rawTokensUnique ?? resolvedTokensUnique
	const resolvedTokenBreakdownUSDDataset = tokenBreakdownUSDDataset ?? EMPTY_DATASET
	const resolvedTokenBreakdownPieChart = tokenBreakdownPieChart ?? EMPTY_PIE_DATA
	const resolvedTokenBreakdownDataset = tokenBreakdownDataset ?? EMPTY_DATASET
	const chainCharts = useMemo(
		() =>
			buildProtocolV1ChartConfigs({
				seriesNames: chainsUnique,
				type: 'line',
				hideAreaStyle: true
			}),
		[chainsUnique]
	)
	const selectedTokenNames =
		selectedBorrowedChartType === 'tokenBorrowedRaw' ? resolvedRawTokensUnique : resolvedTokensUnique
	const tokenCharts = useMemo(
		() =>
			buildProtocolV1ChartConfigs({
				seriesNames: selectedTokenNames,
				type: 'line',
				hideAreaStyle: true
			}),
		[selectedTokenNames]
	)

	const availableChartTypes = useMemo(() => {
		const available = new Set<string>()

		if (chainsDataset.source.length > 0 && chainsUnique.length > 1) {
			available.add('chainsBorrowed')
		}
		if (resolvedTokenBreakdownUSDDataset.source.length > 1 && resolvedTokensUnique.length > 0) {
			available.add('tokenBorrowedUsd')
		}
		if (resolvedTokenBreakdownPieChart.length > 0) {
			available.add('tokensBorrowedPie')
		}
		if (resolvedTokenBreakdownDataset.source.length > 1 && resolvedRawTokensUnique.length > 0) {
			available.add('tokenBorrowedRaw')
		}

		return available
	}, [
		chainsDataset,
		chainsUnique,
		resolvedTokenBreakdownUSDDataset,
		resolvedTokenBreakdownPieChart,
		resolvedTokenBreakdownDataset,
		resolvedRawTokensUnique,
		resolvedTokensUnique
	])

	const chartTypeOptions = useMemo(() => {
		return BORROWED_CHART_TYPES.map((type) => ({
			...type,
			disabled: !availableChartTypes.has(type.value)
		}))
	}, [availableChartTypes])

	const handleProtocolChange = (option: VirtualizedSelectOption) => {
		onSelectedBorrowedProtocolChange(option.value)
		onSelectedBorrowedProtocolNameChange(option.label)
		onSelectedBorrowedChartTypeChange('chainsBorrowed')
	}

	const hasProtocolSelection = selectedBorrowedProtocol && selectedBorrowedProtocolName

	useEffect(() => {
		if (!hasProtocolSelection) return

		if (availableChartTypes.size === 0) {
			if (selectedBorrowedChartType !== '') {
				onSelectedBorrowedChartTypeChange('')
			}
			return
		}

		if (!availableChartTypes.has(selectedBorrowedChartType)) {
			const nextChartType = BORROWED_CHART_TYPES.find((type) => availableChartTypes.has(type.value))?.value
			if (nextChartType && nextChartType !== selectedBorrowedChartType) {
				onSelectedBorrowedChartTypeChange(nextChartType)
			}
		}
	}, [hasProtocolSelection, availableChartTypes, selectedBorrowedChartType, onSelectedBorrowedChartTypeChange])

	const chartTypeLabel = BORROWED_CHART_TYPES.find((t) => t.value === selectedBorrowedChartType)?.label || ''
	const visibleDataset = useMemo(() => {
		switch (selectedBorrowedChartType) {
			case 'chainsBorrowed':
				return materializeZeroFilledDataset(chainsDataset, chainsUnique)
			case 'tokenBorrowedUsd':
				return materializeZeroFilledDataset(resolvedTokenBreakdownUSDDataset, resolvedTokensUnique)
			case 'tokenBorrowedRaw':
				return materializeZeroFilledDataset(resolvedTokenBreakdownDataset, resolvedRawTokensUnique)
			default:
				return EMPTY_DATASET
		}
	}, [
		selectedBorrowedChartType,
		chainsDataset,
		chainsUnique,
		resolvedTokenBreakdownUSDDataset,
		resolvedTokenBreakdownDataset,
		resolvedRawTokensUnique,
		resolvedTokensUnique
	])
	const previewTitle = chartTypeLabel
		? `${selectedBorrowedProtocolName} - ${chartTypeLabel}`
		: selectedBorrowedProtocolName || ''

	let chartContent: ReactElement | null = null
	if (isAddlLoading) {
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
						<MultiSeriesChart2
							title=""
							dataset={visibleDataset}
							charts={chainCharts}
							valueSymbol="$"
							hideDefaultLegend
							chartOptions={DOLLAR_CHART_OPTIONS}
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
						<MultiSeriesChart2
							title=""
							dataset={visibleDataset}
							charts={tokenCharts}
							valueSymbol="$"
							hideDefaultLegend
							chartOptions={DOLLAR_CHART_OPTIONS}
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
						<PieChart chartData={resolvedTokenBreakdownPieChart} />
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
						<MultiSeriesChart2
							title=""
							dataset={visibleDataset}
							charts={tokenCharts}
							valueSymbol=""
							hideDefaultLegend
							chartOptions={UNITLESS_CHART_OPTIONS}
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
					options={filteredProtocolOptions}
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

				{hasProtocolSelection && isAddlLoading ? (
					<p className="text-xs text-pro-text-tertiary">Loading available chart types...</p>
				) : null}

				{hasProtocolSelection && !isAddlLoading && availableChartTypes.size > 0 ? (
					<div className="text-xs text-pro-text-tertiary">
						<p>
							Available charts: <span className="font-semibold text-pro-text-primary">{availableChartTypes.size}</span>
						</p>
					</div>
				) : null}

				{hasProtocolSelection && !isAddlLoading && availableChartTypes.size === 0 ? (
					<p className="text-xs text-pro-text-tertiary">No borrowed data available for this protocol.</p>
				) : null}
			</div>

			<div className="overflow-hidden rounded-lg border pro-border">
				<h4 className="border-b border-pro-cards-border px-3 py-2 text-xs font-medium text-pro-text-secondary">
					Preview
				</h4>

				{hasProtocolSelection ? (
					<div className="bg-pro-cards-bg p-3">
						<div className="mb-3">
							<h3 className="mb-1 text-sm font-semibold text-pro-text-primary">{previewTitle}</h3>
							<p className="text-xs text-pro-text-secondary">Borrowed Chart</p>
						</div>

						{availableChartTypes.size === 0 && !isAddlLoading ? (
							<div className="flex h-[320px] items-center justify-center text-center text-pro-text-tertiary">
								No borrowed data available.
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
