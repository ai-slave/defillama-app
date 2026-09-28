import { lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { Select } from '~/components/Select/Select'
import { getMetricUnitGroup } from '~/containers/ProDashboard/components/metricGroups'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { LoadingSpinner } from '~/ui/Loaders'
import { capitalizeFirstLetter } from '~/utils'
import { downloadCSV } from '~/utils/download'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { getChartDataPrerequisite, toChartRuntimeState, type ChartRuntimeView } from '../chartRuntime'
import { requestDashboardItemReveal } from '../hooks/useDashboardItemDeepLink'
import { useProDashboardCatalog, useProDashboardEditorActions, useProDashboardTime } from '../ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext, useChartsData } from '../queries'
import {
	getProDashboardChartTypeConfig,
	isDailyAverageChartType,
	limitMultiChartItems,
	type MultiChartConfig
} from '../types'
import { ProMeta, ProSegmented } from '../ui'
import { DASHBOARD_CHART_GROUPING } from '../utils'
import { buildProTreemapData } from '../utils/treemap'
import { BoundParameterBadge } from './BoundParameterBadge'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { ConfirmationModal } from './ConfirmationModal'
import { DASHBOARD_GROUPING_LABELS, DASHBOARD_GROUPING_SEGMENTS } from './dashboardGroupingSegments'
import {
	buildMultiChartCardSeries,
	buildMultiChartCsvRows,
	buildMultiChartSeriesView,
	getMultiChartGrouping
} from './multiChartSeries'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardNotice } from './ProCardStatus'
import { useChartSyncGroup } from './useChartSyncGroup'
import { useDashboardAnnotationHallmarks } from './useDashboardAnnotationHallmarks'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const BuilderTreemapChart = lazy(() => import('~/components/ECharts/TreemapChart/Builder'))

const CUMULATIVE_DISPLAY_OPTIONS = [
	{ name: 'Show individual values', key: 'Individual' },
	{ name: 'Show cumulative values', key: 'Cumulative' }
]

const STACKING_DISPLAY_OPTIONS = [
	{ name: 'Show separate', key: 'Separate' },
	{ name: 'Show stacked', key: 'Stacked' }
]

const VALUE_TYPE_OPTIONS = [
	{ name: 'Show absolute ($)', key: '$ Absolute' },
	{ name: 'Show percentage (%)', key: '% Percentage' }
]

const CHART_LAYOUT_OPTIONS = [
	{ name: 'Time Series', key: 'chart' },
	{ name: 'Tree Map', key: 'treemap' }
]

interface MultiChartCardProps {
	multi: MultiChartConfig
}

const isLoadedMultiChartItem = (item: ChartRuntimeView): boolean =>
	!item.isLoading && !item.hasError && item.data.length > 0

function MultiChartCard({ multi }: MultiChartCardProps) {
	const { getProtocolInfo, parentMapping, protocolBySlug, protocolCatalog } = useProDashboardCatalog()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const {
		handleGroupingChange,
		handleCumulativeChange,
		handlePercentageChange,
		handleStackedChange,
		handleTreemapChange,
		handleDuplicateMultiChart
	} = useProDashboardEditorActions()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
	const showStacked = multi.showStacked !== false
	const showCumulative = multi.showCumulative || false
	const showPercentage = multi.showPercentage || false
	const showTreemap = multi.showTreemap || false
	const limitedItems = useMemo(() => limitMultiChartItems(multi.items), [multi.items])
	const groupableGrouping = getMultiChartGrouping(limitedItems, multi.grouping)
	const allChartsGroupable = groupableGrouping !== null
	// One grouping for the data, tooltip and CSV. Items keep their saved grouping, which can be stale
	// once a non-groupable metric joins the chart.
	const grouping = groupableGrouping ?? 'day'
	const groupedItems = useMemo(() => limitedItems.map((item) => ({ ...item, grouping })), [limitedItems, grouping])
	const chartQueries = useChartsData(
		groupedItems,
		protocolCatalog,
		protocolBySlug,
		timePeriod,
		customTimePeriod,
		authToken,
		parentMapping
	)
	const runtimeItems = useMemo<Array<ChartRuntimeView>>(
		() =>
			chartQueries.map((query, index) => {
				const item = groupedItems[index]
				if (!item) throw new Error(`Missing multi-chart config at index ${index}`)
				return {
					...item,
					...toChartRuntimeState(query, streamDone, getChartDataPrerequisite(item, protocolCatalog, protocolBySlug))
				}
			}),
		[chartQueries, groupedItems, protocolBySlug, protocolCatalog, streamDone]
	)

	const { validItems, failedItems, loadingItems } = useMemo(() => {
		const validItems: Array<ChartRuntimeView> = []
		const failedItems: Array<ChartRuntimeView> = []
		const loadingItems: Array<ChartRuntimeView> = []
		for (const item of runtimeItems) {
			if (isLoadedMultiChartItem(item)) validItems.push(item)
			else if (item.isLoading) loadingItems.push(item)
			else failedItems.push(item)
		}
		return { validItems, failedItems, loadingItems }
	}, [runtimeItems])
	const failedItemRetries = useMemo(() => {
		const retries = new Set<() => void>()
		for (const item of failedItems) if (item.canRetry) retries.add(item.refetch)
		return Array.from(retries)
	}, [failedItems])
	const retryFailedItems = useCallback(() => {
		for (const retry of failedItemRetries) retry()
	}, [failedItemRetries])

	const baseSeries = useMemo(
		() =>
			buildMultiChartCardSeries(validItems, {
				showCumulative,
				grouping,
				getProtocolName: (protocol) => getProtocolInfo(protocol)?.name
			}),
		[validItems, getProtocolInfo, showCumulative, grouping]
	)
	const hidesDailyAverage = showCumulative && validItems.some((cfg) => isDailyAverageChartType(cfg.type))

	const chartTypeInfo = useMemo(() => {
		let firstMetricType: string | undefined
		let hasMultipleMetrics = false
		let allBarType = validItems.length > 0
		let allAreaType = validItems.length > 0
		for (const item of validItems) {
			if (firstMetricType === undefined) firstMetricType = item.type
			else if (item.type !== firstMetricType) hasMultipleMetrics = true
			const chartType = getProDashboardChartTypeConfig(item.type)
			if (chartType?.chartType !== 'bar') allBarType = false
			if (chartType?.chartType !== 'area') allAreaType = false
		}
		if (hasMultipleMetrics) {
			allBarType = false
			allAreaType = false
		}
		return { allBarType, allAreaType, hasMultipleMetrics }
	}, [validItems])

	const treemapData = useMemo(() => {
		if (!showTreemap) return []
		return buildProTreemapData(baseSeries, 'latest', (_name, color) => color ?? '#8884d8')
	}, [baseSeries, showTreemap])

	const chartView = useMemo(() => {
		const { allBarType, allAreaType } = chartTypeInfo
		const hasCumulativeFlow = showCumulative && baseSeries.some((serie) => serie.baseType === 'bar')
		return buildMultiChartSeriesView({
			series: baseSeries,
			showCumulative,
			showPercentage,
			stackSeries: (allBarType || allAreaType) && showStacked && !hasCumulativeFlow && !showPercentage
		})
	}, [baseSeries, chartTypeInfo, showPercentage, showStacked, showCumulative])

	const handleCsvExport = useCallback(() => {
		if (chartView.charts.length === 0) return
		const rows = buildMultiChartCsvRows(chartView, grouping)
		const fileName = `${multi.name || 'multi_chart'}_${new Date().toISOString().split('T')[0]}.csv`
		downloadCSV(fileName, rows)
	}, [chartView, grouping, multi.name])

	const hasAnyData = validItems.length > 0
	const isPrimaryLoading = !hasAnyData && loadingItems.length > 0

	const { allPercentMetrics, allCountMetrics, allRatioMetrics, hasMultipleUnitGroups } = useMemo(() => {
		let firstUnitGroup: ReturnType<typeof getMetricUnitGroup> | undefined
		let hasMultipleUnitGroups = false
		for (const series of baseSeries) {
			const unitGroup = getMetricUnitGroup(series.metricType)
			if (firstUnitGroup === undefined) firstUnitGroup = unitGroup
			else if (unitGroup !== firstUnitGroup) hasMultipleUnitGroups = true
		}
		return {
			allPercentMetrics: baseSeries.length > 0 && !hasMultipleUnitGroups && firstUnitGroup === 'percent',
			allCountMetrics: baseSeries.length > 0 && !hasMultipleUnitGroups && firstUnitGroup === 'count',
			allRatioMetrics: baseSeries.length > 0 && !hasMultipleUnitGroups && firstUnitGroup === 'ratio',
			hasMultipleUnitGroups
		}
	}, [baseSeries])
	const { hasMultipleMetrics, allBarType, allAreaType } = chartTypeInfo
	const canStack = allBarType || allAreaType

	const seriesCount = chartView.charts.length
	const chartOptions = useMemo<MultiSeriesChartOptions>(() => {
		const grid = chartGrid({
			top: seriesCount > 5 ? 80 : CHART_LEGEND_RESERVE
		})
		const legend = {
			top: CHART_INSET,
			type: 'scroll',
			pageButtonPosition: 'end',
			height: seriesCount > 5 ? 80 : 40
		}
		if (showPercentage) {
			return {
				yAxis: {
					max: 100,
					min: 0,
					axisLabel: {
						formatter: '{value}%'
					}
				},
				grid: chartGrid({ top: 80 }),
				legend
			}
		}
		if (hasMultipleUnitGroups) return { yAxis: {}, grid, legend }

		if (allPercentMetrics) {
			return {
				yAxis: {
					axisLabel: {
						formatter: '{value}%'
					}
				},
				grid,
				legend
			}
		}

		if (allCountMetrics || allRatioMetrics) {
			return {
				yAxis: {
					axisLabel: {
						formatter: (value: number) => formatCompactNumber(value, { maximumFractionDigits: 1 })
					}
				},
				grid,
				legend
			}
		}

		return {
			yAxis: {
				axisLabel: {
					formatter: (value: number) => formatUsd(value, { compact: true, maximumFractionDigits: 1 })
				}
			},
			grid,
			legend
		}
	}, [allCountMetrics, allPercentMetrics, allRatioMetrics, hasMultipleUnitGroups, seriesCount, showPercentage])

	const hallmarks = useDashboardAnnotationHallmarks()
	const syncGroup = useChartSyncGroup()
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(360, cardHeightScale)

	return (
		<div className="flex min-h-[calc(402px*var(--card-scale,1))] flex-col p-0 md:min-h-[calc(418px*var(--card-scale,1))]">
			<ProCardHeader
				title={multi.name || `Multi-Chart (${limitedItems.length})`}
				badge={<BoundParameterBadge item={multi} />}
				subtitle={
					<ProMeta
						items={[
							`${limitedItems.length} series`,
							allChartsGroupable ? DASHBOARD_GROUPING_LABELS[multi.grouping ?? 'day'] : null,
							showTreemap ? 'Tree map' : null
						]}
					/>
				}
				controls={
					<>
						{allChartsGroupable && hasAnyData ? (
							<ProSegmented
								size="sm"
								label="Grouping"
								options={DASHBOARD_GROUPING_SEGMENTS}
								value={multi.grouping ?? 'day'}
								onValueChange={(value) => handleGroupingChange(multi.id, value)}
							/>
						) : null}

						{hasAnyData && !hasMultipleMetrics && allBarType ? (
							<Select
								heading="Display"
								size="sm"
								allValues={CUMULATIVE_DISPLAY_OPTIONS}
								selectedValues={showCumulative ? 'Cumulative' : 'Individual'}
								setSelectedValues={(value: string) => {
									handleCumulativeChange(multi.id, value === 'Cumulative')
									if (value === 'Cumulative') {
										handleStackedChange(multi.id, false)
									}
								}}
								label={showCumulative ? 'Cumulative' : 'Individual'}
								labelType="none"
								variant="pro"
							/>
						) : null}
						{hasAnyData && !hasMultipleMetrics && canStack && !showCumulative && !showTreemap ? (
							<Select
								heading="Stacking"
								size="sm"
								allValues={STACKING_DISPLAY_OPTIONS}
								selectedValues={showStacked ? 'Stacked' : 'Separate'}
								setSelectedValues={(value: string) => {
									handleStackedChange(multi.id, value !== 'Separate')
									handlePercentageChange(multi.id, false)
								}}
								label={showStacked ? 'Stacked' : 'Separate'}
								labelType="none"
								variant="pro"
							/>
						) : null}
						{hasAnyData && !hasMultipleMetrics && !showTreemap ? (
							<Select
								heading="Values"
								size="sm"
								allValues={VALUE_TYPE_OPTIONS}
								selectedValues={showPercentage ? '% Percentage' : '$ Absolute'}
								setSelectedValues={(value: string) => {
									handlePercentageChange(multi.id, value === '% Percentage')
									handleStackedChange(multi.id, false)
								}}
								label={showPercentage ? '% Percentage' : '$ Absolute'}
								labelType="none"
								variant="pro"
							/>
						) : null}
						{hasAnyData && !hasMultipleMetrics ? (
							<Select
								heading="Chart type"
								size="sm"
								allValues={CHART_LAYOUT_OPTIONS}
								selectedValues={showTreemap ? 'treemap' : 'chart'}
								setSelectedValues={(value: string) => {
									handleTreemapChange(multi.id, value === 'treemap')
								}}
								label={showTreemap ? 'Tree Map' : 'Time Series'}
								labelType="none"
								variant="pro"
							/>
						) : null}
					</>
				}
				menu={
					chartView.charts.length > 0
						? {
								image: {
									chartInstance,
									filename: multi.name || 'multi_chart',
									title: showTreemap ? undefined : capitalizeFirstLetter(multi.name) || 'Multi Chart'
								},
								csv: {
									onClick: handleCsvExport,
									isLoading: loadingItems.length > 0,
									disabled: failedItems.length > 0
								},
								onDuplicate: () => setShowDuplicateConfirm(true)
							}
						: {}
				}
			/>
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
				{loadingItems.length > 0 && failedItems.length < limitedItems.length ? (
					<ProMeta
						items={[
							<>
								<LoadingSpinner size={12} />
								{validItems.length}/{limitedItems.length - failedItems.length}
							</>
						]}
					/>
				) : null}
				{hasAnyData && failedItems.length > 0 ? (
					<ProCardNotice
						tone="warning"
						{...(failedItemRetries.length > 0 ? { action: { label: 'Try again', onClick: retryFailedItems } } : {})}
					>
						{failedItems.length} {failedItems.length === 1 ? 'series is' : 'series are'} unavailable.
					</ProCardNotice>
				) : null}

				{hidesDailyAverage ? (
					<ProCardNotice
						tone="warning"
						action={{ label: 'Show individual values', onClick: () => handleCumulativeChange(multi.id, false) }}
					>
						Cumulative isn&apos;t available for Active Addresses.
					</ProCardNotice>
				) : null}

				{isPrimaryLoading ? (
					<ProCardLoading label="Loading charts…" />
				) : !hasAnyData ? (
					failedItemRetries.length > 0 ? (
						<ProCardError
							title="Failed to load chart data"
							detail={`${failedItems.length} of ${limitedItems.length} charts failed`}
							onRetry={retryFailedItems}
						/>
					) : (
						<ProCardEmpty message="No chart data available" />
					)
				) : hidesDailyAverage && chartView.charts.length === 0 ? null : showTreemap && treemapData.length > 0 ? (
					<Suspense fallback={<div className="min-h-[calc(360px*var(--card-scale,1))]" />}>
						<BuilderTreemapChart key={multi.id} data={treemapData} height={chartHeight} onReady={handleChartReady} />
					</Suspense>
				) : (
					<Suspense fallback={<div className="min-h-[calc(360px*var(--card-scale,1))]" />}>
						<MultiSeriesChart
							height={chartHeight}
							{...(hallmarks ? { hallmarks } : {})}
							hallmarkStyle="mark-line"
							{...(syncGroup ? { syncGroup } : {})}
							dataset={chartView.dataset}
							charts={chartView.charts}
							valueSymbol={
								showPercentage ? '%' : allPercentMetrics ? '%' : allCountMetrics || allRatioMetrics ? '' : '$'
							}
							groupBy={DASHBOARD_CHART_GROUPING[grouping]}
							hideDataZoom
							hideDefaultLegend={false}
							solidChartAreaStyle={chartView.solidChartAreaStyle}
							exportButtons="hidden"
							onReady={handleChartReady}
							chartOptions={chartOptions}
						/>
					</Suspense>
				)}
			</div>
			<ConfirmationModal
				isOpen={showDuplicateConfirm}
				onClose={() => setShowDuplicateConfirm(false)}
				onConfirm={() => {
					const duplicateId = handleDuplicateMultiChart(multi)
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

export default MultiChartCard
