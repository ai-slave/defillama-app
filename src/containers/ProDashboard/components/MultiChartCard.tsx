import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { CHART_INSET, CHART_LEGEND_RESERVE, chartGrid } from '~/components/ECharts/shared/chartSpacing'
import { Select } from '~/components/Select/Select'
import { getMetricUnitGroup } from '~/containers/ProDashboard/components/metricGroups'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { capitalizeFirstLetter } from '~/utils'
import { download } from '~/utils/download'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { useChartImageExport } from '../hooks/useChartImageExport'
import {
	useProDashboardCatalog,
	useProDashboardEditorActions,
	useProDashboardPermissions
} from '../ProDashboardAPIContext'
import { CHART_TYPES, limitMultiChartItems, type DashboardGrouping, type MultiChartConfig } from '../types'
import { generateChartColor } from '../utils'
import { COLOR_PALETTE_2, EXTENDED_COLOR_PALETTE } from '../utils/colorManager'
import { buildProTreemapData } from '../utils/treemap'
import { ConfirmationModal } from './ConfirmationModal'
import { buildMultiChartCsvRows, buildMultiChartSeriesView } from './multiChartSeries'
import { ProTableCSVButton } from './ProTable/CsvButton'

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

const MultiChartCard = memo(function MultiChartCard({ multi }: MultiChartCardProps) {
	const { getProtocolInfo, protocols } = useProDashboardCatalog()
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
	const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
	const showStacked = multi.showStacked !== false
	const showCumulative = multi.showCumulative || false
	const showPercentage = multi.showPercentage || false
	const showTreemap = multi.showTreemap || false
	const limitedItems = useMemo(() => limitMultiChartItems(multi.items), [multi.items])

	const validItems = useMemo(
		() =>
			limitedItems.filter((cfg) => {
				if (cfg.isLoading || cfg.hasError) return false
				return Boolean(cfg.data?.length)
			}),
		[limitedItems]
	)

	const failedItems = useMemo(
		() =>
			limitedItems.filter((cfg) => {
				if (cfg.isLoading) return false
				return cfg.hasError || !Array.isArray(cfg.data) || (Array.isArray(cfg.data) && cfg.data.length === 0)
			}),
		[limitedItems]
	)

	const loadingItems = useMemo(() => limitedItems.filter((cfg) => cfg.isLoading), [limitedItems])

	const colorContext = useMemo(() => {
		const uniqueChains = new Set<string | undefined>()
		const uniqueProtocols = new Set<string>()
		const itemIdsByProtocol = new Map<string, string[]>()
		const itemIdsByChain = new Map<string, string[]>()
		let onlyChains = true
		let onlyProtocols = true

		for (const item of validItems) {
			if (item.protocol) {
				onlyChains = false
				uniqueProtocols.add(item.protocol)
				const ids = itemIdsByProtocol.get(item.protocol)
				if (ids) ids.push(item.id)
				else itemIdsByProtocol.set(item.protocol, [item.id])
			} else {
				onlyProtocols = false
				uniqueChains.add(item.chain)
			}
			if (item.chain) {
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
			colorIndexByItemId.set(sortedItemIds[index], index)
		}

		return { isSingleChain, isSingleProtocol, colorIndexByItemId }
	}, [validItems])

	const baseSeries = useMemo(() => {
		const { isSingleChain, isSingleProtocol, colorIndexByItemId } = colorContext
		const colorIndexesTaken = new Set<number>()

		const getColorItemId = (item: (typeof validItems)[0]) => {
			if (isSingleProtocol) return `${item.chain}_${item.type}`
			else if (isSingleChain) return `${item.protocol}_${item.type}`
			else return `${item.chain}_${item.protocol}_${item.type}`
		}

		return validItems.map((cfg, index) => {
			const data = cfg.data!
			const meta = CHART_TYPES[cfg.type]
			const name = cfg.protocol
				? getProtocolInfo(cfg.protocol)?.name || cfg.protocol
				: cfg.chain ||
					(cfg.geckoId && protocols.find((protocol) => protocol.geckoId === cfg.geckoId)?.name) ||
					cfg.geckoId ||
					''

			const itemIdentifier = cfg.protocol || cfg.chain || 'unknown'
			const colorItemId = getColorItemId(cfg)

			let color =
				cfg.color ||
				(isSingleChain || isSingleProtocol
					? EXTENDED_COLOR_PALETTE[index % EXTENDED_COLOR_PALETTE.length]
					: generateChartColor(colorItemId, meta?.color || '#8884d8'))

			let colorIndex = colorIndexByItemId.get(itemIdentifier) ?? -1
			if (colorIndexesTaken.has(colorIndex)) {
				colorIndex = colorIndexByItemId.get(cfg.id) ?? -1
			}

			if (!cfg.color && colorIndex !== -1) {
				color = COLOR_PALETTE_2[colorIndex % COLOR_PALETTE_2.length]
				colorIndexesTaken.add(colorIndex)
			}

			return {
				name: `${name} ${meta?.title || capitalizeFirstLetter(cfg.type)}`,
				baseType: meta?.chartType as 'bar' | 'area' | 'line' | undefined,
				data,
				color,
				metricType: cfg.type
			}
		})
	}, [validItems, colorContext, getProtocolInfo, protocols])

	const chartTypeInfo = useMemo(() => {
		const uniqueTypes = new Set(validItems.map((item) => item.type))
		const allBarType =
			uniqueTypes.size === 1 &&
			validItems.every((item) => {
				const chartType = CHART_TYPES[item.type]
				return chartType?.chartType === 'bar'
			})
		const allAreaType =
			uniqueTypes.size === 1 &&
			validItems.every((item) => {
				const chartType = CHART_TYPES[item.type]
				return chartType?.chartType === 'area'
			})
		return { allBarType, allAreaType }
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
		const csvContent = buildMultiChartCsvRows(chartView)
			.map((row) => row.join(','))
			.join('\n')
		const fileName = `${multi.name || 'multi_chart'}_${new Date().toISOString().split('T')[0]}.csv`
		download(fileName, csvContent)
	}, [chartView, multi.name])

	const hasAnyData = validItems.length > 0
	const isAllLoading = loadingItems.length === limitedItems.length

	const uniqueMetricTypes = new Set(validItems.map((item) => item.type))
	const allPercentMetrics =
		baseSeries.length > 0 && baseSeries.every((series) => getMetricUnitGroup(series.metricType) === 'percent')
	const allCountMetrics =
		baseSeries.length > 0 && baseSeries.every((series) => getMetricUnitGroup(series.metricType) === 'count')
	const allRatioMetrics =
		baseSeries.length > 0 && baseSeries.every((series) => getMetricUnitGroup(series.metricType) === 'ratio')
	const hasMultipleUnitGroups = new Set(baseSeries.map((series) => getMetricUnitGroup(series.metricType))).size > 1
	const hasMultipleMetrics = uniqueMetricTypes.size > 1

	const allChartsGroupable = limitedItems.every((item) => {
		const chartType = CHART_TYPES[item.type]
		return chartType?.groupable === true
	})

	const allChartsAreBarType =
		!hasMultipleMetrics &&
		validItems.every((item) => {
			const chartType = CHART_TYPES[item.type]
			return chartType?.chartType === 'bar'
		})

	const allChartsAreAreaType =
		!hasMultipleMetrics &&
		validItems.every((item) => {
			const chartType = CHART_TYPES[item.type]
			return chartType?.chartType === 'area'
		})

	const canStack = allChartsAreBarType || allChartsAreAreaType

	const seriesCount = chartView.charts.length
	const chartOptions = useMemo(() => {
		const grid = chartGrid({ top: seriesCount > 5 ? 80 : CHART_LEGEND_RESERVE })
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
		if (hasMultipleUnitGroups) return { yAxis: { min: undefined, max: undefined }, grid, legend }

		if (allPercentMetrics) {
			return {
				yAxis: {
					max: undefined,
					min: undefined,
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
					max: undefined,
					min: undefined,
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
				max: undefined,
				min: undefined,
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

				{!isReadOnly && hasAnyData && !hasMultipleMetrics && allChartsAreBarType ? (
					<Select
						size="sm"
						allValues={CUMULATIVE_DISPLAY_OPTIONS}
						selectedValues={showCumulative ? 'Cumulative' : 'Individual'}
						setSelectedValues={(value) => {
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
						setSelectedValues={(value) => {
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
						setSelectedValues={(value) => {
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
						setSelectedValues={(value) => {
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
						<ProTableCSVButton
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

			{!hasAnyData && isAllLoading ? (
				<div className="flex flex-1 flex-col items-center justify-center">
					<div className="mx-auto mb-2 size-8 animate-spin rounded-full border-b-2 border-brand"></div>
					<p className="text-sm text-pro-text-form">Loading charts...</p>
				</div>
			) : !hasAnyData ? (
				<div className="flex flex-1 flex-col items-center justify-center">
					<Icon name="alert-triangle" height={24} width={24} className="mx-auto mb-2 text-error" />
					<p className="text-sm text-pro-text-label">Failed to load chart data</p>
					<p className="mt-1 text-xs text-pro-text-form">
						{failedItems.length} of {limitedItems.length} charts failed
					</p>
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
