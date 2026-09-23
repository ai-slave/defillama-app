import { lazy, Suspense, useMemo } from 'react'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { LoadingSpinner } from '~/ui/Loaders'
import type { ChartRuntimeView } from '../../chartRuntime'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { getProDashboardChartTypeConfig } from '../../types'
import { DASHBOARD_CHART_GROUPING } from '../../utils'
import { EXTENDED_COLOR_PALETTE, getPaletteColor } from '../../utils/colorManager'
import { buildMultiChartSeriesView, getComposerGrouping, type MultiChartInputSeries } from '../multiChartSeries'

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

	const chartView = useMemo(() => {
		const series: Array<MultiChartInputSeries> = []
		let colorIndex = 0

		for (const item of composerItems) {
			if (item.data.length > 0) {
				const meta = getProDashboardChartTypeConfig(item.type)
				const displayName =
					item.subjectType === 'protocol' ? getProtocolInfo(item.protocol)?.name || item.protocol : item.chain

				series.push({
					name: `${displayName} ${meta?.title || item.type}`,
					baseType:
						meta?.chartType === 'bar' || meta?.chartType === 'area' || meta?.chartType === 'line'
							? meta.chartType
							: undefined,
					data: item.data,
					color: item.color || getPaletteColor(EXTENDED_COLOR_PALETTE, colorIndex),
					metricType: item.type
				})
				colorIndex++
			}
		}

		return buildMultiChartSeriesView({
			series,
			showCumulative: false,
			showPercentage: false,
			stackSeries: false
		})
	}, [getProtocolInfo, composerItems])

	const previewGrouping = getComposerGrouping(composerItems)
	const anyLoading = composerItems.some((item) => item.isLoading)

	if (chartView.charts.length === 0 && composerItems.length > 0) {
		return (
			<div className="flex size-full items-center justify-center">
				<div className="rounded-md border border-pro-cards-border bg-pro-cards-bg p-4 text-center">
					{anyLoading ? (
						<div className="flex flex-col items-center gap-2 text-pro-text-tertiary">
							<LoadingSpinner size={20} />
							<p className="text-xs text-pro-text-tertiary">Loading chart data…</p>
						</div>
					) : (
						<>
							<p className="mb-2 text-sm text-pro-text-secondary">Chart Preview</p>
							<p className="text-xs text-pro-text-tertiary">
								{composerItems.length} chart
								{composerItems.length > 1 ? 's' : ''} selected
							</p>
							<div className="mt-3 space-y-1">
								{composerItems.map((item) => (
									<div key={item.id} className="text-xs text-pro-text-tertiary">
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
			<Suspense
				fallback={
					<div className="h-[450px] w-full animate-pulse rounded-md border border-pro-cards-border bg-pro-cards-bg" />
				}
			>
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
