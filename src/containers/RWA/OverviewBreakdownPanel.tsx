import { lazy, Suspense, useDeferredValue, useMemo, type ReactNode } from 'react'
import { ChartCsvExportButton } from '~/components/ChartExport/ChartCsvExportButton'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { ChartRestoreButton } from '~/components/ChartExport/ChartRestoreButton'
import { buildTreemapCsvDataset } from '~/components/ECharts/TreemapChart/csv'
import { Select } from '~/components/Select/Select'
import { CHART_COLORS } from '~/constants/colors'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import type { IRWAAssetsOverview, RWAChartMetricKey } from './api.types'
import type { RwaChartAxis } from './chartBreakdown'
import { limitRwaHorizontalBarData } from './chartDataset'
import {
	getTreemapNestedByLabel,
	getTreemapNestedByOptions,
	type RWAChartView,
	type RwaTreemapNestedBy
} from './chartState'
import {
	useRWAAssetCategoryPieChartData,
	useRwaAssetGroupPieChartData,
	useRwaAssetNamePieChartData,
	useRwaAssetPlatformPieChartData,
	useRwaChainBreakdownPieChartData,
	limitRwaPieChartData
} from './hooks'
import type { getRankedRwaFilterValues } from './rankedFilterValues'
import {
	buildCompleteRwaTreemapTreeData,
	buildRwaNestedTreemapTreeData,
	buildRwaTreemapTreeData,
	canBuildRwaNestedTreemap
} from './treemap'

const PieChart = lazy(() => import('~/components/ECharts/PieChart'))
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart'))

const EMPTY_CHART_STACK_COLORS: Record<string, string> = {}
const EMPTY_HBAR_PRESENTATION = {
	categories: [] as Array<string>,
	values: [] as Array<number>,
	colors: [] as Array<string>
}
const pieChartRadius = ['50%', '70%'] as [string, string]
const pieChartLegendPosition = {
	left: 'center',
	top: 'bottom',
	orient: 'horizontal',
	formatter(name: string) {
		return name
	}
} as const
const pieChartLegendTextStyle = { fontSize: 14 }

export type RWAOverviewBreakdownPanelProps = {
	view: Exclude<RWAChartView, 'timeSeries' | 'share'>
	/** The axis the table's Group by maps to; the treemap nests below it. */
	axis: RwaChartAxis
	metric: RWAChartMetricKey
	metricLabel: string
	groupLabel: string
	exportTitle: string
	filenameSuffix: string
	treemapNestedBy: RwaTreemapNestedBy
	onTreemapNestedByChange: (nestedBy: RwaTreemapNestedBy) => void
	assets: IRWAAssetsOverview['assets']
	rankedFilterValues: ReturnType<typeof getRankedRwaFilterValues>
	selectedAssetNames: Array<string>
	selectedCategories: Array<string>
	isAssetGroupMode: boolean
	includeBridgeTvl: boolean
	/** The metric switch and the view select, shared with the time series panel. */
	toolbarStart: ReactNode
}

/** The pie, treemap and bar views of the overview chart, one slice per group of the table's Group by. */
export function RWAOverviewBreakdownPanel({
	view,
	axis,
	metric,
	metricLabel,
	groupLabel,
	exportTitle,
	filenameSuffix,
	treemapNestedBy,
	onTreemapNestedByChange,
	assets,
	rankedFilterValues,
	selectedAssetNames,
	selectedCategories,
	isAssetGroupMode,
	includeBridgeTvl,
	toolbarStart
}: RWAOverviewBreakdownPanelProps) {
	const { pieChartData: assetCategoryPieChartData, pieChartStackColors: assetCategoryPieChartStackColors } =
		useRWAAssetCategoryPieChartData({
			enabled: axis === 'category',
			assets,
			categories: rankedFilterValues.categories,
			selectedCategories,
			metric,
			includeBridgeTvl
		})

	const shouldBuildAssetNamePieChartData = axis === 'assetName'
	const { pieChartData: assetNamePieChartData, pieChartStackColors: assetNamePieChartStackColors } =
		useRwaAssetNamePieChartData({
			enabled: shouldBuildAssetNamePieChartData,
			assets,
			selectedAssetNames:
				isAssetGroupMode && shouldBuildAssetNamePieChartData
					? assets.map((asset) => asset.assetName || asset.ticker)
					: selectedAssetNames,
			metric,
			includeBridgeTvl
		})

	const { pieChartData: assetGroupPieChartData, pieChartStackColors: assetGroupPieChartStackColors } =
		useRwaAssetGroupPieChartData({
			enabled: axis === 'assetGroup',
			assets,
			metric,
			includeBridgeTvl
		})

	const { pieChartData: assetPlatformPieChartData, pieChartStackColors: assetPlatformPieChartStackColors } =
		useRwaAssetPlatformPieChartData({
			enabled: axis === 'platform',
			assets,
			metric,
			includeBridgeTvl
		})
	const { pieChartData: chainPieChartData, pieChartStackColors: chainPieChartStackColors } =
		useRwaChainBreakdownPieChartData({
			enabled: axis === 'chain',
			assets,
			metric,
			includeBridgeTvl
		})

	// Select pie chart breakdown based on route mode (same precedence as nav links).
	const { completePieChartData, pieChartStackColors } = useMemo(() => {
		switch (axis) {
			case 'chain':
				return {
					completePieChartData: chainPieChartData,
					pieChartStackColors: chainPieChartStackColors
				}
			case 'assetGroup':
				return {
					completePieChartData: assetGroupPieChartData,
					pieChartStackColors: assetGroupPieChartStackColors
				}
			case 'platform':
				return {
					completePieChartData: assetPlatformPieChartData,
					pieChartStackColors: assetPlatformPieChartStackColors
				}
			case 'assetName':
				return {
					completePieChartData: assetNamePieChartData,
					pieChartStackColors: assetNamePieChartStackColors
				}
			case 'category':
				return {
					completePieChartData: assetCategoryPieChartData,
					pieChartStackColors: assetCategoryPieChartStackColors
				}
			default:
				return assertNever(axis)
		}
	}, [
		assetGroupPieChartData,
		assetGroupPieChartStackColors,
		assetNamePieChartData,
		assetNamePieChartStackColors,
		assetPlatformPieChartData,
		assetPlatformPieChartStackColors,
		assetCategoryPieChartData,
		assetCategoryPieChartStackColors,
		axis,
		chainPieChartData,
		chainPieChartStackColors
	])
	const selectedPieChartData = useMemo(() => {
		const limit =
			axis === 'chain' ? 10 : axis === 'assetName' || axis === 'assetGroup' || axis === 'platform' ? 24 : null
		return limit == null ? completePieChartData : limitRwaPieChartData(completePieChartData, limit)
	}, [completePieChartData, axis])

	const { chartInstance: pieChartInstance, handleChartReady: handlePieChartReady } = useChartImageExport()
	const pieChartFilename = `rwa-pie-${filenameSuffix}`
	const { chartInstance: barChartInstance, handleChartReady: handleBarChartReady } = useChartImageExport()
	const barChartFilename = `rwa-bar-${filenameSuffix}`
	const { chartInstance: treemapChartInstance, handleChartReady: handleTreemapChartReady } = useChartImageExport()
	const treemapChartFilename = `rwa-treemap-${filenameSuffix}`

	const deferredSelectedPieChartData = useDeferredValue(selectedPieChartData)
	const valueSortedPieChartStackColors = useMemo(() => {
		if (view !== 'pie' && view !== 'hbar') return EMPTY_CHART_STACK_COLORS
		const stackColors: Record<string, string> = { ...pieChartStackColors }
		const sortedData: Array<{ name: string; value: number }> = []
		for (const item of deferredSelectedPieChartData) {
			if (item.value > 0) sortedData.push(item)
		}
		sortedData.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))

		for (const [index, item] of sortedData.entries()) {
			stackColors[item.name] = CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0]
		}

		return stackColors
	}, [view, pieChartStackColors, deferredSelectedPieChartData])
	const selectedBarChartPresentation = useMemo(() => {
		if (view !== 'hbar') return EMPTY_HBAR_PRESENTATION
		const rows = limitRwaHorizontalBarData(deferredSelectedPieChartData, { sort: true })
		const categories = new Array<string>(rows.length)
		const values = new Array<number>(rows.length)
		const colors = new Array<string>(rows.length)
		for (const [index, row] of rows.entries()) {
			categories[index] = row.name
			values[index] = row.value
			colors[index] = valueSortedPieChartStackColors[row.name] ?? '#1f77b4'
		}
		return { categories, values, colors }
	}, [view, deferredSelectedPieChartData, valueSortedPieChartStackColors])

	const chartBreakdownLabel = groupLabel
	const treemapNestedByOptions = getTreemapNestedByOptions(axis)
	const isNestedTreemapSupported = canBuildRwaNestedTreemap({
		parentGrouping: axis,
		childGrouping: treemapNestedBy
	})
	const treemapNestedByLabel = getTreemapNestedByLabel(treemapNestedBy)
	const treemapNestedBySwitch = (
		<Select
			allValues={treemapNestedByOptions}
			selectedValues={treemapNestedBy}
			setSelectedValues={(value: string) => {
				const selectedNestedBy = treemapNestedByOptions.find((option) => option.key === value)?.key
				if (!selectedNestedBy) throw new Error(`Unknown RWA treemap grouping: ${value}`)
				onTreemapNestedByChange(selectedNestedBy)
			}}
			label={`Nested by: ${treemapNestedByLabel}`}
			labelType="none"
			variant="filter"
			size="md"
		/>
	)

	const nestedTreemapTreeData = useMemo(() => {
		if (view !== 'treemap') return []
		if (!isNestedTreemapSupported) return []
		return buildRwaNestedTreemapTreeData({
			assets,
			metric,
			rootLabel: chartBreakdownLabel,
			parentGrouping: axis,
			childGrouping: treemapNestedBy,
			includeBridgeTvl
		})
	}, [view, metric, assets, chartBreakdownLabel, isNestedTreemapSupported, treemapNestedBy, axis, includeBridgeTvl])
	const treemapTreeData = useMemo(
		() =>
			nestedTreemapTreeData.length > 0
				? nestedTreemapTreeData
				: buildRwaTreemapTreeData(selectedPieChartData, chartBreakdownLabel),
		[chartBreakdownLabel, nestedTreemapTreeData, selectedPieChartData]
	)
	const nonTimeSeriesChartInstance =
		view === 'treemap' ? treemapChartInstance : view === 'hbar' ? barChartInstance : pieChartInstance
	const nonTimeSeriesChartFilename =
		view === 'treemap' ? treemapChartFilename : view === 'hbar' ? barChartFilename : pieChartFilename

	return (
		<ChartPanel className={view === 'treemap' ? undefined : 'min-h-[420px]'}>
			<ChartPanelToolbar className="justify-end">
				{toolbarStart}
				{view === 'treemap' ? treemapNestedBySwitch : null}
				{view === 'treemap' ? <ChartRestoreButton chartInstance={treemapChartInstance} /> : null}
				<ChartCsvExportButton
					chartInstance={nonTimeSeriesChartInstance}
					filename={nonTimeSeriesChartFilename}
					source={
						view === 'treemap'
							? {
									type: 'dataset',
									prepare: () =>
										buildTreemapCsvDataset(
											buildCompleteRwaTreemapTreeData({
												nestedTreeData: nestedTreemapTreeData,
												completePieData: completePieChartData,
												breakdownLabel: chartBreakdownLabel
											})
										)
								}
							: {
									type: 'dataset',
									prepare: () => ({
										dimensions: ['Name', 'Value'],
										source: completePieChartData.map(({ name, value }) => [name, value])
									})
								}
					}
				/>
				<ChartPngExportButton
					chartInstance={nonTimeSeriesChartInstance}
					filename={nonTimeSeriesChartFilename}
					title={exportTitle}
				/>
			</ChartPanelToolbar>
			<Suspense fallback={view === 'treemap' ? <div className="min-h-[600px]" /> : <ChartPanelBodyFallback />}>
				{view === 'pie' ? (
					<PieChart
						chartData={deferredSelectedPieChartData}
						stackColors={valueSortedPieChartStackColors}
						radius={pieChartRadius}
						legendPosition={pieChartLegendPosition}
						legendTextStyle={pieChartLegendTextStyle}
						onReady={handlePieChartReady}
					/>
				) : view === 'hbar' ? (
					<HBarChart
						categories={selectedBarChartPresentation.categories}
						values={selectedBarChartPresentation.values}
						colors={selectedBarChartPresentation.colors}
						valueSymbol="$"
						onReady={handleBarChartReady}
					/>
				) : (
					<TreemapChart
						treeData={treemapTreeData}
						variant="rwa"
						height="600px"
						onReady={handleTreemapChartReady}
						valueLabel={metricLabel}
					/>
				)}
			</Suspense>
		</ChartPanel>
	)
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}
