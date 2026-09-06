import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useMemo, type ComponentProps } from 'react'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { fetchChainsCategories } from '~/containers/Chains/api'
import type { CustomTimePeriod, TimePeriod } from '~/containers/ProDashboard/dashboardTypes'
import { filterDataByTimePeriod } from '~/containers/ProDashboard/queries'
import { PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS } from '~/containers/ProDashboard/utils/breakdownMetrics'
import { Icon } from '~/ui/Icon'
import { formatUsd } from '~/utils/numberFormat'
import { useAppMetadata } from '../../AppMetadataContext'
import { chartBuilderHasExactRemainder } from '../../chartBuilderCapabilities'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import {
	fetchProtocolBreakdownData,
	fetchProtocolChainBreakdownData,
	type ProtocolBreakdownMetric
} from '../../services/ProtocolChartBuilderData'
import { getItemIconUrl } from '../../utils'
import { buildProTreemapData } from '../../utils/treemap'
import { AriakitMultiSelect } from '../AriakitMultiSelect'
import { AriakitSelect, type SelectOption } from '../AriakitSelect'
import { AriakitVirtualizedMultiSelect } from '../AriakitVirtualizedMultiSelect'
import { AriakitVirtualizedSelect } from '../AriakitVirtualizedSelect'
import { buildChartBuilderSeriesView, isChartBuilderSnapshotMetric } from '../chartBuilderSeries'
import { createChartBuilderTooltipFormatter } from '../chartBuilderTooltip'
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
	chartBuilder: ChartBuilderConfig
	chartBuilderName: string
	chainOptions: Array<{ value: string; label: string }>
	protocolOptions: Array<{ value: string; label: string; logo?: string }>
	protocolsLoading: boolean
	onChartBuilderChange: (updates: ChartBuilderUpdate) => void
	onChartBuilderNameChange: (name: string) => void
	timePeriod: TimePeriod
	customTimePeriod?: CustomTimePeriod | null
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
	{ value: 'stablecoins', label: 'Stablecoin Mcap (Chains only)' },
	{ value: 'chain-fees', label: 'Chain Fees (Chains only)' },
	{ value: 'chain-revenue', label: 'Chain Revenue (Chains only)' }
]

const CHART_TYPE_OPTIONS: Array<{
	value: ChartBuilderConfig['chartType']
	label: string
	icon: ComponentProps<typeof Icon>['name']
}> = [
	{ value: 'stackedBar', label: 'Bar', icon: 'bar-chart-2' },
	{ value: 'stackedArea', label: 'Area', icon: 'trending-up' },
	{ value: 'line', label: 'Line', icon: 'activity' },
	{ value: 'treemap', label: 'Tree Map', icon: 'layout-grid' }
]

const DISPLAY_OPTIONS: Array<{ value: ChartBuilderConfig['displayAs']; label: string }> = [
	{ value: 'timeSeries', label: 'Time Series' },
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
	{ value: 'chains', label: 'Group by Protocol' }, // group by protocol filter by chains
	{ value: 'protocol', label: 'Group by Chains' } // group by chains filter by protocol
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
		<div className="rounded-lg border border-pro-cards-border p-0.5">
			<div className="grid grid-cols-2 gap-0.5">
				{FILTER_MODE_OPTIONS.map((option) => (
					<button
						type="button"
						key={option.value}
						onClick={() => onChange(option.value)}
						className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors duration-200 ${
							value === option.value
								? 'bg-pro-accent text-on-brand shadow-sm'
								: 'text-pro-text-secondary hover:bg-pro-cards-bg/80 hover:text-pro-text-primary'
						}`}
					>
						{option.label}
					</button>
				))}
			</div>
		</div>
	)
}

export function ChartBuilderTab({
	chartBuilder,
	chartBuilderName,
	chainOptions,
	protocolOptions,
	protocolsLoading,
	onChartBuilderChange,
	onChartBuilderNameChange,
	timePeriod,
	customTimePeriod
}: ChartBuilderTabProps) {
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

	const chainFilterMode = chartBuilder.chainFilterMode
	const categoryFilterMode = chartBuilder.categoryFilterMode
	const chainCategoryFilterMode = chartBuilder.chainCategoryFilterMode
	const protocolCategoryFilterMode = chartBuilder.protocolCategoryFilterMode

	const { data: previewData, isLoading: previewLoading } = useQuery({
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

	const handleMetricChange = (option: SelectOption) => {
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
		}
		if (newMetric === 'tvl' || PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(newMetric)) {
			updates.protocolCategories = undefined
		}
		onChartBuilderChange(updates)
	}

	const handleChainsChange = (chains: Array<string>) => {
		onChartBuilderChange({ chains })
	}

	const handleCategoriesChange = (categories: Array<string>) => {
		onChartBuilderChange({ categories })
	}

	const handleChainCategoriesChange = (chainCategories: Array<string>) => {
		onChartBuilderChange({ chainCategories })
	}

	const handleProtocolCategoriesChange = (protocolCategories: Array<string>) => {
		onChartBuilderChange({ protocolCategories })
	}

	const handleLimitChange = (option: SelectOption) => {
		onChartBuilderChange({ limit: parseInt(option.value, 10) || 10 })
	}

	const handleChartTypeChange = (type: ChartBuilderConfig['chartType']) => {
		onChartBuilderChange({ chartType: type })
	}

	const handleDisplayChange = (display: 'timeSeries' | 'percentage') => {
		onChartBuilderChange({ displayAs: display })
	}

	const handleTreemapValueChange = (option: SelectOption) => {
		const nextValue = option.value
		if (nextValue === 'sum7d' || nextValue === 'sum30d' || nextValue === 'latest') {
			onChartBuilderChange({ treemapValue: nextValue })
			return
		}
		onChartBuilderChange({ treemapValue: 'latest' })
	}

	const handleChainFilterModeChange = (mode: 'include' | 'exclude') => {
		onChartBuilderChange({ chainFilterMode: mode })
	}

	const handleCategoryFilterModeChange = (mode: 'include' | 'exclude') => {
		onChartBuilderChange({ categoryFilterMode: mode })
	}

	const handleChainCategoryFilterModeChange = (mode: 'include' | 'exclude') => {
		onChartBuilderChange({ chainCategoryFilterMode: mode })
	}

	const handleProtocolCategoryFilterModeChange = (mode: 'include' | 'exclude') => {
		onChartBuilderChange({ protocolCategoryFilterMode: mode })
	}

	const handleModeChange = (mode: 'chains' | 'protocol') => {
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
		const current = chartBuilder.seriesColors || {}
		if (!(seriesName in current)) {
			return
		}
		const next = { ...current }
		delete next[seriesName]
		onChartBuilderChange({ seriesColors: next })
	}

	const handleResetAllSeriesColors = () => {
		if (!hasCustomSeriesColors) {
			return
		}
		onChartBuilderChange({ seriesColors: {} })
	}

	const handleProtocolChange = (option: { value: string }) => {
		const updates: ChartBuilderUpdate = { protocol: option.value || undefined }
		if (option.value) {
			updates.protocolCategories = undefined
		}
		onChartBuilderChange(updates)
	}

	return (
		<div className="flex h-full flex-col">
			<div className="mb-1">
				<input
					type="text"
					value={chartBuilderName}
					onChange={(e) => onChartBuilderNameChange(e.target.value)}
					placeholder="Enter chart name..."
					className="w-full rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-2 py-1.5 text-sm text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden"
				/>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
				<div className="max-h-[calc(100vh-200px)] w-full shrink-0 space-y-1.5 overflow-x-visible overflow-y-auto rounded-md border border-pro-cards-border bg-pro-cards-bg p-2 lg:w-[320px] xl:w-[360px]">
					<h3 className="text-[11px] font-semibold text-pro-text-primary">Chart Configuration</h3>

					<div>
						<AriakitSelect
							label="Metric"
							options={metricOptions}
							selectedValue={chartBuilder.metric}
							onChange={handleMetricChange}
							placeholder="Select metric..."
							isLoading={false}
						/>
					</div>

					<div className="border-t pro-border pt-1.5">
						<h4 className="mb-1 text-[11px] font-medium text-pro-text-secondary">Mode</h4>
						<div className="mb-1.5 rounded-lg border border-pro-cards-border p-0.5">
							<div className="grid grid-cols-2 gap-0.5">
								{MODE_OPTIONS.map((option) => (
									<button
										type="button"
										key={option.value}
										onClick={() => handleModeChange(option.value)}
										className={`rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
											chartBuilder.mode === option.value
												? 'bg-pro-accent text-on-brand shadow-sm'
												: 'text-pro-text-secondary hover:bg-pro-cards-bg/80 hover:text-pro-text-primary'
										}`}
									>
										{option.label}
									</button>
								))}
							</div>
						</div>
					</div>

					<div className="border-t pro-border pt-1.5">
						<h4 className="mb-1 text-[11px] font-medium text-pro-text-secondary">Filters</h4>

						{chartBuilder.mode === 'chains' ? (
							<>
								<div className="mb-1.5">
									<div className="mb-1 flex items-center justify-between">
										<span className="text-[10px] font-medium text-pro-text-secondary">Chains Filter</span>
										<FilterModeToggle value={chainFilterMode} onChange={handleChainFilterModeChange} />
									</div>
									<AriakitVirtualizedMultiSelect
										label="Chains"
										options={
											chainOptions.length > 0
												? chainOptions.map((c) => ({
														value: c.value,
														label: c.label
													}))
												: []
										}
										selectedValues={chartBuilder.chains}
										onChange={handleChainsChange}
										placeholder={chainFilterMode === 'exclude' ? 'Select chains to exclude...' : 'Select chains...'}
										isLoading={protocolsLoading || chainOptions.length === 0}
										maxSelections={10}
										renderIcon={(option) =>
											option.value === 'All' ? null : getItemIconUrl('chain', null, option.value)
										}
									/>
								</div>

								<div className="mb-1.5">
									<div className="mb-1 flex items-center justify-between">
										<span className="text-[10px] font-medium text-pro-text-secondary">Categories Filter</span>
										<FilterModeToggle value={categoryFilterMode} onChange={handleCategoryFilterModeChange} />
									</div>
									<AriakitMultiSelect
										label="Categories"
										options={categoryOptions}
										selectedValues={chartBuilder.categories}
										onChange={handleCategoriesChange}
										placeholder={
											categoryFilterMode === 'exclude' ? 'Select categories to exclude...' : 'Select categories...'
										}
										isLoading={false}
										maxSelections={5}
									/>
								</div>

								<div className="mb-1.5">
									<AriakitSelect
										label="Number of Protocols"
										options={LIMIT_OPTIONS}
										selectedValue={chartBuilder.limit.toString()}
										onChange={handleLimitChange}
										placeholder="Select limit..."
										isLoading={false}
									/>
								</div>

								<div className="mb-1">
									<Ariakit.CheckboxProvider value={chartBuilder.hideOthers || false}>
										<label className="flex cursor-pointer items-center gap-1.5">
											<Ariakit.Checkbox
												onChange={(e) => onChartBuilderChange({ hideOthers: e.target.checked })}
												className="flex size-3 shrink-0 items-center justify-center rounded-[2px] border pro-border data-checked:border-pro-info-100 data-checked:bg-pro-info-400 dark:data-checked:border-pro-info-300/20 dark:data-checked:bg-pro-info-300/20"
											/>
											<span className="text-[10px] text-pro-text-secondary">
												Hide "Others" (show only top {chartBuilder.limit})
											</span>
										</label>
									</Ariakit.CheckboxProvider>
								</div>

								<div className="mb-1">
									<Ariakit.CheckboxProvider value={chartBuilder.groupByParent || false}>
										<div className="flex cursor-pointer items-center gap-1.5">
											<Ariakit.Checkbox
												onChange={(e) =>
													onChartBuilderChange({
														groupByParent: e.target.checked
													})
												}
												className="flex size-3 shrink-0 items-center justify-center rounded-[2px] border pro-border data-checked:border-pro-info-100 data-checked:bg-pro-info-400 dark:data-checked:border-pro-info-300/20 dark:data-checked:bg-pro-info-300/20"
											/>
											<span className="text-[10px] text-pro-text-secondary">Group by parent protocol</span>
										</div>
									</Ariakit.CheckboxProvider>
								</div>
							</>
						) : (
							<>
								{isProtocolUnsupportedMetric ? (
									<div className="mb-1.5 rounded-md border border-pro-cards-border px-2 py-1.5">
										<p className="text-[10px] text-pro-text-tertiary">
											This metric is available only for All Protocols.
										</p>
									</div>
								) : (
									<div className="mb-1.5">
										<AriakitVirtualizedSelect
											label="Protocol"
											options={protocolOptionsFiltered}
											selectedValue={chartBuilder.protocol || null}
											onChange={handleProtocolChange}
											placeholder="Select protocol..."
											isLoading={protocolsLoading}
											renderIcon={(option) => option.logo || getItemIconUrl('protocol', option, option.value)}
										/>
									</div>
								)}

								<div className="mb-1.5">
									<div className="mb-1 flex items-center justify-between">
										<span className="text-[10px] font-medium text-pro-text-secondary">Chains Filter</span>
										<FilterModeToggle value={chainFilterMode} onChange={handleChainFilterModeChange} />
									</div>
									<AriakitVirtualizedMultiSelect
										label="Chains"
										options={
											chainOptions.length > 0
												? chainOptions.map((c) => ({
														value: c.value,
														label: c.label
													}))
												: []
										}
										selectedValues={chartBuilder.chains}
										onChange={handleChainsChange}
										placeholder={chainFilterMode === 'exclude' ? 'Select chains to exclude...' : 'Select chains...'}
										isLoading={protocolsLoading || chainOptions.length === 0}
										maxSelections={10}
										renderIcon={(option) =>
											option.value === 'All' ? null : getItemIconUrl('chain', null, option.value)
										}
									/>
								</div>
								{!isProtocolUnsupportedMetric && chartBuilder.metric !== 'tvl' && !chartBuilder.protocol ? (
									<div className="mb-1.5">
										<div className="mb-1 flex items-center justify-between">
											<span className="text-[10px] font-medium text-pro-text-secondary">
												Protocol Categories Filter
											</span>
											<FilterModeToggle
												value={protocolCategoryFilterMode}
												onChange={handleProtocolCategoryFilterModeChange}
											/>
										</div>
										<AriakitMultiSelect
											label="Protocol Categories"
											options={categoryOptions}
											selectedValues={chartBuilder.protocolCategories ?? EMPTY_CATEGORIES}
											onChange={handleProtocolCategoriesChange}
											placeholder={
												protocolCategoryFilterMode === 'exclude'
													? 'Select protocol categories to exclude...'
													: 'Select protocol categories...'
											}
											isLoading={false}
											maxSelections={5}
										/>
									</div>
								) : null}
								<div className="mb-1.5">
									<div className="mb-1 flex items-center justify-between">
										<span className="text-[10px] font-medium text-pro-text-secondary">Chain Categories Filter</span>
										<FilterModeToggle value={chainCategoryFilterMode} onChange={handleChainCategoryFilterModeChange} />
									</div>
									<AriakitMultiSelect
										label="Chain Categories"
										options={chainCategoryOptions}
										selectedValues={chartBuilder.chainCategories ?? EMPTY_CATEGORIES}
										onChange={handleChainCategoriesChange}
										placeholder={
											chainCategoryFilterMode === 'exclude'
												? 'Select chain categories to exclude...'
												: 'Select chain categories...'
										}
										isLoading={false}
										maxSelections={5}
									/>
								</div>
								<div className="mb-1.5">
									<AriakitSelect
										label="Number of Chains"
										options={LIMIT_OPTIONS}
										selectedValue={chartBuilder.limit.toString()}
										onChange={handleLimitChange}
										placeholder="Select limit..."
										isLoading={false}
									/>
								</div>
								{!hasExactRemainder ? (
									<p className="mb-1 text-[10px] text-pro-text-secondary">
										This source returns exact Top {chartBuilder.limit} chain series only.
									</p>
								) : !chartBuilder.chainCategories || chartBuilder.chainCategories.length === 0 ? (
									<div className="mb-1">
										<Ariakit.CheckboxProvider value={chartBuilder.hideOthers || false}>
											<label className="flex cursor-pointer items-center gap-1.5">
												<Ariakit.Checkbox
													onChange={(e) =>
														onChartBuilderChange({
															hideOthers: e.target.checked
														})
													}
													className="flex size-3 shrink-0 items-center justify-center rounded-xs border border-[#28a2b5] data-checked:bg-[#28a2b5]"
												/>
												<span className="text-[10px] text-pro-text-secondary">
													Hide "Others" (show only top {chartBuilder.limit})
												</span>
											</label>
										</Ariakit.CheckboxProvider>
									</div>
								) : null}
							</>
						)}
					</div>

					<div className="border-t pro-border pt-1.5">
						<h4 className="mb-1 text-[11px] font-medium text-pro-text-secondary">Chart type</h4>
						<div className="grid grid-cols-4 gap-1">
							{CHART_TYPE_OPTIONS.map((option) => (
								<button
									type="button"
									key={option.value}
									onClick={() => handleChartTypeChange(option.value)}
									className={`flex flex-col items-center gap-0.5 rounded-md border p-1 transition-colors ${
										chartBuilder.chartType === option.value
											? 'border-pro-info-100 bg-pro-info-300/20 text-pro-info-400 dark:border-pro-info-300/20 dark:bg-pro-info-300/20 dark:text-pro-info-200'
											: 'pro-border pro-hover-bg text-pro-text-secondary hover:text-pro-text-primary'
									}`}
								>
									<Icon name={option.icon} height={14} width={14} />
									<span className="text-[10px]">{option.label}</span>
								</button>
							))}
						</div>
					</div>

					{chartBuilder.chartType === 'treemap' && !isSnapshotMetric ? (
						<div className="border-t pro-border pt-1.5">
							<AriakitSelect
								label="Treemap value"
								options={TREEMAP_VALUE_OPTIONS}
								selectedValue={treemapMode}
								onChange={handleTreemapValueChange}
								placeholder="Select value..."
								isLoading={false}
							/>
						</div>
					) : null}

					<div className="border-t pro-border pt-1.5">
						<h4 className="mb-1 text-[11px] font-medium text-pro-text-secondary">Display value as</h4>
						<div className="rounded-lg border border-pro-cards-border p-0.5">
							<div className="grid grid-cols-2 gap-0.5">
								{DISPLAY_OPTIONS.map((option) =>
									!hasExactRemainder && option.value === 'percentage' ? null : (
										<button
											type="button"
											key={option.value}
											onClick={() => handleDisplayChange(option.value)}
											className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-200 ${
												displayAs === option.value
													? 'bg-pro-accent text-on-brand shadow-sm'
													: 'text-pro-text-secondary hover:bg-pro-cards-bg/80 hover:text-pro-text-primary'
											}`}
										>
											{option.label}
										</button>
									)
								)}
							</div>
						</div>
					</div>
				</div>

				<div className="flex min-h-0 flex-1 flex-col rounded-md border border-pro-cards-border bg-pro-cards-bg p-3">
					<div className="mb-2 flex shrink-0 items-center justify-between">
						<h3 className="text-xs font-semibold text-pro-text-primary">Preview</h3>
						<div className="flex items-center gap-1 text-[10px] text-pro-text-tertiary">
							<span>ⓘ</span>
							<span>Updates as you configure</span>
						</div>
					</div>

					<div
						className="relative flex flex-1 items-center justify-center rounded-md border border-pro-cards-border bg-pro-cards-bg"
						style={{ minHeight: '450px' }}
					>
						{previewLoading ? (
							<div className="text-center">
								<div className="mx-auto mb-2 size-8 animate-spin rounded-full border-b-2 border-pro-info-100 dark:border-pro-info-300/20" />
								<p className="text-sm text-pro-text-secondary">Loading preview...</p>
							</div>
						) : previewData && previewData.series.length > 0 ? (
							<div className="absolute inset-0 p-2">
								<Suspense
									fallback={
										<div className="size-full animate-pulse rounded-md border border-pro-cards-border bg-pro-cards-bg" />
									}
								>
									{chartBuilder.chartType === 'treemap' ? (
										<BuilderTreemapChart data={treemapData} height="450px" />
									) : (
										<MultiSeriesChart
											height="450px"
											dataset={previewChart.dataset}
											charts={previewChart.charts}
											valueSymbol={displayAs === 'percentage' ? '%' : '$'}
											hideDataZoom
											hideDefaultLegend={false}
											solidChartAreaStyle={chartBuilder.chartType === 'stackedArea'}
											exportButtons="hidden"
											chartOptions={previewChartOptions}
										/>
									)}
								</Suspense>
							</div>
						) : (
							<div className="text-center">
								<Icon name="bar-chart-2" height={48} width={48} className="mx-auto mb-2 text-pro-text-tertiary" />
								<p className="text-sm text-pro-text-secondary">Configure chart settings to see preview</p>
								<p className="mt-1 text-xs text-pro-text-tertiary">
									Select a metric to generate chart (all chains by default)
								</p>
							</div>
						)}
					</div>

					{visibleSeries.length > 0 ? (
						<div className="mt-2 flex flex-col gap-1">
							<div className="flex items-center justify-between gap-2">
								<h4 className="text-[11px] font-medium text-pro-text-secondary">Series Colors</h4>
								<button
									type="button"
									onClick={handleResetAllSeriesColors}
									disabled={!hasCustomSeriesColors}
									className={`text-[10px] font-medium transition-colors disabled:cursor-not-allowed ${
										hasCustomSeriesColors
											? 'text-pro-text-secondary hover:text-pro-text-primary'
											: 'cursor-not-allowed text-pro-text-tertiary'
									}`}
								>
									Reset All
								</button>
							</div>
							<div className="flex items-center gap-2 overflow-x-auto rounded-md border border-pro-cards-border bg-pro-cards-bg p-2">
								{visibleSeries.map((series) => {
									const activeColor = resolveSeriesColor(series.name, series.color)
									const hasOverride = !!seriesColors?.[series.name]
									return (
										<div
											key={series.name}
											className="flex shrink-0 items-center gap-1.5 rounded-sm border border-pro-cards-border bg-surface-elevated-1 px-2 py-1 text-xs"
										>
											<span className="max-w-[140px] truncate text-pro-text-secondary" title={series.name}>
												{series.name}
											</span>
											<input
												type="color"
												value={activeColor}
												onChange={(event) => handleSeriesColorChange(series.name, event.target.value)}
												className="size-5 cursor-pointer rounded-sm border border-pro-cards-border bg-transparent p-0"
												aria-label={`Select color for ${series.name}`}
											/>
											<button
												type="button"
												onClick={() => handleSeriesColorReset(series.name)}
												disabled={!hasOverride}
												className={`text-[10px] font-medium transition-colors disabled:cursor-not-allowed ${
													hasOverride
														? 'text-pro-text-tertiary hover:text-pro-text-primary'
														: 'pro-text4 cursor-not-allowed'
												}`}
											>
												Reset
											</button>
										</div>
									)
								})}
							</div>
						</div>
					) : null}

					<div className="mt-2 shrink-0 rounded-sm pro-panel-raised p-2">
						<div className="flex items-start gap-1">
							<span className="text-[10px] text-pro-text-tertiary">ⓘ</span>
							<p className="text-[10px] leading-relaxed text-pro-text-tertiary">
								This chart shows {chartBuilder.metric}
								{chartBuilder.mode === 'protocol'
									? ` for ${
											chartBuilder.protocol
												? getProtocolInfo(chartBuilder.protocol)?.name || chartBuilder.protocol
												: 'All Protocols'
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
				</div>
			</div>
		</div>
	)
}
