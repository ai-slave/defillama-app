import { lazy, Suspense, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import type { TreemapChartProps } from '~/components/ECharts/TreemapChart/types'
import { CHART_COLORS } from '~/constants/colors'
import { isRwaTotalSeriesLabel } from '~/containers/RWA/chartAggregation'
import { toFiniteRwaChartValue, toRwaMultiSeriesChartDataset } from '~/containers/RWA/chartDataset'
import { getChartMetricLabel } from '~/containers/RWA/chartState'
import { buildRwaTreemapTreeData } from '~/containers/RWA/treemap'
import { useChartImageExport } from '../hooks/useChartImageExport'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import type { RWAOverviewChartConfig, RWAOverviewChartBreakdown } from '../types'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { useRWABreakdownChartData } from './datasets/RWADataset/useRWAChartData'
import { LoadingSpinner } from './LoadingSpinner'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart')) as React.FC<TreemapChartProps>

const BREAKDOWN_LABELS: Record<RWAOverviewChartBreakdown, string> = {
	chain: 'Chain',
	category: 'Category',
	assetClass: 'Asset Class',
	assetName: 'Asset Name',
	platform: 'Platform',
	assetGroup: 'Asset Group'
}

const VIEW_LABELS: Record<string, string> = {
	timeSeries: 'Time Series',
	pie: 'Pie',
	treemap: 'Treemap',
	hbar: 'HBar'
}

interface RWAOverviewChartCardProps {
	config: RWAOverviewChartConfig
}

export function RWAOverviewChartCard({ config }: RWAOverviewChartCardProps) {
	const { metric, chartView, breakdown, chain } = config
	const { chartInstance, handleChartReady } = useChartImageExport()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const { chartDataset: rawDataset, isLoading } = useRWABreakdownChartData(breakdown, metric, chain)

	const chartDataset = useMemo(() => {
		if (!rawDataset) return null
		const dataset = toRwaMultiSeriesChartDataset(rawDataset)
		if (!timePeriod || timePeriod === 'all') return dataset
		return filterChartDatasetByTimePeriod(dataset, timePeriod, customTimePeriod)
	}, [rawDataset, timePeriod, customTimePeriod])

	const metricLabel = getChartMetricLabel(metric as any)
	const breakdownLabel = BREAKDOWN_LABELS[breakdown] || breakdown
	const chainLabel = chain ? chain : 'All Chains'
	const viewLabel = VIEW_LABELS[chartView] || chartView
	const imageTitle = `RWA ${metricLabel} - ${chainLabel} by ${breakdownLabel}`
	const imageFilename = `rwa-${chain || 'all'}-${metric}-${breakdown}-${chartView}`

	const pieData = useMemo(() => {
		if (!chartDataset || chartView !== 'pie') return []
		const lastRow = chartDataset.source[chartDataset.source.length - 1]
		if (!lastRow) return []
		const items: Array<{ name: string; value: number }> = []
		for (let dimensionIndex = 1; dimensionIndex < chartDataset.dimensions.length; dimensionIndex++) {
			const dimension = chartDataset.dimensions[dimensionIndex]
			const value = toFiniteRwaChartValue(lastRow[dimensionIndex])
			if (value > 0) items.push({ name: dimension, value })
		}
		items.sort((a, b) => b.value - a.value)
		return items
	}, [chartDataset, chartView])

	const pieColors = useMemo(() => {
		const colors: Record<string, string> = {}
		for (const [idx, item] of pieData.entries()) {
			colors[item.name] = CHART_COLORS[idx % CHART_COLORS.length]
		}
		return colors
	}, [pieData])

	const barData = useMemo(() => {
		if (!chartDataset || chartView !== 'hbar') return { categories: [] as string[], values: [] as number[] }
		const lastRow = chartDataset.source[chartDataset.source.length - 1]
		if (!lastRow) return { categories: [] as string[], values: [] as number[] }
		const items: Array<{ name: string; value: number }> = []
		for (let dimensionIndex = 1; dimensionIndex < chartDataset.dimensions.length; dimensionIndex++) {
			const dimension = chartDataset.dimensions[dimensionIndex]
			const value = toFiniteRwaChartValue(lastRow[dimensionIndex])
			if (value > 0) items.push({ name: dimension, value })
		}
		items.sort((a, b) => b.value - a.value)
		if (items.length > 20) items.length = 20
		return { categories: items.map((i) => i.name), values: items.map((i) => i.value) }
	}, [chartDataset, chartView])

	const treemapData = useMemo(() => {
		if (!chartDataset || chartView !== 'treemap') return []
		const lastRow = chartDataset.source[chartDataset.source.length - 1]
		if (!lastRow) return []
		const pieItems: Array<{ name: string; value: number }> = []
		for (let dimensionIndex = 1; dimensionIndex < chartDataset.dimensions.length; dimensionIndex++) {
			const dimension = chartDataset.dimensions[dimensionIndex]
			const value = toFiniteRwaChartValue(lastRow[dimensionIndex])
			if (value > 0) pieItems.push({ name: dimension, value })
		}
		return buildRwaTreemapTreeData(pieItems, breakdownLabel)
	}, [chartDataset, chartView, breakdownLabel])

	if (isLoading) {
		return (
			<div className="flex h-full min-h-[360px] items-center justify-center">
				<LoadingSpinner />
			</div>
		)
	}

	const hasData = chartDataset && chartDataset.source.length > 0

	return (
		<div className="flex h-full flex-col p-2">
			<div className="mb-2 flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<h3 className="text-sm font-semibold text-pro-text-primary">
						RWA {metricLabel} - {viewLabel}
					</h3>
					<p className="text-xs text-pro-text-secondary">
						{chainLabel}
						{!chain ? ` by ${breakdownLabel}` : ''}
					</p>
				</div>
				{hasData && chartView !== 'pie' ? (
					<ChartPngExportButton chartInstance={chartInstance} filename={imageFilename} title={imageTitle} smol />
				) : null}
			</div>
			<div className="flex-1" key={`${chartView}-${breakdown}-${metric}`}>
				<Suspense
					fallback={
						<div className="flex h-[320px] items-center justify-center">
							<LoadingSpinner />
						</div>
					}
				>
					{chartView === 'timeSeries' && chartDataset ? (
						<MultiSeriesChart
							dataset={chartDataset}
							hideDefaultLegend={false}
							stacked
							showTotalInTooltip={!chartDataset.dimensions.some(isRwaTotalSeriesLabel)}
							onReady={handleChartReady}
						/>
					) : chartView === 'pie' && pieData.length > 0 ? (
						<PieChart chartData={pieData} stackColors={pieColors} />
					) : chartView === 'hbar' && barData.categories.length > 0 ? (
						<HBarChart
							categories={barData.categories}
							values={barData.values}
							valueSymbol="$"
							onReady={handleChartReady}
						/>
					) : chartView === 'treemap' && treemapData.length > 0 ? (
						<TreemapChart
							treeData={treemapData}
							variant="rwa"
							height="320px"
							onReady={handleChartReady}
							valueLabel={metricLabel}
						/>
					) : (
						<div className="flex h-[320px] items-center justify-center text-sm text-pro-text-secondary">
							No data available
						</div>
					)}
				</Suspense>
			</div>
		</div>
	)
}
