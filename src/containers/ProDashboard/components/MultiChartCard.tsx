import { lazy, memo, Suspense, useCallback, useContext, useMemo, useState } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_INSET, CHART_LEGEND_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { Select } from '~/components/Select/Select'
import { getMetricUnitGroup } from '~/containers/ProDashboard/components/metricGroups'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { capitalizeFirstLetter } from '~/utils'
import { downloadCSV } from '~/utils/download'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { getChartDataPrerequisite, toChartRuntimeState, type ChartRuntimeView } from '../chartRuntime'
import {
	useProDashboardCatalog,
	useProDashboardEditorActions,
	useProDashboardPermissions,
	useProDashboardTime
} from '../ProDashboardAPIContext'
import { ProxyAuthTokenContext, StreamDoneContext, useChartsData } from '../queries'
import {
	getProDashboardChartTypeConfig,
	limitMultiChartItems,
	type DashboardGrouping,
	type MultiChartConfig
} from '../types'
import { generateChartColor } from '../utils'
import { COLOR_PALETTE_2, EXTENDED_COLOR_PALETTE, getPaletteColor } from '../utils/colorManager'
import { buildProTreemapData } from '../utils/treemap'
import { ConfirmationModal } from './ConfirmationModal'
import { CSVExportButton } from './CSVExportButton'
import { buildMultiChartCsvRows, buildMultiChartSeriesView, type MultiChartInputSeries } from './multiChartSeries'

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

const normalizeBaseType = (chartType: string | undefined): MultiChartInputSeries['baseType'] => {
	if (chartType === 'bar' || chartType === 'area' || chartType === 'line') return chartType
	return undefined
}

const MultiChartCard = memo(function MultiChartCard({ multi }: MultiChartCardProps) {
	const { getProtocolInfo, parentMapping, protocolBySlug, protocolCatalog, protocolSymbols } = useProDashboardCatalog()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const {
		handleGroupingChange,
		handleCumulativeChange,
		handlePercentageChange,
		handleStackedChange,
		handleTreemapChange,
		handleDuplicateMultiChart
	} = useProDashboardEditorActions()
	const { isReadOnly, hideDuplicateButton } = useProDashboardPermissions()
	const { chartInstance, handleChartReady } = useChartImageExport()
	const authToken = useContext(ProxyAuthTokenContext)
	const streamDone = useContext(StreamDoneContext)
	const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
	const showStacked = multi.showStacked !== false
	const showCumulative = multi.showCumulative || false
	const showPercentage = multi.showPercentage || false
	const showTreemap = multi.showTreemap || false
	const limitedItems = useMemo(() => limitMultiChartItems(multi.items), [multi.items])
	const chartQueries = useChartsData(
		limitedItems,
		protocolCatalog,
		protocolBySlug,
		timePeriod,
		customTimePeriod,
		authToken,
		parentMapping,
		protocolSymbols
	)
	const runtimeItems = useMemo<ChartRuntimeView[]>(
		() =>
			chartQueries.map((query, index) => {
				const item = limitedItems[index]
				if (!item) throw new Error(`Missing multi-chart config at index ${index}`)
				return {
					...item,
					...toChartRuntimeState(query, streamDone, getChartDataPrerequisite(item, protocolCatalog, protocolBySlug))
				}
			}),
		[chartQueries, limitedItems, protocolBySlug, protocolCatalog, streamDone]
	)

	const { validItems, failedItems, loadingItems } = useMemo(() => {
		const validItems: ChartRuntimeView[] = []
		const failedItems: ChartRuntimeView[] = []
		const loadingItems: ChartRuntimeView[] = []
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

	const colorContext = useMemo(() => {
		const uniqueChains = new Set<string>()
		const uniqueProtocols = new Set<string>()
		const itemIdsByProtocol = new Map<string, string[]>()
		const itemIdsByChain = new Map<string, string[]>()
		let onlyChains = true
		let onlyProtocols = true

		for (const item of validItems) {
			if (item.subjectType === 'protocol') {
				onlyChains = false
				uniqueProtocols.add(item.protocol)
				const ids = itemIdsByProtocol.get(item.protocol)
				if (ids) ids.push(item.id)
				else itemIdsByProtocol.set(item.protocol, [item.id])
			} else {
				onlyProtocols = false
				uniqueChains.add(item.chain)
				const ids = itemIdsByChain.get(item.chain)
				if (ids) ids.push(item.id)
				else itemIdsByChain.set(item.chain, [item.id])
			}
		}
		const isSingleChain = onlyChains && uniqueChains.size === 1
		const isSingleProtocol = onlyProtocols && uniqueProtocols.size === 1
		const colorItemIds = new Set<string>()

		for (const [item, ids] of itemIdsByProtocol) {
			if (ids.length > 1) {
				for (const id of ids) colorItemIds.add(id)
			} else {
				colorItemIds.add(item)
			}
		}

		for (const [item, ids] of itemIdsByChain) {
			if (ids.length > 1) {
				for (const id of ids) colorItemIds.add(id)
			} else {
				colorItemIds.add(item)
			}
		}

		const colorIndexByItemId = new Map<string, number>()
		const sortedItemIds = Array.from(colorItemIds).sort()
		for (let index = 0; index < sortedItemIds.length; index++) {
			const itemId = sortedItemIds[index]
			if (itemId) colorIndexByItemId.set(itemId, index)
		}

		return { isSingleChain, isSingleProtocol, colorIndexByItemId }
	}, [validItems])

	const baseSeries = useMemo(() => {
		const { isSingleChain, isSingleProtocol, colorIndexByItemId } = colorContext
		const colorIndexesTaken = new Set<number>()

		const getColorItemId = (item: (typeof validItems)[0]) => {
			if (isSingleProtocol || isSingleChain) return item.type
			const subject = item.subjectType === 'protocol' ? item.protocol : item.chain
			return `${item.subjectType}_${subject}_${item.type}`
		}

		const series: MultiChartInputSeries[] = validItems.map((cfg, index) => {
			const data = cfg.data
			const meta = getProDashboardChartTypeConfig(cfg.type)
			const name = cfg.subjectType === 'protocol' ? getProtocolInfo(cfg.protocol)?.name || cfg.protocol : cfg.chain

			const itemIdentifier = cfg.subjectType === 'protocol' ? cfg.protocol : cfg.chain
			const colorItemId = getColorItemId(cfg)

			let color =
				cfg.color ||
				(isSingleChain || isSingleProtocol
					? getPaletteColor(EXTENDED_COLOR_PALETTE, index)
					: generateChartColor(colorItemId, meta?.color || '#8884d8'))

			let colorIndex = colorIndexByItemId.get(itemIdentifier) ?? -1
			if (colorIndexesTaken.has(colorIndex)) {
				colorIndex = colorIndexByItemId.get(cfg.id) ?? -1
			}

			if (!cfg.color && colorIndex !== -1) {
				color = getPaletteColor(COLOR_PALETTE_2, colorIndex)
				colorIndexesTaken.add(colorIndex)
			}

			return {
				name: `${name} ${meta?.title || capitalizeFirstLetter(cfg.type)}`,
				baseType: normalizeBaseType(meta?.chartType),
				data,
				color,
				metricType: cfg.type
			}
		})
		return series
	}, [validItems, colorContext, getProtocolInfo])

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

		let allChartsGroupable = true
		for (const item of limitedItems) {
			const chartType = getProDashboardChartTypeConfig(item.type)
			if (chartType === undefined || !('groupable' in chartType) || chartType.groupable !== true) {
				allChartsGroupable = false
				break
			}
		}
		return { allBarType, allAreaType, hasMultipleMetrics, allChartsGroupable }
	}, [limitedItems, validItems])

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
		const rows = buildMultiChartCsvRows(chartView)
		const fileName = `${multi.name || 'multi_chart'}_${new Date().toISOString().split('T')[0]}.csv`
		downloadCSV(fileName, rows)
	}, [chartView, multi.name])

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
	const { allChartsGroupable, hasMultipleMetrics, allBarType, allAreaType } = chartTypeInfo
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

	const groupingOptions: DashboardGrouping[] = ['day', 'week', 'month', 'quarter', 'year']

	return (
		<div className="flex min-h-[402px] flex-col p-1 md:min-h-[418px]">
			<div className="flex flex-wrap items-center justify-end gap-2 p-1 md:p-3">
				<div className="mr-auto flex items-center gap-2">
					<h2 className="text-base font-semibold">{multi.name || `Multi-Chart (${limitedItems.length})`}</h2>
				</div>
				{!isReadOnly && allChartsGroupable && hasAnyData ? (
					<div className="flex w-fit flex-nowrap items-center overflow-x-auto rounded-md border border-pro-form-control-border text-pro-text-form">
						{groupingOptions.map((dataInterval) => (
							<Tooltip
								content={capitalizeFirstLetter(dataInterval)}
								render={<button />}
								className="shrink-0 px-2 py-1 text-xs whitespace-nowrap hover:not-disabled:pro-btn-primary focus-visible:not-disabled:pro-btn-primary data-[active=true]:bg-pro-accent data-[active=true]:font-medium data-[active=true]:text-on-brand"
								data-active={multi.grouping === dataInterval}
								onClick={() => handleGroupingChange(multi.id, dataInterval)}
								key={`${multi.id}-options-groupBy-${dataInterval}`}
							>
								{dataInterval.slice(0, 1).toUpperCase()}
							</Tooltip>
						))}
					</div>
				) : null}

				{!isReadOnly && hasAnyData && !hasMultipleMetrics && allBarType ? (
					<Select
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
				{!isReadOnly && hasAnyData && !hasMultipleMetrics && canStack && !showCumulative && !showTreemap ? (
					<Select
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
				{!isReadOnly && hasAnyData && !hasMultipleMetrics && !showTreemap ? (
					<Select
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
				{!isReadOnly && hasAnyData && !hasMultipleMetrics ? (
					<Select
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
				{chartView.charts.length > 0 ? (
					<>
						<ChartPngExportButton
							chartInstance={chartInstance}
							filename={multi.name || 'multi_chart'}
							title={showTreemap ? undefined : capitalizeFirstLetter(multi.name) || 'Multi Chart'}
							smol
						/>
						<CSVExportButton
							onClick={handleCsvExport}
							smol
							className="flex items-center gap-1 rounded-md border border-pro-form-control-border px-1.5 py-1 text-xs hover:border-transparent hover:not-disabled:pro-btn-primary focus-visible:border-transparent focus-visible:not-disabled:pro-btn-primary disabled:border-pro-cards-border disabled:text-tertiary"
						/>
					</>
				) : null}
			</div>

			{loadingItems.length > 0 && failedItems.length < limitedItems.length ? (
				<div className="flex items-center gap-1.5 px-1 text-xs text-pro-text-form md:px-3">
					<div className="size-3 animate-spin rounded-full border-2 border-pro-text-form border-t-transparent" />
					<span>
						{validItems.length}/{limitedItems.length - failedItems.length}
					</span>
				</div>
			) : null}
			{hasAnyData && failedItems.length > 0 ? (
				<div className="flex items-center gap-1.5 px-1 text-xs text-pro-text-form md:px-3">
					<Icon name="alert-triangle" height={14} width={14} className="text-sub-orange" />
					<span>
						{failedItems.length} {failedItems.length === 1 ? 'series is' : 'series are'} unavailable.
					</span>
					{failedItemRetries.length > 0 ? (
						<button type="button" className="text-link hover:underline" onClick={retryFailedItems}>
							Try again
						</button>
					) : null}
				</div>
			) : null}

			{isPrimaryLoading ? (
				<div className="flex flex-1 flex-col items-center justify-center">
					<div className="mx-auto mb-2 size-8 animate-spin rounded-full border-b-2 border-brand"></div>
					<p className="text-sm text-pro-text-form">Loading charts...</p>
				</div>
			) : !hasAnyData ? (
				<div className="flex flex-1 flex-col items-center justify-center">
					{failedItemRetries.length > 0 ? (
						<>
							<Icon name="alert-triangle" height={24} width={24} className="mx-auto mb-2 text-error" />
							<p className="text-sm text-pro-text-label">Failed to load chart data</p>
							<p className="mt-1 text-xs text-pro-text-form">
								{failedItems.length} of {limitedItems.length} charts failed
							</p>
							<button type="button" className="mt-1 text-sm text-link hover:underline" onClick={retryFailedItems}>
								Try again
							</button>
						</>
					) : (
						<p className="text-sm text-pro-text-label">No chart data available</p>
					)}
				</div>
			) : showTreemap && treemapData.length > 0 ? (
				<Suspense fallback={<div className="min-h-[360px]" />}>
					<BuilderTreemapChart key={multi.id} data={treemapData} height="360px" onReady={handleChartReady} />
				</Suspense>
			) : (
				<Suspense fallback={<div className="min-h-[360px]" />}>
					<MultiSeriesChart
						dataset={chartView.dataset}
						charts={chartView.charts}
						valueSymbol={showPercentage ? '%' : allPercentMetrics ? '%' : allCountMetrics || allRatioMetrics ? '' : '$'}
						groupBy={
							multi.grouping === 'week'
								? 'weekly'
								: multi.grouping === 'month'
									? 'monthly'
									: multi.grouping === 'quarter'
										? 'quarterly'
										: multi.grouping === 'year'
											? 'yearly'
											: 'daily'
						}
						hideDataZoom
						hideDefaultLegend={false}
						solidChartAreaStyle={chartView.solidChartAreaStyle}
						exportButtons="hidden"
						onReady={handleChartReady}
						chartOptions={chartOptions}
					/>
				</Suspense>
			)}
			<ConfirmationModal
				isOpen={showDuplicateConfirm}
				onClose={() => setShowDuplicateConfirm(false)}
				onConfirm={() => handleDuplicateMultiChart(multi)}
				title="Duplicate Chart"
				message="Create a duplicate of this chart in the dashboard?"
				confirmText="Duplicate"
				cancelText="Cancel"
				confirmButtonClass="pro-btn-primary"
			/>
		</div>
	)
})

export default MultiChartCard
