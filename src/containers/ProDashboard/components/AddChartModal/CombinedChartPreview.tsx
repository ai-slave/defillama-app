import { lazy, Suspense, useMemo } from 'react'
import type { MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import type { ChartRuntimeView } from '../../chartRuntime'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { type DashboardGrouping, getProDashboardChartTypeConfig } from '../../types'
import { EXTENDED_COLOR_PALETTE, getPaletteColor } from '../../utils/colorManager'
import { buildMultiChartSeriesView, type MultiChartInputSeries } from '../multiChartSeries'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const CHART_OPTIONS = {
	xAxis: { show: true },
	yAxis: { show: true, min: undefined }
} satisfies MultiSeriesChartOptions

interface CombinedChartPreviewProps {
	composerItems: Array<ChartRuntimeView>
}

const mapGroupingToGroupBy = (grouping: DashboardGrouping): 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' => {
	if (grouping === 'week') return 'weekly'
	if (grouping === 'month') return 'monthly'
	if (grouping === 'quarter') return 'quarterly'
	if (grouping === 'year') return 'yearly'
	return 'daily'
}

export function CombinedChartPreview({ composerItems }: CombinedChartPreviewProps) {
	const { getProtocolInfo } = useProDashboardCatalog()

	const previewGrouping = useMemo<DashboardGrouping>(() => {
		let grouping: DashboardGrouping | undefined
		for (const item of composerItems) {
			if (item.grouping === undefined) continue
			if (grouping === undefined) grouping = item.grouping
			else if (grouping !== item.grouping) return 'day'
		}
		return grouping ?? 'day'
	}, [composerItems])

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

	const anyLoading = composerItems.some((item) => item.isLoading)

	if (chartView.charts.length === 0 && composerItems.length > 0) {
		return (
			<div className="flex size-full items-center justify-center">
				<div className="rounded-md border border-pro-cards-border bg-pro-cards-bg p-4 text-center">
					{anyLoading ? (
						<>
							<svg className="mx-auto mb-2 size-5 animate-spin text-pro-text-tertiary" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
							<p className="text-xs text-pro-text-tertiary">Loading chart data…</p>
						</>
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
					groupBy={mapGroupingToGroupBy(previewGrouping)}
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
