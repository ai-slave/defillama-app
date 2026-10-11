import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useId, useMemo, type ComponentProps } from 'react'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { fetchChainsCategories } from '~/containers/Chains/api'
import type { CustomTimePeriod, TimePeriod } from '~/containers/ProDashboard/dashboardTypes'
import { filterDataByTimePeriod } from '~/containers/ProDashboard/queries'
import { PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS } from '~/containers/ProDashboard/utils/breakdownMetrics'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { OptionTile } from '~/ui/OptionTile'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Skeleton } from '~/ui/Skeleton'
import { EmptyState, InlineStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { VirtualizedMultiSelect, VirtualizedSelect, type VirtualizedSelectOption } from '~/ui/VirtualizedSelect'
import { formatUsd } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { useAppMetadata } from '../../AppMetadataContext'
import { chartBuilderHasExactRemainder } from '../../chartBuilderCapabilities'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import {
	fetchProtocolBreakdownData,
	fetchProtocolChainBreakdownData,
	type ProtocolBreakdownMetric
} from '../../services/ProtocolChartBuilderData'
import { buildProTreemapData } from '../../utils/treemap'
import { buildChartBuilderSeriesView, isChartBuilderSnapshotMetric } from '../chartBuilderSeries'
import { createChartBuilderTooltipFormatter } from '../chartBuilderTooltip'
import { BoundParameterChip, useModalFieldBinding } from './bindingContext'
import { ADD_CARD_PANES, type AddCardPane } from './panes'
import type { ChartBuilderConfig, ChartBuilderUpdate } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const BuilderTreemapChart = lazy(() => import('~/components/ECharts/TreemapChart/Builder'))

const EMPTY_CATEGORIES: Array<string> = []
const EMPTY_SELECT_OPTIONS: Array<{ value: string; label: string }> = []

const DEFAULT_SERIES_COLOR = '#3e61cc'
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}){1,2}$/i

const getProtocolBreakdownMetric = (metric: ChartBuilderConfig['metric']): ProtocolBreakdownMetric => {
	switch (metric) {
		case 'stablecoins':
		case 'chain-fees':
		case 'chain-revenue':
			throw new Error(`Metric does not have a protocol breakdown: ${metric}`)
		default:
			return metric
	}
}

interface ChartBuilderTabProps {
	/** What Add still needs (a metric), shown under the metric once Add was pressed. */
	error: string | null
	chartBuilder: ChartBuilderConfig
	chartBuilderName: string
	chainOptions: Array<VirtualizedSelectOption>
	protocolOptions: Array<{ value: string; label: string; logo?: string }>
	protocolsLoading: boolean
	onChartBuilderChange: (updates: ChartBuilderUpdate) => void
	onChartBuilderNameChange: (name: string) => void
	timePeriod: TimePeriod
	customTimePeriod?: CustomTimePeriod | null
	/** Below lg the form shows one pane; AddChartModal holds it, so a failed Add can bring back the pane with the error. */
	pane: AddCardPane
	onPaneChange: (pane: AddCardPane) => void
}

const METRIC_OPTIONS: Array<{ value: ChartBuilderConfig['metric']; label: string }> = [
	{ value: 'tvl', label: 'TVL' },
	{ value: 'fees', label: 'Fees' },
	{ value: 'revenue', label: 'Revenue' },
	{ value: 'volume', label: 'DEX Volume' },
	{ value: 'protocol-revenue', label: 'Protocol Revenue' },
	{ value: 'supply-side-revenue', label: 'Supply Side Revenue' },
	{ value: 'holders-revenue', label: 'Holders Revenue' },
	{ value: 'user-fees', label: 'User Fees' },
	{ value: 'perps', label: 'Perps Volume' },
	{ value: 'open-interest', label: 'Open Interest' },
	{ value: 'dex-aggregators', label: 'DEX Aggregator Volume' },
	{ value: 'options-notional', label: 'Options Notional' },
	{ value: 'options-premium', label: 'Options Premium' },
	{ value: 'bridge-aggregators', label: 'Bridge Aggregator Volume' },
	{ value: 'perps-aggregators', label: 'Perps Aggregator Volume' },
	{ value: 'stablecoins', label: 'Stablecoins market cap (chains only)' },
	{ value: 'chain-fees', label: 'Chain Fees (chains only)' },
	{ value: 'chain-revenue', label: 'Chain Revenue (chains only)' }
]

const CHART_TYPE_OPTIONS: Array<{
	value: ChartBuilderConfig['chartType']
	label: string
	icon: ComponentProps<typeof Icon>['name']
}> = [
	{ value: 'stackedBar', label: 'Bar', icon: 'bar-chart-2' },
	{ value: 'stackedArea', label: 'Area', icon: 'trending-up' },
	{ value: 'line', label: 'Line', icon: 'activity' },
	{ value: 'treemap', label: 'Tree map', icon: 'layout-grid' }
]

const DISPLAY_OPTIONS: Array<{ value: ChartBuilderConfig['displayAs']; label: string }> = [
	{ value: 'timeSeries', label: 'Time series' },
	{ value: 'percentage', label: 'Percentage' }
]

const TREEMAP_VALUE_OPTIONS = [
	{ value: 'latest', label: 'Last day (1d)' },
	{ value: 'sum7d', label: 'Sum 7d' },
	{ value: 'sum30d', label: 'Sum 30d' }
]

const LIMIT_OPTIONS = [
	{ value: '5', label: 'Top 5' },
	{ value: '10', label: 'Top 10' },
	{ value: '20', label: 'Top 20' }
]

const MODE_OPTIONS: Array<{ value: ChartBuilderConfig['mode']; label: string }> = [
	{ value: 'chains', label: 'Group by protocol' }, // group by protocol filter by chains
	{ value: 'protocol', label: 'Group by chains' } // group by chains filter by protocol
]

const FILTER_MODE_OPTIONS: Array<{ value: 'include' | 'exclude'; label: string }> = [
	{ value: 'include', label: 'Include' },
	{ value: 'exclude', label: 'Exclude' }
]

function FilterModeToggle({
	value,
	onChange
}: {
	value: 'include' | 'exclude'
	onChange: (mode: 'include' | 'exclude') => void
}) {
	return (
		<SegmentedControl
			label="Match mode"
			value={value}
			onValueChange={onChange}
			options={FILTER_MODE_OPTIONS}
			variant="default"
			size="sm"
		/>
	)
}

export function ChartBuilderTab({
	error,
	chartBuilder,
	chartBuilderName,
	chainOptions,
	protocolOptions,
	protocolsLoading,
	onChartBuilderChange,
	onChartBuilderNameChange,
	timePeriod,
	customTimePeriod,
	pane,
	onPaneChange
}: ChartBuilderTabProps) {
	const nameId = useId()
	const { loading: metaLoading, error: metaError, hasProtocolBuilderMetric } = useAppMetadata()
	const { getProtocolInfo, protocols } = useProDashboardCatalog()

	const { data: chainCategoriesList } = useQuery({
		queryKey: ['pro-dashboard', 'chain-categories'],
		queryFn: async () => {
			const data = await fetchChainsCategories()
			return data.categories
		},
		staleTime: 60 * 60 * 1000
	})

	const categoryOptions = useMemo(() => {
		if (!protocols) return EMPTY_SELECT_OPTIONS
		const categoriesSet = new Set<string>()
		for (const protocol of protocols) {
			if (protocol.category) {
				categoriesSet.add(protocol.category)
			}
		}
		return Array.from(categoriesSet)
			.sort()
			.map((cat) => ({
				value: cat,
				label: cat
			}))
	}, [protocols])

	const chainCategoryOptions = useMemo(
		() => (chainCategoriesList ?? EMPTY_CATEGORIES).map((c) => ({ value: c, label: c })),
		[chainCategoriesList]
	)

	const metricOptions = useMemo(() => {
		return METRIC_OPTIONS.filter(
			(option) =>
				!PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(option.value) ||
				chartBuilder.mode === 'protocol' ||
				option.value === chartBuilder.metric
		)
	}, [chartBuilder.mode, chartBuilder.metric])

	const isChainsMode = chartBuilder.mode === 'chains'
	const chainFilterMode = chartBuilder.chainFilterMode
	const categoryFilterMode = chartBuilder.categoryFilterMode
	const chainCategoryFilterMode = chartBuilder.chainCategoryFilterMode
	const protocolCategoryFilterMode = chartBuilder.protocolCategoryFilterMode

	const preview = useQuery({
		queryKey: [
			'pro-dashboard',
			'chartBuilder',
			chartBuilder.mode,
			chartBuilder.metric,
			chartBuilder.protocol,
			chartBuilder.chains,
			chartBuilder.limit,
			chartBuilder.categories,
			chartBuilder.chainCategories,
			chartBuilder.protocolCategories,
			chartBuilder.groupByParent,
			chainFilterMode,
			categoryFilterMode,
			chainCategoryFilterMode,
			protocolCategoryFilterMode,
			timePeriod,
			customTimePeriod
		],
		queryFn: async () => {
			if (chartBuilder.mode === 'protocol') {
				const data = await fetchProtocolChainBreakdownData({
					protocol: chartBuilder.protocol,
					metric: chartBuilder.metric,
					chains: chartBuilder.chains.length > 0 ? chartBuilder.chains : undefined,
					limit: chartBuilder.limit,
					chainFilterMode,
					chainCategories: chartBuilder.chainCategories,
					protocolCategories: chartBuilder.protocolCategories,
					chainCategoryFilterMode,
					protocolCategoryFilterMode
				})

				return data?.series.length
					? {
							...data,
							series: data.series.map((serie) => ({
								...serie,
								data: filterDataByTimePeriod(serie.data, timePeriod, customTimePeriod)
							}))
						}
					: data
			}

			if (PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(chartBuilder.metric)) {
				const entityMetadata = chartBuilder.groupByParent
					? ({ entityType: 'protocol-family', totalProtocolFamilies: 0 } as const)
					: ({ entityType: 'protocol', totalProtocols: 0 } as const)
				return {
					series: [],
					metadata: {
						chain: chartBuilder.chains.join(','),
						chains: chartBuilder.chains,
						categories: chartBuilder.categories,
						metric: chartBuilder.metric,
						topN: chartBuilder.limit,
						...entityMetadata,
						othersCount: 0,
						marketSector: chartBuilder.categories.join(',') || null
					}
				}
			}

			const data = await fetchProtocolBreakdownData({
				metric: getProtocolBreakdownMetric(chartBuilder.metric),
				chains: chartBuilder.chains,
				limit: chartBuilder.limit,
				categories: chartBuilder.categories,
				groupByParent: chartBuilder.groupByParent,
				chainFilterMode,
				categoryFilterMode
			})

			return data?.series.length
				? {
						...data,
						series: data.series.map((serie) => ({
							...serie,
							data: filterDataByTimePeriod(serie.data, timePeriod, customTimePeriod)
						}))
					}
				: data
		},
		enabled: !!chartBuilder.metric,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})
	const previewData = preview.data
	const previewLoading = preview.isLoading

	const seriesColors = chartBuilder.seriesColors
	let hasCustomSeriesColors = false
	if (seriesColors) {
		for (const _ in seriesColors) {
			hasCustomSeriesColors = true
			break
		}
	}
	const hasExactRemainder = chartBuilderHasExactRemainder(chartBuilder)
	const displayAs = hasExactRemainder ? chartBuilder.displayAs : 'timeSeries'

	const visibleSeries = useMemo(() => {
		if (!previewData?.series) {
			return []
		}

		const hasChainCategoryFilter = (chartBuilder.chainCategories?.length ?? 0) > 0
		const hasProtocolCategoryFilter = (chartBuilder.protocolCategories?.length ?? 0) > 0
		const forceHideOthers = chartBuilder.mode === 'protocol' && (hasChainCategoryFilter || hasProtocolCategoryFilter)

		return chartBuilder.hideOthers || forceHideOthers
			? previewData.series.filter((s) => !s.name.startsWith('Others'))
			: previewData.series
	}, [
		previewData,
		chartBuilder.hideOthers,
		chartBuilder.mode,
		chartBuilder.chainCategories,
		chartBuilder.protocolCategories
	])

	const resolveSeriesColor = useCallback(
		(seriesName: string, fallback?: string) => {
			const override = seriesColors?.[seriesName]
			if (override) {
				return override
			}
			if (fallback && HEX_COLOR_REGEX.test(fallback)) {
				return fallback
			}
			return DEFAULT_SERIES_COLOR
		},
		[seriesColors]
	)

	const isProtocolUnsupportedMetric = chartBuilder.metric
		? PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(chartBuilder.metric)
		: false
	const isSnapshotMetric = isChartBuilderSnapshotMetric(chartBuilder.metric)
	const treemapValue = chartBuilder.treemapValue || 'latest'
	const treemapMode = !isSnapshotMetric ? treemapValue : 'latest'

	const treemapData = useMemo(() => {
		if (chartBuilder.chartType !== 'treemap') return []
		return buildProTreemapData(visibleSeries, treemapMode, resolveSeriesColor)
	}, [visibleSeries, resolveSeriesColor, treemapMode, chartBuilder.chartType])

	const previewChart = useMemo(
		() =>
			buildChartBuilderSeriesView({
				series: chartBuilder.chartType === 'treemap' ? [] : visibleSeries,
				useLastValue: isSnapshotMetric,
				displayAs,
				chartType: chartBuilder.chartType === 'treemap' ? 'line' : chartBuilder.chartType,
				resolveColor: resolveSeriesColor
			}),
		[visibleSeries, isSnapshotMetric, chartBuilder.chartType, displayAs, resolveSeriesColor]
	)

	const previewChartOptions = useMemo<MultiSeriesChartOptions>(
		() => ({
			grid: chartGrid({ top: CHART_LEGEND_RESERVE }),
			legend: {
				show: true,
				top: CHART_INSET,
				type: 'scroll',
				selectedMode: 'multiple',
				pageButtonItemGap: 5,
				pageButtonGap: 20,
				data: previewChart.seriesNames
			},
			tooltip: {
				formatter: createChartBuilderTooltipFormatter({
					displayAs,
					useTwoColumns: chartBuilder.limit > 10
				})
			},
			yAxis:
				displayAs === 'percentage'
					? {
							max: 100,
							min: 0,
							axisLabel: {
								formatter: '{value}%'
							}
						}
					: {
							type: 'value',
							axisLabel: {
								formatter: (value: number) =>
									formatUsd(value, { compact: true, maximumFractionDigits: Math.abs(value) >= 1e3 ? 1 : 0 })
							}
						}
		}),
		[chartBuilder.limit, displayAs, previewChart.seriesNames]
	)

	const protocolOptionsFiltered = useMemo(() => {
		if (chartBuilder.mode !== 'protocol') return protocolOptions
		const metric = chartBuilder.metric
		if (!metric || metaLoading || metaError) return protocolOptions
		return protocolOptions.filter((opt) => hasProtocolBuilderMetric(opt.value, metric))
	}, [protocolOptions, chartBuilder.mode, chartBuilder.metric, hasProtocolBuilderMetric, metaLoading, metaError])

	const chainParameter = useModalFieldBinding('chains', 'chain')
	const protocolParameter = useModalFieldBinding('protocol', 'protocol')
	const handleMetricChange = (option: VirtualizedSelectOption) => {
		const newMetric = METRIC_OPTIONS.find((metricOption) => metricOption.value === option.value)?.value
		if (!newMetric) throw new Error(`Unsupported chart builder metric: ${option.value}`)
		let newChartType: 'stackedBar' | 'stackedArea' | 'line' = 'stackedBar'
		if (newMetric === 'tvl' || newMetric === 'stablecoins') {
			newChartType = 'stackedArea'
		}
		const updates: ChartBuilderUpdate = {
			metric: newMetric,
			chartType: newChartType
		}
		if (PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(newMetric)) {
			updates.protocol = undefined
			protocolParameter.unbind()
		}
		if (newMetric === 'tvl' || PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(newMetric)) {
			updates.protocolCategories = undefined
		}
		onChartBuilderChange(updates)
	}

	const selectableChainFilterOptions = useMemo(
		() => (chainParameter.options.length > 0 ? [...chainParameter.options, ...chainOptions] : chainOptions),
		[chainParameter.options, chainOptions]
	)

	const handleChainsChange = (chains: Array<string>) => {
		for (const chain of chains) {
			const variable = chainParameter.resolveSelection(chain)
			if (variable) {
				onChartBuilderChange({ chains: [variable.value] })
				chainParameter.bind(variable.id)
				return
			}
		}
		chainParameter.unbind()
		onChartBuilderChange({ chains })
	}

	const handleTreemapValueChange = (option: VirtualizedSelectOption) => {
		const nextValue = option.value
		if (nextValue === 'sum7d' || nextValue === 'sum30d' || nextValue === 'latest') {
			onChartBuilderChange({ treemapValue: nextValue })
			return
		}
		onChartBuilderChange({ treemapValue: 'latest' })
	}

	const handleModeChange = (mode: 'chains' | 'protocol') => {
		chainParameter.unbind()
		protocolParameter.unbind()
		const updates: ChartBuilderUpdate = {
			mode,
			chains: [],
			protocol: undefined
		}
		if (mode === 'chains' && chartBuilder.metric && PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(chartBuilder.metric)) {
			updates.metric = 'tvl'
			updates.chartType = 'stackedArea'
		}
		onChartBuilderChange(updates)
	}

	const handleSeriesColorChange = (seriesName: string, color: string) => {
		onChartBuilderChange({
			seriesColors: {
				...chartBuilder.seriesColors,
				[seriesName]: color
			}
		})
	}

	const handleSeriesColorReset = (seriesName: string) => {
		const next = { ...chartBuilder.seriesColors }
		delete next[seriesName]
		onChartBuilderChange({ seriesColors: next })
	}

	const selectableProtocolOptions =
		protocolParameter.options.length > 0
			? [...protocolParameter.options, ...protocolOptionsFiltered]
			: protocolOptionsFiltered

	const handleProtocolChange = (option: { value: string }) => {
		const variable = protocolParameter.resolveSelection(option.value)
		if (variable) {
			onChartBuilderChange({ protocol: variable.value, protocolCategories: undefined })
			protocolParameter.bind(variable.id)
			return
		}
		protocolParameter.unbind()
		const updates: ChartBuilderUpdate = { protocol: option.value || undefined }
		if (option.value) {
			updates.protocolCategories = undefined
		}
		onChartBuilderChange(updates)
	}

	return (
		<div className="flex h-full flex-col">
			<SegmentedControl<AddCardPane>
				label="Editor view"
				options={ADD_CARD_PANES}
				value={pane}
				onValueChange={onPaneChange}
				variant="solid-responsive"
				size="md"
				className="mb-3 shrink-0 lg:hidden"
			/>

			<div className={`mb-1 lg:block ${pane === 'configure' ? 'block' : 'hidden'}`}>
				<label htmlFor={nameId} className="mb-1 block label-sm text-secondary">
					Card name (optional)
				</label>
				<Input
					id={nameId}
					type="text"
					value={chartBuilderName}
					onChange={(e) => onChartBuilderNameChange(e.target.value)}
					className="w-full"
				/>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
				<Card
					padding="sm"
					className={`w-full space-y-1.5 overflow-y-auto max-lg:min-h-0 max-lg:flex-1 lg:block lg:max-h-[calc(100vh-200px)] lg:w-[320px] lg:shrink-0 xl:w-[360px] ${pane === 'configure' ? 'block' : 'hidden'}`}
				>
					<h3 className="title-sm text-primary">Chart configuration</h3>

					<div>
						<VirtualizedSelect
							variant="field"
							label="Metric"
							error={error}
							options={metricOptions}
							selectedValue={chartBuilder.metric}
							onChange={handleMetricChange}
							placeholder="Select metric…"
						/>
					</div>

					<div className="border-t border-subtle pt-1.5">
						<h4 className="mb-1 label-sm text-secondary">Mode</h4>
						<SegmentedControl
							label="Grouping mode"
							options={MODE_OPTIONS}
							value={chartBuilder.mode}
							onValueChange={handleModeChange}
							variant="field"
							size="md"
							className="mb-1.5"
						/>
					</div>

					<div className="border-t border-subtle pt-1.5">
						<h4 className="mb-1 label-sm text-secondary">Filters</h4>

						{isChainsMode ? null : isProtocolUnsupportedMetric ? (
							<div className="mb-1.5 rounded-md border border-medium px-2 py-1.5">
								<p className="body-sm text-tertiary">This metric is available only for all protocols.</p>
							</div>
						) : (
							<div className="mb-1.5 flex flex-col gap-1.5">
								<VirtualizedSelect
									variant="field"
									label="Protocol"
									options={selectableProtocolOptions}
									selectedValue={chartBuilder.protocol || null}
									onChange={handleProtocolChange}
									placeholder="Select protocol…"
									isLoading={protocolsLoading}
								/>
								{protocolParameter.boundVariable ? (
									<BoundParameterChip
										label={protocolParameter.boundVariable.label}
										onUnbind={protocolParameter.unbind}
									/>
								) : null}
							</div>
						)}

						<div className="mb-1.5 flex flex-col gap-1.5">
							<VirtualizedMultiSelect
								label="Chains filter"
								labelAction={
									<FilterModeToggle
										value={chainFilterMode}
										onChange={(mode) => onChartBuilderChange({ chainFilterMode: mode })}
									/>
								}
								options={selectableChainFilterOptions}
								selectedValues={chartBuilder.chains}
								onChange={handleChainsChange}
								placeholder={chainFilterMode === 'exclude' ? 'Select chains to exclude…' : 'Select chains…'}
								isLoading={protocolsLoading || chainOptions.length === 0}
								maxSelections={10}
							/>
							{chainParameter.boundVariable ? (
								<BoundParameterChip label={chainParameter.boundVariable.label} onUnbind={chainParameter.unbind} />
							) : null}
						</div>

						{isChainsMode ? (
							<div className="mb-1.5">
								<VirtualizedMultiSelect
									label="Categories filter"
									labelAction={
										<FilterModeToggle
											value={categoryFilterMode}
											onChange={(mode) => onChartBuilderChange({ categoryFilterMode: mode })}
										/>
									}
									options={categoryOptions}
									selectedValues={chartBuilder.categories}
									onChange={(categories) => onChartBuilderChange({ categories })}
									placeholder={
										categoryFilterMode === 'exclude' ? 'Select categories to exclude…' : 'Select categories…'
									}
									maxSelections={5}
								/>
							</div>
						) : (
							<>
								{!isProtocolUnsupportedMetric && chartBuilder.metric !== 'tvl' && !chartBuilder.protocol ? (
									<div className="mb-1.5">
										<VirtualizedMultiSelect
											label="Protocol categories filter"
											labelAction={
												<FilterModeToggle
													value={protocolCategoryFilterMode}
													onChange={(mode) => onChartBuilderChange({ protocolCategoryFilterMode: mode })}
												/>
											}
											options={categoryOptions}
											selectedValues={chartBuilder.protocolCategories ?? EMPTY_CATEGORIES}
											onChange={(protocolCategories) => onChartBuilderChange({ protocolCategories })}
											placeholder={
												protocolCategoryFilterMode === 'exclude'
													? 'Select protocol categories to exclude…'
													: 'Select protocol categories…'
											}
											maxSelections={5}
										/>
									</div>
								) : null}
								<div className="mb-1.5">
									<VirtualizedMultiSelect
										label="Chain categories filter"
										labelAction={
											<FilterModeToggle
												value={chainCategoryFilterMode}
												onChange={(mode) => onChartBuilderChange({ chainCategoryFilterMode: mode })}
											/>
										}
										options={chainCategoryOptions}
										selectedValues={chartBuilder.chainCategories ?? EMPTY_CATEGORIES}
										onChange={(chainCategories) => onChartBuilderChange({ chainCategories })}
										placeholder={
											chainCategoryFilterMode === 'exclude'
												? 'Select chain categories to exclude…'
												: 'Select chain categories…'
										}
										maxSelections={5}
									/>
								</div>
							</>
						)}

						<div className="mb-1.5">
							<VirtualizedSelect
								variant="field"
								label={isChainsMode ? 'Number of protocols' : 'Number of chains'}
								options={LIMIT_OPTIONS}
								selectedValue={chartBuilder.limit.toString()}
								onChange={(option) => onChartBuilderChange({ limit: parseInt(option.value, 10) || 10 })}
								placeholder="Select limit…"
							/>
						</div>

						{!hasExactRemainder ? (
							<p className="mb-1 body-sm text-secondary">
								This source returns exact Top {chartBuilder.limit} chain series only.
							</p>
						) : isChainsMode || !chartBuilder.chainCategories || chartBuilder.chainCategories.length === 0 ? (
							<div className="mb-1">
								<Checkbox
									variant="inline-sm"
									checked={chartBuilder.hideOthers || false}
									onChange={(e) => onChartBuilderChange({ hideOthers: e.target.checked })}
								>
									Hide "Others" (show only top {chartBuilder.limit})
								</Checkbox>
							</div>
						) : null}

						{isChainsMode ? (
							<div className="mb-1">
								<Checkbox
									variant="inline-sm"
									checked={chartBuilder.groupByParent || false}
									onChange={(e) => onChartBuilderChange({ groupByParent: e.target.checked })}
								>
									Group by parent protocol
								</Checkbox>
							</div>
						) : null}
					</div>

					<div className="border-t border-subtle pt-1.5">
						<h4 className="mb-1 label-sm text-secondary">Chart type</h4>
						{/* Icon tiles, not a SegmentedControl: four icon-and-label segments overflow this 320px column. */}
						<Ariakit.RadioProvider
							value={chartBuilder.chartType}
							setValue={(next) => onChartBuilderChange({ chartType: next as ChartBuilderConfig['chartType'] })}
						>
							<Ariakit.RadioGroup aria-label="Chart type" className="grid grid-cols-4 gap-1">
								{CHART_TYPE_OPTIONS.map((option) => (
									<OptionTile key={option.value} layout="compact" radio={option.value}>
										<Icon name={option.icon} className="size-3.5" />
										<span className="label-sm">{option.label}</span>
									</OptionTile>
								))}
							</Ariakit.RadioGroup>
						</Ariakit.RadioProvider>
					</div>

					{chartBuilder.chartType === 'treemap' && !isSnapshotMetric ? (
						<div className="border-t border-subtle pt-1.5">
							<VirtualizedSelect
								variant="field"
								label="Treemap value"
								options={TREEMAP_VALUE_OPTIONS}
								selectedValue={treemapMode}
								onChange={handleTreemapValueChange}
								placeholder="Select value…"
							/>
						</div>
					) : null}

					<div className="border-t border-subtle pt-1.5">
						<h4 className="mb-1 label-sm text-secondary">Display value as</h4>
						<SegmentedControl
							label="Display value as"
							options={hasExactRemainder ? DISPLAY_OPTIONS : DISPLAY_OPTIONS.slice(0, 1)}
							value={displayAs}
							onValueChange={(display) => onChartBuilderChange({ displayAs: display })}
							variant="field"
							size="md"
						/>
					</div>
				</Card>

				<Card
					padding="base"
					className={`min-h-0 flex-1 flex-col overflow-y-auto lg:flex ${pane === 'preview' ? 'flex' : 'hidden'}`}
				>
					<div className="mb-2 flex shrink-0 items-center justify-between">
						<h3 className="title-sm text-primary">Preview</h3>
						<div className="flex items-center gap-1 body-sm text-tertiary">
							<span>ⓘ</span>
							<span>Updates as you configure</span>
						</div>
					</div>

					<Card
						padding="none"
						className="relative flex flex-1 items-center justify-center"
						style={{ minHeight: '450px' }}
					>
						{queryReadFailed(preview) ? (
							<InlineStatus variant="error" retry={preview}>
								Couldn't load the preview.
							</InlineStatus>
						) : previewLoading ? (
							<SurfaceBodyLoadingStatus label="Loading preview" />
						) : previewData && previewData.series.length > 0 ? (
							<div className="absolute inset-0 p-2">
								<Suspense fallback={<Skeleton className="size-full rounded-md" />}>
									{chartBuilder.chartType === 'treemap' ? (
										<BuilderTreemapChart data={treemapData} height="450px" />
									) : (
										<MultiSeriesChart
											height="450px"
											dataset={previewChart.dataset}
											charts={previewChart.charts}
											valueSymbol={displayAs === 'percentage' ? '%' : '$'}
											hideDataZoom
											showLegend
											solidChartAreaStyle={chartBuilder.chartType === 'stackedArea'}
											exportButtons="hidden"
											chartOptions={previewChartOptions}
										/>
									)}
								</Suspense>
							</div>
						) : previewData ? (
							<EmptyState size="md" icon="bar-chart-2" title="No data for these settings" />
						) : (
							<EmptyState size="md" icon="bar-chart-2" title="Configure chart settings to see preview">
								Select a metric to generate chart (all chains by default).
							</EmptyState>
						)}
					</Card>

					{visibleSeries.length > 0 ? (
						<div className="mt-2 flex flex-col gap-1">
							<div className="flex items-center justify-between gap-2 label-sm">
								<h4 className="text-secondary">Series colors</h4>
								<Button
									variant="link"
									onClick={() => onChartBuilderChange({ seriesColors: {} })}
									disabled={!hasCustomSeriesColors}
									accessibleWhenDisabled
								>
									Reset all
								</Button>
							</div>
							<Card padding="sm" className="flex items-center gap-2 overflow-x-auto">
								{visibleSeries.map((series) => {
									const activeColor = resolveSeriesColor(series.name, series.color)
									const hasOverride = !!seriesColors?.[series.name]
									return (
										<div
											key={series.name}
											className="flex shrink-0 items-center gap-1.5 rounded-sm border border-medium bg-surface-elevated-1 px-2 py-1 body-sm"
										>
											<span className="max-w-[140px] truncate text-secondary" title={series.name}>
												{series.name}
											</span>
											<input
												type="color"
												value={activeColor}
												onChange={(event) => handleSeriesColorChange(series.name, event.target.value)}
												className="size-5 cursor-pointer rounded-sm border border-medium bg-transparent p-0"
												aria-label={`Select color for ${series.name}`}
											/>
											<Button
												variant="link"
												onClick={() => handleSeriesColorReset(series.name)}
												disabled={!hasOverride}
												accessibleWhenDisabled
												aria-label={`Reset color for ${series.name}`}
											>
												Reset
											</Button>
										</div>
									)
								})}
							</Card>
						</div>
					) : null}

					<div className="mt-2 shrink-0 rounded-sm bg-surface-elevated-1 p-2">
						<div className="flex items-start gap-1">
							<span className="body-sm text-tertiary">ⓘ</span>
							<p className="body-sm text-tertiary">
								This chart shows {chartBuilder.metric}
								{chartBuilder.mode === 'protocol'
									? ` for ${
											chartBuilder.protocol
												? getProtocolInfo(chartBuilder.protocol)?.name || chartBuilder.protocol
												: 'all protocols'
										} across different chains`
									: ` breakdown by top ${chartBuilder.limit} protocols`}
								{chartBuilder.mode === 'chains' && chartBuilder.chains.length > 0
									? ` ${chainFilterMode === 'exclude' ? 'excluding' : 'on'} ${chartBuilder.chains.join(', ')}`
									: null}
								{chartBuilder.mode === 'protocol' && chartBuilder.chains.length > 0
									? ` ${chainFilterMode === 'exclude' ? 'excluding' : 'on'} ${chartBuilder.chains.join(', ')}`
									: null}
								{chartBuilder.mode === 'protocol' && !hasExactRemainder
									? ` using the exact Top ${chartBuilder.limit} chains`
									: null}
								{chartBuilder.mode === 'protocol' &&
								chartBuilder.chainCategories &&
								chartBuilder.chainCategories.length > 0
									? ` ${chainCategoryFilterMode === 'exclude' ? 'excluding' : 'in'} ${chartBuilder.chainCategories.join(
											', '
										)} chain categories`
									: null}
								{chartBuilder.mode === 'protocol' &&
								chartBuilder.protocolCategories &&
								chartBuilder.protocolCategories.length > 0
									? ` ${
											protocolCategoryFilterMode === 'exclude' ? 'excluding' : 'focusing on'
										} ${chartBuilder.protocolCategories.join(', ')} protocol categories`
									: null}
								{chartBuilder.mode === 'chains' && chartBuilder.categories.length > 0
									? ` ${categoryFilterMode === 'exclude' ? 'excluding' : 'in'} ${chartBuilder.categories.join(
											', '
										)} categories`
									: null}
								. Data is displayed as {displayAs === 'percentage' ? 'percentage of total' : 'absolute values'}.
							</p>
						</div>
					</div>
				</Card>
			</div>
		</div>
	)
}
