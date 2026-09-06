import { useMutation, useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { Select } from '~/components/Select/Select'
import { filterDataByTimePeriod, StreamDoneContext } from '~/containers/ProDashboard/queries'
import { PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS } from '~/containers/ProDashboard/utils/breakdownMetrics'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { Icon } from '~/ui/Icon'
import type { ChartSeries } from '~/utils/breakdowns'
import { downloadBlob } from '~/utils/download'
import { formatUsd } from '~/utils/numberFormat'
import { chartBuilderHasExactRemainder } from '../chartBuilderCapabilities'
import { getChartBuilderQueryKey } from '../chartBuilderQueryKey'
import {
	useProDashboardCatalog,
	useProDashboardEditorActions,
	useProDashboardPermissions,
	useProDashboardTime
} from '../ProDashboardAPIContext'
import { fetchProtocolBreakdownData, fetchProtocolChainBreakdownData } from '../services/ProtocolChartBuilderData'
import type { ChartBuilderConfig, DashboardGrouping } from '../types'
import { buildProTreemapData } from '../utils/treemap'
import { buildChartBuilderSeriesView, isChartBuilderSnapshotMetric } from './chartBuilderSeries'
import { createChartBuilderTooltipFormatter, dashboardGroupingToTooltipGroupBy } from './chartBuilderTooltip'
import { ConfirmationModal } from './ConfirmationModal'
import { CSVExportButton } from './CSVExportButton'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const BuilderTreemapChart = lazy(() => import('~/components/ECharts/TreemapChart/Builder'))

const DEFAULT_SERIES_COLOR = '#3e61cc'
const EMPTY_SERIES_COLORS: Record<string, string> = {}
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}){1,2}$/i
const CHART_TYPE_OPTIONS: Array<{ name: string; key: ChartBuilderConfig['config']['chartType'] }> = [
	{ name: 'Stacked Bar', key: 'stackedBar' },
	{ name: 'Stacked Area', key: 'stackedArea' },
	{ name: 'Line', key: 'line' },
	{ name: 'Tree Map', key: 'treemap' }
]
const TREEMAP_VALUE_OPTIONS = [
	{ name: 'Last day (1d)', key: 'latest' },
	{ name: 'Sum 7d', key: 'sum7d' },
	{ name: 'Sum 30d', key: 'sum30d' }
]
const VALUE_TYPE_OPTIONS = [
	{ name: 'Show absolute ($)', key: '$ Absolute' },
	{ name: 'Show percentage (%)', key: '% Percentage' }
]
const buildHideOthersOptions = (mode: 'chains' | 'protocol', limit: number) => [
	{ name: mode === 'protocol' ? 'Show all chains' : 'Show all protocols', key: 'All' },
	{
		name: mode === 'protocol' ? 'Show only top chains' : 'Show only top protocols',
		key: `Top ${limit}`
	}
]

interface ChartBuilderCardProps {
	builder: ChartBuilderConfig
}

type BuilderMetric = ChartBuilderCardProps['builder']['config']['metric']
type ProtocolBreakdownMetric = Exclude<BuilderMetric, 'stablecoins' | 'chain-fees' | 'chain-revenue'>

const getProtocolBreakdownMetric = (metric: BuilderMetric): ProtocolBreakdownMetric => {
	switch (metric) {
		case 'stablecoins':
		case 'chain-fees':
		case 'chain-revenue':
			throw new Error(`Metric does not have a protocol breakdown: ${metric}`)
		default:
			return metric
	}
}

async function fetchChartBuilderSeries(config: ChartBuilderConfig['config']): Promise<Array<ChartSeries>> {
	if (config.mode === 'protocol') {
		const data = await fetchProtocolChainBreakdownData({
			protocol: config.protocol,
			metric: config.metric,
			chains: config.chains.length > 0 ? config.chains : undefined,
			limit: config.limit,
			chainFilterMode: config.chainFilterMode,
			chainCategories: config.chainCategories,
			protocolCategories: config.protocolCategories,
			chainCategoryFilterMode: config.chainCategoryFilterMode,
			protocolCategoryFilterMode: config.protocolCategoryFilterMode
		})
		if (
			config.hideOthers ||
			(config.chainCategories && config.chainCategories.length > 0) ||
			(config.protocolCategories && config.protocolCategories.length > 0)
		) {
			return data.series.filter((series) => !series.name.startsWith('Others'))
		}
		return data.series
	}

	if (PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS.has(config.metric)) return []
	const data = await fetchProtocolBreakdownData({
		metric: getProtocolBreakdownMetric(config.metric),
		chains: config.chains,
		limit: config.limit,
		categories: config.categories,
		groupByParent: config.groupByParent,
		chainFilterMode: config.chainFilterMode,
		categoryFilterMode: config.categoryFilterMode
	})
	if (config.hideOthers || (config.chainCategories && config.chainCategories.length > 0)) {
		return data.series.filter((series) => !series.name.startsWith('Others'))
	}
	return data.series
}

export function ChartBuilderCard({ builder }: ChartBuilderCardProps) {
	const {
		handlePercentageChange,
		handleGroupingChange,
		handleHideOthersChange,
		handleChartTypeChange,
		handleEditItem,
		handleDuplicateChartBuilder
	} = useProDashboardEditorActions()
	const { isReadOnly, hideDuplicateButton } = useProDashboardPermissions()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { authorizedFetch } = useAuthContext()
	const { getProtocolInfo } = useProDashboardCatalog()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const config = builder.config
	const [showColors, setShowColors] = useState(false)
	const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
	const seriesColors = config.seriesColors ?? EMPTY_SERIES_COLORS
	let hasCustomSeriesColors = false
	for (const _ in seriesColors) {
		hasCustomSeriesColors = true
		break
	}
	const groupingOptions: Array<DashboardGrouping> = ['day', 'week', 'month', 'quarter', 'year']
	const chainFilterMode = config.chainFilterMode
	const categoryFilterMode = config.categoryFilterMode
	const chainCategoryFilterMode = config.chainCategoryFilterMode
	const protocolCategoryFilterMode = config.protocolCategoryFilterMode
	const effectiveShowColors = !isReadOnly && showColors
	const hasExactRemainder = chartBuilderHasExactRemainder(config)
	const displayAs = hasExactRemainder ? config.displayAs : 'timeSeries'

	const isSnapshotChart = isChartBuilderSnapshotMetric(config.metric)
	const treemapValue = config.treemapValue || 'latest'
	const treemapMode = isSnapshotChart ? 'latest' : treemapValue
	const treemapLabel = TREEMAP_VALUE_OPTIONS.find((option) => option.key === treemapMode)?.name ?? 'Last day (1d)'
	const hideOthersOptions = useMemo(
		() => buildHideOthersOptions(config.mode, config.limit),
		[config.mode, config.limit]
	)

	const streamDone = useContext(StreamDoneContext)
	const selectChartData = useCallback(
		(data: { series: Array<ChartSeries> }) => {
			if (!timePeriod || timePeriod === 'all') return data
			return {
				series: data.series.map((series) => ({
					...series,
					data: filterDataByTimePeriod(series.data, timePeriod, customTimePeriod)
				}))
			}
		},
		[timePeriod, customTimePeriod]
	)
	const { data: chartData, isPending: isChartDataPending } = useQuery({
		queryKey: getChartBuilderQueryKey(config),
		queryFn: () => fetchChartBuilderSeries(config).then((series) => ({ series })),
		select: selectChartData,
		enabled: streamDone && !!config.metric,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const chartView = useMemo(() => {
		if (!chartData?.series || config.chartType === 'treemap') {
			return buildChartBuilderSeriesView({
				series: [],
				useLastValue: isSnapshotChart,
				displayAs,
				chartType: 'line',
				resolveColor: () => DEFAULT_SERIES_COLOR
			})
		}
		const resolveSeriesColor = (name: string, fallback?: string) => {
			const override = seriesColors[name]
			if (override) {
				return override
			}
			if (fallback && HEX_COLOR_REGEX.test(fallback)) {
				return fallback
			}
			return DEFAULT_SERIES_COLOR
		}

		return buildChartBuilderSeriesView({
			series: chartData.series,
			...(builder.grouping ? { grouping: builder.grouping } : {}),
			useLastValue: isSnapshotChart,
			displayAs,
			chartType: config.chartType,
			resolveColor: resolveSeriesColor
		})
	}, [chartData, config.chartType, builder.grouping, displayAs, isSnapshotChart, seriesColors])

	const chartSeriesNames = chartView.seriesNames

	const treemapData = useMemo(() => {
		if (config.chartType !== 'treemap' || !chartData?.series || chartData.series.length === 0) return []

		const resolveColor = (name: string, fallback?: string) => {
			const override = seriesColors[name]
			if (override) return override
			if (fallback && HEX_COLOR_REGEX.test(fallback)) return fallback
			return DEFAULT_SERIES_COLOR
		}

		return buildProTreemapData(chartData.series, treemapMode, resolveColor)
	}, [chartData, config.chartType, seriesColors, treemapMode])
	const displayedSeries = chartData?.series ?? []
	const hasRenderableData =
		config.chartType === 'treemap' ? treemapData.length > 0 : chartView.dataset.source.length > 0

	const chartOptions = useMemo<MultiSeriesChartOptions>(() => {
		const tooltipFormatter = createChartBuilderTooltipFormatter({
			displayAs,
			groupBy: dashboardGroupingToTooltipGroupBy(builder.grouping),
			useTwoColumns: config.limit > 10
		})

		return {
			grid: chartGrid({ top: CHART_LEGEND_RESERVE }),
			legend: {
				show: true,
				top: CHART_INSET,
				type: 'scroll',
				selectedMode: 'multiple',
				pageButtonItemGap: 5,
				pageButtonGap: 20,
				data: chartSeriesNames
			},
			tooltip: {
				formatter: tooltipFormatter,
				confine: true
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
		}
	}, [builder.grouping, chartSeriesNames, config.limit, displayAs])

	const csvExportMutation = useMutation({
		mutationFn: async () => {
			const fileName = `${builder.name || config.metric}_${config.chains.join(
				'-'
			)}_${config.categories.length > 0 ? `${config.categories.join('-')}_` : ''}${
				config.chainCategories && config.chainCategories.length > 0 ? `${config.chainCategories.join('-')}_` : ''
			}${
				config.protocolCategories && config.protocolCategories.length > 0
					? `${config.protocolCategories.join('-')}_`
					: ''
			}${new Date().toISOString().split('T')[0]}.csv`
			const response = await authorizedFetch('/api/private/pro-dashboard/chart-builder-csv', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					config,
					grouping: builder.grouping ?? 'day',
					timePeriod,
					customTimePeriod,
					filename: fileName
				})
			})
			if (!response) throw new Error('Sign in to download this CSV')
			if (!response.ok) {
				let message = 'Failed to download CSV'
				try {
					const body: { error?: string } = await response.json()
					if (body.error) message = body.error
				} catch {
					// A non-JSON error body keeps the default message.
				}
				throw new Error(message)
			}
			downloadBlob(fileName, await response.blob())
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to download CSV')
	})

	const updateSeriesColors = (nextColors: Record<string, string>) => {
		if (isReadOnly) {
			return
		}
		handleEditItem(builder.id, {
			...builder,
			config: {
				...builder.config,
				seriesColors: nextColors
			}
		})
	}

	const handleSeriesColorChange = (seriesName: string, colorValue: string) => {
		const currentColors = builder.config.seriesColors || {}
		if (currentColors[seriesName] === colorValue) {
			return
		}
		updateSeriesColors({
			...currentColors,
			[seriesName]: colorValue
		})
	}

	const handleSeriesColorReset = (seriesName: string) => {
		if (!builder.config.seriesColors || !(seriesName in builder.config.seriesColors)) {
			return
		}
		const nextColors = { ...builder.config.seriesColors }
		delete nextColors[seriesName]
		updateSeriesColors(nextColors)
	}

	const handleResetAllSeriesColors = () => {
		if (!builder.config.seriesColors) return
		let hasColors = false
		for (const _ in builder.config.seriesColors) {
			hasColors = true
			break
		}
		if (!hasColors) return
		updateSeriesColors({})
	}

	const handleTreemapValueChange = (nextValue: string) => {
		if (isReadOnly) {
			return
		}
		if (nextValue !== 'latest' && nextValue !== 'sum7d' && nextValue !== 'sum30d') {
			return
		}
		if (config.treemapValue === nextValue) {
			return
		}
		handleEditItem(builder.id, {
			...builder,
			config: {
				...builder.config,
				treemapValue: nextValue
			}
		})
	}

	return (
		<div className="flex min-h-[422px] flex-col p-1 md:min-h-[438px]">
			<div className="flex flex-col gap-1 p-1 md:p-3">
				<div className="flex flex-wrap items-center justify-end gap-2">
					<h2 className="mr-auto text-base font-semibold">
						{builder.name ||
							(config.mode === 'protocol'
								? `${(config.protocol && (getProtocolInfo(config.protocol)?.name || config.protocol)) || 'All Protocols'} ${config.metric} by Chain`
								: `${config.metric} by Protocol`)}
					</h2>
					{!isReadOnly && hasRenderableData && config.chartType !== 'treemap' ? (
						<div className="flex overflow-hidden rounded-md border border-pro-form-control-border">
							{groupingOptions.map((option, index) => (
								<button
									type="button"
									key={option}
									onClick={() => handleGroupingChange(builder.id, option)}
									className={`px-2 py-1 text-xs font-medium transition-colors duration-150 ease-in-out sm:px-3 ${index > 0 ? 'border-l border-pro-form-control-border' : ''} ${
										builder.grouping === option || (!builder.grouping && option === 'day')
											? 'bg-brand text-on-brand focus:ring-2 focus:ring-brand/50 focus:outline-hidden'
											: 'bg-transparent pro-hover-bg text-pro-text-secondary focus:ring-1 focus:ring-pro-form-control-border focus:outline-hidden'
									}`}
								>
									{option.slice(0, 1).toUpperCase()}
								</button>
							))}
						</div>
					) : null}
					{!isReadOnly ? (
						<Select
							size="sm"
							allValues={CHART_TYPE_OPTIONS}
							selectedValues={config.chartType}
							setSelectedValues={(value: string) => {
								const chartType = CHART_TYPE_OPTIONS.find((option) => option.key === value)?.key
								if (!chartType) throw new Error(`Unsupported chart builder chart type: ${value}`)
								handleChartTypeChange(builder.id, chartType)
							}}
							label={
								config.chartType === 'stackedBar'
									? 'Stacked Bar'
									: config.chartType === 'stackedArea'
										? 'Stacked Area'
										: config.chartType === 'treemap'
											? 'Tree Map'
											: 'Line'
							}
							labelType="none"
							variant="pro"
						/>
					) : null}
					{!isReadOnly && config.chartType === 'treemap' && !isSnapshotChart ? (
						<Select
							size="sm"
							allValues={TREEMAP_VALUE_OPTIONS}
							selectedValues={treemapMode}
							setSelectedValues={(value: string) => handleTreemapValueChange(value)}
							label={treemapLabel}
							labelType="none"
							variant="pro"
						/>
					) : null}
					{!isReadOnly && config.chartType !== 'treemap' && hasExactRemainder ? (
						<Select
							size="sm"
							allValues={VALUE_TYPE_OPTIONS}
							selectedValues={displayAs === 'percentage' ? '% Percentage' : '$ Absolute'}
							setSelectedValues={(value: string) => {
								handlePercentageChange(builder.id, value === '% Percentage')
							}}
							label={displayAs === 'percentage' ? '% Percentage' : '$ Absolute'}
							labelType="none"
							variant="pro"
						/>
					) : null}
					{hasRenderableData ? (
						<button
							type="button"
							data-btn="colors"
							onClick={() => setShowColors((prev) => !prev)}
							disabled={isReadOnly}
							aria-pressed={effectiveShowColors}
							className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs transition-colors disabled:cursor-not-allowed ${
								effectiveShowColors
									? 'border-transparent bg-brand text-on-brand'
									: 'border-pro-form-control-border hover:not-disabled:pro-btn-primary focus-visible:not-disabled:pro-btn-primary'
							} disabled:border-pro-cards-border disabled:text-tertiary`}
						>
							Colors
						</button>
					) : null}
					{!isReadOnly &&
					hasExactRemainder &&
					(config.mode !== 'protocol' || !(config.chainCategories && config.chainCategories.length > 0)) ? (
						<Select
							size="sm"
							allValues={hideOthersOptions}
							selectedValues={config.hideOthers ? `Top ${config.limit}` : 'All'}
							setSelectedValues={(value: string) => {
								handleHideOthersChange(builder.id, value !== 'All')
							}}
							label={config.hideOthers ? `Top ${config.limit}` : 'All'}
							labelType="none"
							variant="pro"
						/>
					) : !isReadOnly && !hasExactRemainder ? (
						<span className="rounded-md border border-pro-form-control-border px-2 py-1 text-xs text-pro-text-secondary">
							Top {config.limit}
						</span>
					) : null}
					{!isReadOnly && !hideDuplicateButton ? (
						<button
							type="button"
							onClick={() => setShowDuplicateConfirm(true)}
							className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
						>
							<Icon name="copy" height={14} width={14} />
							<span>Duplicate</span>
						</button>
					) : null}
					{hasRenderableData ? (
						<>
							<ChartPngExportButton
								chartInstance={chartInstance}
								filename={builder.name || config.metric}
								title={config.chartType === 'treemap' ? undefined : builder.name || `${config.metric} by Protocol`}
								expandLegend
								smol
							/>
							<CSVExportButton
								onClick={() => csvExportMutation.mutate()}
								isLoading={csvExportMutation.isPending}
								smol
								className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
							/>
						</>
					) : null}
				</div>
				{effectiveShowColors && hasRenderableData ? (
					<div className="flex items-center gap-2 overflow-x-auto rounded-md border border-pro-cards-border bg-pro-cards-bg p-2">
						<span className="shrink-0 text-xs font-medium text-pro-text-label">Series Colors</span>
						{displayedSeries.map((series: ChartSeries) => {
							const colorValue = seriesColors[series.name] || series.color || DEFAULT_SERIES_COLOR
							const hasOverride = Boolean(seriesColors[series.name])
							return (
								<div
									key={series.name}
									className="flex shrink-0 items-center gap-1.5 rounded-sm border border-pro-cards-border bg-surface-elevated-1 px-2 py-1 text-xs"
								>
									<span className="max-w-[140px] truncate" title={series.name}>
										{series.name}
									</span>
									<input
										type="color"
										value={colorValue}
										onChange={(event) => handleSeriesColorChange(series.name, event.target.value)}
										disabled={isReadOnly}
										className="size-5 cursor-pointer rounded-sm border border-pro-cards-border bg-transparent p-0 disabled:cursor-not-allowed"
										aria-label={`Select color for ${series.name}`}
									/>
									<button
										type="button"
										onClick={() => handleSeriesColorReset(series.name)}
										disabled={isReadOnly || !hasOverride}
										className={`text-[10px] font-medium transition-colors disabled:cursor-not-allowed ${
											isReadOnly || !hasOverride
												? 'text-tertiary'
												: 'text-pro-text-tertiary hover:text-pro-text-primary'
										}`}
									>
										Reset
									</button>
								</div>
							)
						})}
						<button
							type="button"
							onClick={handleResetAllSeriesColors}
							disabled={isReadOnly || !hasCustomSeriesColors}
							className={`flex shrink-0 items-center rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
								isReadOnly || !hasCustomSeriesColors
									? 'border-pro-cards-border text-tertiary'
									: 'border-pro-form-control-border text-pro-text-tertiary hover:text-pro-text-primary'
							}`}
						>
							Reset All
						</button>
					</div>
				) : null}
				{(() => {
					const parts: Array<string> = []
					if (config.mode === 'protocol') {
						const protoName = config.protocol
							? getProtocolInfo(config.protocol)?.name || config.protocol
							: 'All Protocols'
						parts.push(protoName)
						if (!hasExactRemainder) parts.push(`Top ${config.limit} chains`)
						if (chainFilterMode === 'exclude' && config.chains.length > 0) {
							parts.push(`Excluding ${config.chains.join(', ')}`)
						} else if (config.chains.length > 0) {
							parts.push(config.chains.join(', '))
						} else {
							parts.push('All chains')
						}
						if (config.chainCategories && config.chainCategories.length > 0) {
							const cats = config.chainCategories.join(', ')
							if (chainCategoryFilterMode === 'exclude') parts.push(`Excluding ${cats}`)
							else parts.push(cats)
						}
						if (config.protocolCategories && config.protocolCategories.length > 0) {
							const cats = config.protocolCategories.join(', ')
							if (protocolCategoryFilterMode === 'exclude') parts.push(`Excluding ${cats}`)
							else parts.push(cats)
						}
					} else {
						const chainLabel = config.chains.length > 0 ? config.chains.join(', ') : 'All chains'
						const chainDisplay =
							chainFilterMode === 'exclude' && config.chains.length > 0 ? `Excluding ${chainLabel}` : chainLabel
						parts.push(`${chainDisplay} • Top ${config.limit} protocols${config.hideOthers ? ' only' : ''}`)
						if (config.categories.length > 0) {
							const cats = config.categories.join(', ')
							if (categoryFilterMode === 'exclude') parts.push(`Excluding ${cats}`)
							else parts.push(cats)
						}
					}
					if (config.chartType === 'treemap') {
						const treemapSummary = treemapMode === 'latest' ? 'Latest' : treemapMode === 'sum7d' ? '7D' : '30D'
						parts.push(treemapSummary)
					} else if (timePeriod && timePeriod !== 'all') {
						parts.push(timePeriod.toUpperCase())
					}
					return <p className="text-xs text-pro-text-label">{parts.join(' • ')}</p>
				})()}
			</div>

			{/* A disabled React Query is not "loading", but remains pending until the stream seeds its cache. */}
			{isChartDataPending ? (
				<div className="flex flex-1 flex-col items-center justify-center">
					<div className="mx-auto mb-2 size-8 animate-spin rounded-full border-b-2 border-brand" />
					<p className="text-sm text-pro-text-form">Loading chart...</p>
				</div>
			) : hasRenderableData ? (
				<Suspense fallback={<div className="min-h-[300px]" />}>
					{config.chartType === 'treemap' ? (
						<BuilderTreemapChart data={treemapData} height="350px" onReady={handleChartReady} />
					) : (
						<MultiSeriesChart
							dataset={chartView.dataset}
							charts={chartView.charts}
							valueSymbol={displayAs === 'percentage' ? '%' : '$'}
							groupBy={
								builder.grouping === 'week'
									? 'weekly'
									: builder.grouping === 'month'
										? 'monthly'
										: builder.grouping === 'quarter'
											? 'quarterly'
											: builder.grouping === 'year'
												? 'yearly'
												: 'daily'
							}
							hideDataZoom
							hideDefaultLegend={false}
							solidChartAreaStyle={config.chartType === 'stackedArea'}
							exportButtons="hidden"
							onReady={handleChartReady}
							chartOptions={chartOptions}
						/>
					)}
				</Suspense>
			) : (
				<div className="flex flex-1 flex-col items-center justify-center">
					<p className="text-sm text-pro-text-label">No data available</p>
				</div>
			)}
			<ConfirmationModal
				isOpen={showDuplicateConfirm}
				onClose={() => setShowDuplicateConfirm(false)}
				onConfirm={() => handleDuplicateChartBuilder(builder)}
				title="Duplicate Chart"
				message="Create a duplicate of this chart in the dashboard?"
				confirmText="Duplicate"
				cancelText="Cancel"
				confirmButtonClass="pro-btn-primary"
			/>
		</div>
	)
}
