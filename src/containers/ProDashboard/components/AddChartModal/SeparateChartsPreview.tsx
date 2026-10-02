import { lazy, Suspense } from 'react'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import type { ChartRuntimeView } from '../../chartRuntime'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { DASHBOARD_CHART_GROUPING } from '../../utils'
import { buildComposerPreviewSeries, buildMultiChartSeriesView, getMultiChartGrouping } from '../multiChartSeries'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const MAX_PREVIEW_CARDS = 6

const CHART_OPTIONS = {
	xAxis: { show: false },
	yAxis: { show: false, min: undefined }
} satisfies MultiSeriesChartOptions

interface SeparateChartsPreviewProps {
	composerItems: Array<ChartRuntimeView>
}

export function SeparateChartsPreview({ composerItems }: SeparateChartsPreviewProps) {
	const { getProtocolInfo } = useProDashboardCatalog()
	const visibleItems = composerItems.slice(0, MAX_PREVIEW_CARDS)
	const hiddenCount = composerItems.length - visibleItems.length

	return (
		<div className="flex size-full flex-col gap-2 overflow-y-auto p-2">
			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{visibleItems.map((item, index) => {
					const grouping = getMultiChartGrouping([item], item.grouping) ?? 'day'
					const subject =
						item.subjectType === 'protocol' ? getProtocolInfo(item.protocol)?.name || item.protocol : item.chain
					const series = buildComposerPreviewSeries(item, grouping, subject, index)
					const chartView = buildMultiChartSeriesView({
						series: item.data.length > 0 ? [series] : [],
						showCumulative: false,
						showPercentage: false,
						stackSeries: false
					})
					return (
						<div
							key={item.id}
							className="flex flex-col gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-2"
						>
							<span className="truncate text-xs text-pro-text-secondary">{series.name}</span>
							<div className="h-[120px]">
								{chartView.charts.length > 0 ? (
									<Suspense fallback={<div className="size-full animate-pulse rounded-sm bg-pro-cards-bg" />}>
										<MultiSeriesChart
											dataset={chartView.dataset}
											charts={chartView.charts}
											groupBy={DASHBOARD_CHART_GROUPING[grouping]}
											hideDataZoom
											hideDefaultLegend
											exportButtons="hidden"
											height="120px"
											chartOptions={CHART_OPTIONS}
										/>
									</Suspense>
								) : (
									<div className="flex size-full items-center justify-center text-xs text-pro-text-tertiary">
										{item.isLoading ? 'Loading chart data…' : 'No data'}
									</div>
								)}
							</div>
						</div>
					)
				})}
			</div>
			{hiddenCount > 0 ? <p className="text-xs text-pro-text-tertiary">+{hiddenCount} more</p> : null}
		</div>
	)
}
