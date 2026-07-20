import { lazy, Suspense, useMemo } from 'react'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { CHART_TYPES, type ChartConfig, type DashboardGrouping } from '../../types'
import { EXTENDED_COLOR_PALETTE } from '../../utils/colorManager'
import { buildMultiChartSeriesView, type MultiChartInputSeries } from '../multiChartSeries'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

const CHART_OPTIONS = {
	xAxis: { show: true },
	yAxis: { show: true, min: undefined, max: undefined }
}

interface CombinedChartPreviewProps {
	composerItems: ChartConfig[]
}

const mapGroupingToGroupBy = (grouping: DashboardGrouping): 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' => {
	if (grouping === 'week') return 'weekly'
	if (grouping === 'month') return 'monthly'
	if (grouping === 'quarter') return 'quarterly'
	if (grouping === 'year') return 'yearly'
	return 'daily'
}

export function CombinedChartPreview({ composerItems }: CombinedChartPreviewProps) {
	const { getProtocolInfo, protocols } = useProDashboardCatalog()

	const previewGrouping = useMemo<DashboardGrouping>(() => {
		const definedGroupings = composerItems
			.map((item) => item.grouping)
			.filter((grouping): grouping is NonNullable<typeof grouping> => Boolean(grouping))

		if (definedGroupings.length === 0) {
			return 'day'
		}

		const [firstGrouping] = definedGroupings
		const allMatch = definedGroupings.every((grouping) => grouping === firstGrouping)

		return allMatch ? firstGrouping : 'day'
	}, [composerItems])

	const chartView = useMemo(() => {
		const series: MultiChartInputSeries[] = []
		let colorIndex = 0

		for (const item of composerItems) {
			if (item.data?.length) {
				const meta = CHART_TYPES[item.type]
				const displayName = item.protocol
					? getProtocolInfo(item.protocol)?.name || item.protocol
					: item.chain ||
						(item.geckoId && protocols.find((protocol) => protocol.geckoId === item.geckoId)?.name) ||
						item.geckoId ||
						''

				if (item.data.length > 0) {
					series.push({
						name: `${displayName} ${meta?.title || item.type}`,
						baseType: meta?.chartType as MultiChartInputSeries['baseType'],
						data: item.data,
						color: item.color || EXTENDED_COLOR_PALETTE[colorIndex % EXTENDED_COLOR_PALETTE.length],
						metricType: item.type
					})
					colorIndex++
				}
			}
		}

		return buildMultiChartSeriesView({
			series,
			showCumulative: false,
			showPercentage: false,
			stackSeries: false
		})
	}, [getProtocolInfo, protocols, composerItems])

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
								{composerItems.length} chart{composerItems.length > 1 ? 's' : ''} selected
							</p>
							<div className="mt-3 space-y-1">
								{composerItems.map((item) => (
									<div key={item.id} className="text-xs text-pro-text-tertiary">
										• {item.protocol || item.chain} - {CHART_TYPES[item.type]?.title || item.type}
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
					<div className="h-[450px] w-full animate-pulse rounded-md border border-pro-cards-border bg-pro-cards-bg"></div>
				}
			>
				<MultiSeriesChart2
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
