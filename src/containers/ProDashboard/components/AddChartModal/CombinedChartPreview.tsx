import { lazy, Suspense, useMemo } from 'react'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { LoadingSpinner } from '~/ui/Loaders'
import { Skeleton } from '~/ui/Skeleton'
import type { ChartRuntimeView } from '../../chartRuntime'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { getProDashboardChartTypeConfig } from '../../types'
import { DASHBOARD_CHART_GROUPING } from '../../utils'
import {
	buildComposerPreviewSeries,
	buildMultiChartSeriesView,
	getComposerGrouping,
	type MultiChartInputSeries
} from '../multiChartSeries'
import { useComposerSeriesColors } from './useComposerSeriesColors'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const CHART_OPTIONS = {
	xAxis: { show: true },
	yAxis: { show: true, min: undefined }
} satisfies MultiSeriesChartOptions

interface CombinedChartPreviewProps {
	composerItems: Array<ChartRuntimeView>
}

export function CombinedChartPreview({ composerItems }: CombinedChartPreviewProps) {
	const { getProtocolInfo } = useProDashboardCatalog()
	const colors = useComposerSeriesColors(composerItems, true)

	const previewGrouping = getComposerGrouping(composerItems)
	const chartView = useMemo(() => {
		const series: Array<MultiChartInputSeries> = []
		for (const item of composerItems) {
			if (item.data.length > 0) {
				const displayName =
					item.subjectType === 'protocol' ? getProtocolInfo(item.protocol)?.name || item.protocol : item.chain
				series.push(buildComposerPreviewSeries(item, previewGrouping, displayName, colors[item.id]))
			}
		}

		return buildMultiChartSeriesView({
			series,
			showCumulative: false,
			showPercentage: false,
			stackSeries: false
		})
	}, [getProtocolInfo, composerItems, previewGrouping, colors])

	const anyLoading = composerItems.some((item) => item.isLoading)

	if (chartView.charts.length === 0 && composerItems.length > 0) {
		return (
			<div className="flex size-full items-center justify-center">
				<div className="rounded-md border border-subtle bg-surface p-4 text-center">
					{anyLoading ? (
						<div className="flex flex-col items-center gap-2 text-tertiary">
							<LoadingSpinner size={20} />
							<p className="body-sm text-tertiary">Loading chart data…</p>
						</div>
					) : (
						<>
							<p className="mb-2 body-md text-secondary">Chart preview</p>
							<p className="body-sm text-tertiary">
								{composerItems.length} chart
								{composerItems.length > 1 ? 's' : ''} selected
							</p>
							<div className="mt-3 space-y-1">
								{composerItems.map((item) => (
									<div key={item.id} className="body-sm text-tertiary">
										• {item.subjectType === 'protocol' ? item.protocol : item.chain} -{' '}
										{getProDashboardChartTypeConfig(item.type)?.title || item.type}
									</div>
								))}
							</div>
						</>
					)}
				</div>
			</div>
		)
	}

	if (chartView.charts.length === 0) return null

	return (
		<div className="size-full">
			<Suspense fallback={<Skeleton className="h-[450px] w-full rounded-md" />}>
				<MultiSeriesChart
					dataset={chartView.dataset}
					charts={chartView.charts}
					groupBy={DASHBOARD_CHART_GROUPING[previewGrouping]}
					hideDataZoom
					hideDefaultLegend={false}
					exportButtons="hidden"
					height="450px"
					chartOptions={CHART_OPTIONS}
				/>
			</Suspense>
		</div>
	)
}
