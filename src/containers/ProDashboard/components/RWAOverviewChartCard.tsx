import { lazy, Suspense, useMemo } from 'react'
import { ChartPngExportButton } from '~/components/ChartExport/ChartPngExportButton'
import { CHART_COLORS } from '~/constants/colors'
import { isRwaTotalSeriesLabel } from '~/containers/RWA/chartAggregation'
import { getChartMetricLabel } from '~/containers/RWA/chartState'
import { useChartImageExport } from '~/hooks/useChartImageExport'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import type { RWAOverviewChartConfig, RWAOverviewChartBreakdown } from '../types'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { useRWABreakdownChartData } from './datasets/RWADataset/useRWAChartData'
import { LoadingSpinner } from './LoadingSpinner'
import {
	buildRwaSnapshotPresentation,
	hasRwaOverviewChartExportData,
	type RwaSnapshotPresentation
} from './rwaSnapshot'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const PieChart = lazy(() => import('~/components/ECharts/PieChart'))
const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))
const TreemapChart = lazy(() => import('~/components/ECharts/TreemapChart'))

const EMPTY_RWA_SNAPSHOT_ITEMS: Array<{ name: string; value: number }> = []
const EMPTY_RWA_BAR_DATA: Extract<RwaSnapshotPresentation, { view: 'hbar' }> = {
	view: 'hbar',
	categories: [],
	values: []
}

const BREAKDOWN_LABELS: Record<RWAOverviewChartBreakdown, string> = {
	chain: 'Chain',
	category: 'Category',
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

	const timeSeriesDataset = useMemo(() => {
		if (!rawDataset || chartView !== 'timeSeries') return null
		if (!timePeriod || timePeriod === 'all') return rawDataset
		return filterChartDatasetByTimePeriod(rawDataset, timePeriod, customTimePeriod)
	}, [chartView, customTimePeriod, rawDataset, timePeriod])

	const metricLabel = getChartMetricLabel(metric)
	const breakdownLabel = BREAKDOWN_LABELS[breakdown]
	const chainLabel = chain ? chain : 'All Chains'
	const viewLabel = VIEW_LABELS[chartView] || chartView
	const imageTitle = `RWA ${metricLabel} - ${chainLabel} by ${breakdownLabel}`
	const imageFilename = `rwa-${chain || 'all'}-${metric}-${breakdown}-${chartView}`

	const snapshot = useMemo(
		() =>
			rawDataset && chartView !== 'timeSeries'
				? buildRwaSnapshotPresentation({
						dataset: rawDataset,
						view: chartView,
						timePeriod,
						customTimePeriod,
						breakdownLabel
					})
				: null,
		[breakdownLabel, chartView, customTimePeriod, rawDataset, timePeriod]
	)
	const pieData = snapshot?.view === 'pie' ? snapshot.data : EMPTY_RWA_SNAPSHOT_ITEMS

	const pieColors = useMemo(() => {
		const colors: Record<string, string> = {}
		for (const [idx, item] of pieData.entries()) {
			const color = CHART_COLORS[idx % CHART_COLORS.length]
			if (color === undefined) throw new Error(`Missing RWA chart color at index ${idx}`)
			colors[item.name] = color
		}
		return colors
	}, [pieData])

	const barData = snapshot?.view === 'hbar' ? snapshot : EMPTY_RWA_BAR_DATA
	const treemapData = snapshot?.view === 'treemap' ? snapshot.data : []

	if (isLoading) {
		return (
			<div className="flex h-full min-h-[360px] items-center justify-center">
				<LoadingSpinner />
			</div>
		)
	}

	const hasExportData = hasRwaOverviewChartExportData(chartView, timeSeriesDataset, snapshot)

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
				{hasExportData ? (
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
					{chartView === 'timeSeries' && timeSeriesDataset ? (
						<MultiSeriesChart
							dataset={timeSeriesDataset}
							hideDefaultLegend={false}
							stacked
							showTotalInTooltip={!timeSeriesDataset.dimensions.some(isRwaTotalSeriesLabel)}
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
