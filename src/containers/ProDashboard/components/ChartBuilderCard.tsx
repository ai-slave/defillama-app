import { useMutation, useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { Select } from '~/components/Select/Select'
import { StreamDoneContext } from '~/containers/ProDashboard/queries'
import { PROTOCOL_UNSUPPORTED_BY_CHAIN_METRICS } from '~/containers/ProDashboard/utils/breakdownMetrics'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import type { ChartSeries } from '~/utils/breakdowns'
import { downloadBlob } from '~/utils/download'
import { formatUsd } from '~/utils/numberFormat'
import { chartBuilderHasExactRemainder, chartBuilderScopeHidesOthers } from '../chartBuilderCapabilities'
import { getChartBuilderQueryKey } from '../chartBuilderQueryKey'
import { chartBuilderSubtitleParts } from '../chartBuilderSubtitle'
import { requestDashboardItemReveal } from '../hooks/useDashboardItemDeepLink'
import {
	useProDashboardCatalog,
	useProDashboardEditorActions,
	useProDashboardPermissions,
	useProDashboardTime
} from '../ProDashboardAPIContext'
import { fetchProtocolBreakdownData, fetchProtocolChainBreakdownData } from '../services/ProtocolChartBuilderData'
import type { ChartBuilderConfig } from '../types'
import { ProBadge, ProButton, ProMeta, ProSegmented } from '../ui'
import { DASHBOARD_CHART_GROUPING } from '../utils'
import { buildProTreemapData } from '../utils/treemap'
import { BoundParameterBadge } from './BoundParameterBadge'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import {
	buildChartBuilderSeriesView,
	isChartBuilderSnapshotMetric,
	selectChartBuilderSeries,
	withoutOthersSeries
} from './chartBuilderSeries'
import { createChartBuilderTooltipFormatter } from './chartBuilderTooltip'
import { ConfirmationModal } from './ConfirmationModal'
import { DASHBOARD_GROUPING_SEGMENTS } from './dashboardGroupingSegments'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const BuilderTreemapChart = lazy(() => import('~/components/ECharts/TreemapChart/Builder'))

const DEFAULT_SERIES_COLOR = '#3e61cc'
const EMPTY_SERIES_COLORS: Record<string, string> = {}
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}){1,2}$/i
const CHART_TYPE_OPTIONS: Array<{
	name: string
	key: ChartBuilderConfig['config']['chartType']
}> = [
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

		return chartBuilderScopeHidesOthers(config) ? withoutOthersSeries(data.series) : data.series
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

	return chartBuilderScopeHidesOthers(config) ? withoutOthersSeries(data.series) : data.series
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
	const { isReadOnly } = useProDashboardPermissions()
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
	const effectiveShowColors = !isReadOnly && showColors
	const hasExactRemainder = chartBuilderHasExactRemainder(config)
	const displayAs = hasExactRemainder ? config.displayAs : 'timeSeries'
	const protocolDisplayName = config.protocol ? getProtocolInfo(config.protocol)?.name || config.protocol : null

	const isSnapshotChart = isChartBuilderSnapshotMetric(config.metric)
	const treemapValue = config.treemapValue || 'latest'
	const treemapMode = isSnapshotChart ? 'latest' : treemapValue
	const treemapLabel = TREEMAP_VALUE_OPTIONS.find((option) => option.key === treemapMode)?.name ?? 'Last day (1d)'
	const hideOthersOptions = useMemo(
		() => buildHideOthersOptions(config.mode, config.limit),
		[config.mode, config.limit]
	)
	const subtitleParts = chartBuilderSubtitleParts({
		config,
		protocolName: protocolDisplayName,
		hasExactRemainder,
		treemapMode,
		timePeriod: timePeriod ?? null
	})

	const streamDone = useContext(StreamDoneContext)
	const selectChartData = useCallback(
		(data: { series: Array<ChartSeries> }) =>
			selectChartBuilderSeries(data, { hideOthers: config.hideOthers === true, timePeriod, customTimePeriod }),
		[config.hideOthers, timePeriod, customTimePeriod]
	)
	const {
		data: chartData,
		isPending: isChartDataPending,
		isError: isChartDataError,
		isFetching: isChartDataFetching,
		refetch: refetchChartData
	} = useQuery({
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
	const retryChartData = () => {
		void refetchChartData()
	}

	const chartOptions = useMemo<MultiSeriesChartOptions>(() => {
		const tooltipFormatter = createChartBuilderTooltipFormatter({
			displayAs,
			groupBy: DASHBOARD_CHART_GROUPING[builder.grouping ?? 'day'],
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

	const hallmarks = useDashboardAnnotationHallmarks()
	const syncGroup = useChartSyncGroup()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(360, cardHeightScale)
	const treemapHeight = scaledPx(350, cardHeightScale)

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
		<div className="flex min-h-[calc(422px*var(--card-scale,1))] flex-col p-0 md:min-h-[calc(438px*var(--card-scale,1))]">
			{isChartDataError && hasRenderableData ? <ProCardRefreshFailed onRetry={retryChartData} /> : null}
			<ProCardHeader
				title={
					builder.name ||
					(config.mode === 'protocol'
						? `${protocolDisplayName ?? 'All Protocols'} ${config.metric} by Chain`
						: `${config.metric} by Protocol`)
				}
				badge={<BoundParameterBadge {...(builder.bindings === undefined ? {} : { bindings: builder.bindings })} />}
				subtitle={<ProMeta items={subtitleParts} />}
				controls={
					<>
						{hasRenderableData && config.chartType !== 'treemap' ? (
							<ProSegmented
								size="sm"
								label="Grouping"
								options={DASHBOARD_GROUPING_SEGMENTS}
								value={builder.grouping ?? 'day'}
								onValueChange={(value) => handleGroupingChange(builder.id, value)}
							/>
						) : null}

						<Select
							heading="Chart type"
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

						{config.chartType === 'treemap' && !isSnapshotChart ? (
							<Select
								heading="Chart type"
								size="sm"
								allValues={TREEMAP_VALUE_OPTIONS}
								selectedValues={treemapMode}
								setSelectedValues={(value: string) => handleTreemapValueChange(value)}
								label={treemapLabel}
								labelType="none"
								variant="pro"
							/>
						) : null}
						{config.chartType !== 'treemap' && hasExactRemainder ? (
							<Select
								heading="Values"
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
							<ProButton
								size="sm"
								variant={effectiveShowColors ? 'primary' : 'secondary'}
								data-btn="colors"
								onClick={() => setShowColors((prev) => !prev)}
								aria-pressed={effectiveShowColors}
							>
								Colors
							</ProButton>
						) : null}
						{hasExactRemainder &&
						(config.mode !== 'protocol' || !(config.chainCategories && config.chainCategories.length > 0)) ? (
							<Select
								heading="Show"
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
						) : !hasExactRemainder ? (
							<ProBadge tone="neutral">Top {config.limit}</ProBadge>
						) : null}
					</>
				}
				menu={
					hasRenderableData
						? {
								image: {
									chartInstance,
									filename: builder.name || config.metric,
									title: config.chartType === 'treemap' ? undefined : builder.name || `${config.metric} by Protocol`,
									expandLegend: true
								},
								csv: { onClick: () => csvExportMutation.mutate(), isLoading: csvExportMutation.isPending },
								onDuplicate: () => setShowDuplicateConfirm(true)
							}
						: {}
				}
			/>
			<div className="flex flex-col gap-1 px-3 pb-1">
				{effectiveShowColors && hasRenderableData ? (
					<div className="flex items-center gap-2 overflow-x-auto rounded-md border border-pro-cards-border bg-pro-cards-bg p-2">
						<span className="shrink-0 label-sm text-pro-text-label">Series Colors</span>
						{displayedSeries.map((series: ChartSeries) => {
							const colorValue = seriesColors[series.name] || series.color || DEFAULT_SERIES_COLOR
							const hasOverride = Boolean(seriesColors[series.name])
							return (
								<div
									key={series.name}
									className="flex shrink-0 items-center gap-1.5 rounded-sm border border-pro-cards-border bg-surface-elevated-1 px-2 py-1 body-sm"
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
									<ProButton
										size="sm"
										variant="ghost"
										onClick={() => handleSeriesColorReset(series.name)}
										disabled={isReadOnly || !hasOverride}
									>
										Reset
									</ProButton>
								</div>
							)
						})}
						<ProButton
							size="sm"
							variant="secondary"
							onClick={handleResetAllSeriesColors}
							disabled={isReadOnly || !hasCustomSeriesColors}
						>
							Reset All
						</ProButton>
					</div>
				) : null}
			</div>

			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
				{/* A disabled React Query is not "loading", but remains pending until the stream seeds its cache. */}
				{isChartDataError && !hasRenderableData ? (
					isChartDataFetching ? (
						<ProCardLoading label="Loading chart…" />
					) : (
						<ProCardError onRetry={retryChartData} />
					)
				) : isChartDataPending ? (
					<ProCardLoading label="Loading chart…" />
				) : hasRenderableData ? (
					<Suspense fallback={<div className="min-h-[calc(300px*var(--card-scale,1))]" />}>
						{config.chartType === 'treemap' ? (
							<BuilderTreemapChart data={treemapData} height={treemapHeight} onReady={handleChartReady} />
						) : (
							<MultiSeriesChart
								height={chartHeight}
								{...(hallmarks ? { hallmarks } : {})}
								hallmarkStyle="mark-line"
								{...(syncGroup ? { syncGroup } : {})}
								dataset={chartView.dataset}
								charts={chartView.charts}
								valueSymbol={displayAs === 'percentage' ? '%' : '$'}
								groupBy={DASHBOARD_CHART_GROUPING[builder.grouping ?? 'day']}
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
					<ProCardEmpty message="No data available" />
				)}
			</div>
			<ConfirmationModal
				isOpen={showDuplicateConfirm}
				onClose={() => setShowDuplicateConfirm(false)}
				onConfirm={() => {
					const duplicateId = handleDuplicateChartBuilder(builder)
					if (duplicateId) requestDashboardItemReveal(duplicateId, { scroll: 'nearest' })
				}}
				title="Duplicate Chart"
				message="Create a duplicate of this chart in the dashboard?"
				confirmText="Duplicate"
				tone="primary"
			/>
		</div>
	)
}
