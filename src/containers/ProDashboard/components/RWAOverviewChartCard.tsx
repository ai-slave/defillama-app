import { lazy, type ReactNode, Suspense, useMemo } from 'react'
import { preparePieChartData } from '~/components/ECharts/PieChart/data'
import { CHART_SERIES_LIMIT } from '~/constants/colors'
import { isRwaTotalSeriesLabel } from '~/containers/RWA/chartAggregation'
import { getChartMetricLabel } from '~/containers/RWA/chartState'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { useProDashboardTime } from '../ProDashboardAPIContext'
import type { RWAOverviewChartBreakdown, RWAOverviewChartConfig } from '../types'
import { ProMeta } from '../ui'
import { scaledPx, useCardHeightScale } from './cardHeightContext'
import { prepareProChartCsv } from './chartCsv'
import { filterChartDatasetByTimePeriod } from './datasets/filterChartDataset'
import { useRWABreakdownChartData } from './datasets/RWADataset/useRWAChartData'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'
import {
	buildRwaSnapshotCsvRows,
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
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const { timePeriod, customTimePeriod } = useProDashboardTime()
	const chartRead = useRWABreakdownChartData(breakdown, metric, chain)
	const { chartDataset: rawDataset, isLoading, readFailed } = chartRead

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

	// The CSV keeps every group; the pie folds past the series cap.
	const pieChartData = useMemo(() => preparePieChartData({ data: pieData, limit: CHART_SERIES_LIMIT }), [pieData])

	const barData = snapshot?.view === 'hbar' ? snapshot : EMPTY_RWA_BAR_DATA
	const cardHeightScale = useCardHeightScale()
	const chartHeight = scaledPx(320, cardHeightScale)
	const treemapData = snapshot?.view === 'treemap' ? snapshot.data : []

	const title = `RWA ${metricLabel} - ${viewLabel}`
	const subtitle = <ProMeta items={[chainLabel, chain ? null : `by ${breakdownLabel}`]} />

	const renderStatusShell = (status: ReactNode) => (
		<div className="flex h-full min-h-[calc(360px*var(--card-scale,1))] flex-col p-0">
			<ProCardHeader titleAs="h3" title={title} subtitle={subtitle} />
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3" style={{ minHeight: chartHeight }}>
				{status}
			</div>
		</div>
	)

	if (readFailed && rawDataset === null) {
		return renderStatusShell(<ProCardError retry={chartRead} />)
	}

	if (isLoading) {
		return renderStatusShell(<ProCardLoading />)
	}

	const hasExportData = hasRwaOverviewChartExportData(chartView, timeSeriesDataset, snapshot)

	return (
		<div className="flex h-full flex-col p-0">
			{readFailed ? <ProCardRefreshFailed retry={chartRead} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={title}
				subtitle={subtitle}
				menu={
					hasExportData
						? {
								image: { chartInstance, filename: imageFilename, title: imageTitle },
								csv: {
									prepareCsv: () =>
										timeSeriesDataset
											? prepareProChartCsv(timeSeriesDataset, imageFilename)
											: {
													filename: imageFilename,
													rows: buildRwaSnapshotCsvRows(snapshot, breakdownLabel, metricLabel)
												}
								}
							}
						: {}
				}
			/>
			<div className="flex-1 px-3 pb-3" key={`${chartView}-${breakdown}-${metric}`}>
				<Suspense
					fallback={
						<div className="flex h-[calc(320px*var(--card-scale,1))] items-center justify-center">
							<ProCardLoading />
						</div>
					}
				>
					{chartView === 'timeSeries' && timeSeriesDataset ? (
						<MultiSeriesChart
							height={chartHeight}
							dataset={timeSeriesDataset}
							showLegend
							stacked
							showTotalInTooltip={!timeSeriesDataset.dimensions.some(isRwaTotalSeriesLabel)}
							onReady={handleChartReady}
						/>
					) : chartView === 'pie' && pieData.length > 0 ? (
						<PieChart onReady={handleChartReady} chartData={pieChartData} height={chartHeight} />
					) : chartView === 'hbar' && barData.categories.length > 0 ? (
						<HBarChart
							categories={barData.categories}
							values={barData.values}
							valueSymbol="$"
							height={chartHeight}
							onReady={handleChartReady}
						/>
					) : chartView === 'treemap' && treemapData.length > 0 ? (
						<TreemapChart
							treeData={treemapData}
							variant="rwa"
							height={chartHeight}
							onReady={handleChartReady}
							valueLabel={metricLabel}
						/>
					) : (
						<div className="flex h-[calc(320px*var(--card-scale,1))] flex-col justify-center">
							<ProCardEmpty message="No data available" />
						</div>
					)}
				</Suspense>
			</div>
		</div>
	)
}
