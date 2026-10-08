import { lazy, Suspense } from 'react'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { Button } from '~/ui/Button'
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
						<div key={item.id} className="flex flex-col gap-1 rounded-md border border-subtle bg-surface p-2">
							<span className="truncate body-sm text-secondary">{series.name}</span>
							<div className="h-[120px]">
								{chartView.charts.length > 0 ? (
									<Suspense fallback={<div className="size-full animate-pulse rounded-sm bg-surface" />}>
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
									<div className="flex size-full flex-col items-center justify-center gap-1.5 body-sm text-tertiary">
										{item.hasError ? (
											<>
												<p role="alert" className="text-data-down">
													Couldn't load this series.
												</p>
												{item.canRetry ? (
													<Button
														type="button"
														size="sm"
														pendingLabel={item.isFetching ? 'Retrying…' : null}
														onClick={item.refetch}
													>
														Try again
													</Button>
												) : null}
											</>
										) : item.isLoading ? (
											'Loading chart data…'
										) : (
											'No data'
										)}
									</div>
								)}
							</div>
						</div>
					)
				})}
			</div>
			{hiddenCount > 0 ? <p className="body-sm text-tertiary">+{hiddenCount} more</p> : null}
		</div>
	)
}
