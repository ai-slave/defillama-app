import type { UseQueryResult } from '@tanstack/react-query'
import { lazy, Suspense, useMemo } from 'react'
import type { IMultiSeriesChartProps, MultiSeriesChartOptions } from '~/components/ECharts/MultiSeriesChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import {
	getPointedSeriesName,
	getTooltipAxisValue,
	getTooltipRawYValue,
	normalizeTooltipItems,
	TOOLTIP_POINTED_ROW_STYLE
} from '~/components/ECharts/shared/tooltip'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { SurfaceBodyStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { formatCompactNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import { buildApiUsageChartData, rankRoutesByTotal } from './apiUsageChart'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

export interface ApiUsageStats {
	windowDays?: number
	/** Client receive time (ms). The chart window ends on this day, so render never reads the clock. */
	fetchedAt: number
	stats: Array<{
		date: string
		totalRequests: number
		routes?: Record<string, number>
	}>
}

const DEFAULT_WINDOW_DAYS = 30
// ECharts draws to canvas and cannot read var(), so the chrome colours are literal. Only the split lines and the
// axis differ between themes.
const LIGHT_CHART_COLORS = {
	split: 'rgba(0, 0, 0, 0.06)',
	muted: '#878787',
	axis: '#ced8e6',
	tooltipBg: '#131516',
	tooltipBorder: '#2f3336'
}
const DARK_CHART_COLORS = {
	...LIGHT_CHART_COLORS,
	split: 'rgba(255, 255, 255, 0.06)',
	axis: '#2f3336'
}

function useChartSource(usageStats: ApiUsageStats | null | undefined) {
	const sortedStats = useMemo(
		() => (usageStats?.stats ?? []).toSorted((a, b) => Date.parse(a.date) - Date.parse(b.date)),
		[usageStats?.stats]
	)

	const totalRequests = useMemo(() => sortedStats.reduce((sum, day) => sum + day.totalRequests, 0), [sortedStats])

	const windowDays = usageStats?.windowDays ?? DEFAULT_WINDOW_DAYS

	// The stats are sparse (days without requests are omitted) while the chart and the
	// "Last N days" label cover the full window, so the average uses the window too.
	const averageRequests = useMemo(() => {
		if (sortedStats.length === 0 || windowDays <= 0) return 0
		return Math.round(totalRequests / windowDays)
	}, [sortedStats.length, totalRequests, windowDays])
	const routeSeries = useMemo(() => rankRoutesByTotal(sortedStats), [sortedStats])

	return { sortedStats, totalRequests, averageRequests, windowDays, routeSeries }
}

export function ApiUsageBreakdown({ usageStatsQuery }: { usageStatsQuery: UseQueryResult<ApiUsageStats | null> }) {
	const usageStats = usageStatsQuery.data
	const [isDark] = useDarkModeManager()
	const activeColors = isDark ? DARK_CHART_COLORS : LIGHT_CHART_COLORS

	const { sortedStats, totalRequests, averageRequests, windowDays, routeSeries } = useChartSource(usageStats)
	const { activeSeries, setSelectedSeries } = useLocalSelection({
		allowEmptySelection: true,
		availableSeries: routeSeries,
		scope: String(windowDays)
	})
	const { dataset, charts } = buildApiUsageChartData(
		sortedStats,
		windowDays,
		routeSeries,
		activeSeries,
		usageStats?.fetchedAt ?? null
	)
	const renderedCharts = useMemo(() => new Set(charts.map((chart) => chart.name)), [charts])

	const hasData = sortedStats.length > 0
	const totalLabel = hasData
		? formatCompactNumber(totalRequests, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		: '--'
	const avgLabel = hasData
		? formatCompactNumber(averageRequests, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		: '--'

	const chartOptions = useMemo<MultiSeriesChartOptions>(
		() => ({
			graphic: [],
			grid: {
				top: 10,
				right: 0,
				bottom: 0,
				left: 0
			},
			xAxis: {
				axisLabel: { color: activeColors.muted, fontSize: 10 },
				axisLine: { lineStyle: { color: activeColors.axis } },
				axisTick: { show: false }
			},
			yAxis: {
				axisLabel: { color: activeColors.muted, fontSize: 10 },
				axisLine: { show: false },
				splitLine: { lineStyle: { color: activeColors.split } }
			},
			legend: {
				show: false
			},
			tooltip: {
				trigger: 'axis',
				backgroundColor: activeColors.tooltipBg,
				borderColor: activeColors.tooltipBorder,
				borderWidth: 1,
				extraCssText: `box-shadow: 0 4px 12px rgba(0,0,0,0.3);`,
				textStyle: { color: '#fff', fontSize: 12 },
				formatter: (params: unknown) => {
					const list = normalizeTooltipItems(params)
					if (list.length === 0) return ''

					const dateKey = getTooltipAxisValue(list[0])
					const dateLabel = Number.isFinite(dateKey) ? formatTooltipChartDate(dateKey, 'daily') : ''

					const items: Array<{ name: string; value: number; marker: string }> = []
					let total = 0
					for (const item of list) {
						const name = item.seriesName ?? ''
						const val = Number(getTooltipRawYValue(item, name) ?? 0)
						total += val
						if (!Number.isFinite(val) || val <= 0) continue
						items.push({ name, value: val, marker: item.marker ?? '' })
					}
					items.sort((a, b) => b.value - a.value)

					const pointedName = getPointedSeriesName(list)
					let pointedRow = ''
					let rows = ''
					for (const item of items) {
						const row = `${item.marker}${escapeHtml(item.name)}&nbsp;&nbsp;<b>${formatCompactNumber(item.value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</b>`
						if (item.name === pointedName) pointedRow = `<li style="${TOOLTIP_POINTED_ROW_STYLE}">${row}</li>`
						else rows += `<li style="list-style:none;padding:1px 0">${row}</li>`
					}
					const totalRow = `<li style="list-style:none;padding:2px 0 0;border-top:1px solid ${activeColors.axis};margin-top:4px;font-weight:600">Total&nbsp;&nbsp;${formatCompactNumber(total, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</li>`

					return `<div><div style="margin-bottom:6px;font-weight:500">${dateLabel}</div><ul style="margin:0;padding:0">${pointedRow}${rows}${totalRow}</ul></div>`
				}
			}
		}),
		[activeColors]
	)

	return (
		<div className="flex flex-col gap-4 rounded-lg bg-surface-elevated-1 p-3">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<span className="body-md text-primary">API usage breakdown</span>
					<span className="body-sm text-tertiary">Last {windowDays} days</span>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-3">
					{hasData && routeSeries.length > 1 ? (
						<SelectWithCombobox
							allValues={routeSeries}
							selectedValues={activeSeries}
							setSelectedValues={setSelectedSeries}
							label="Route"
							labelType="smol"
							variant="filter"
							size="sm"
						/>
					) : null}
					<div className="flex flex-col items-end">
						<span className="title-md text-primary">{totalLabel}</span>
						<span className="body-xs text-tertiary">Total requests</span>
					</div>
					<div className="flex flex-col items-end">
						<span className="title-md text-primary">{avgLabel}</span>
						<span className="body-xs text-tertiary">Avg/day</span>
					</div>
				</div>
			</div>

			{/* Legend */}
			{hasData && charts.length > 0 && (
				<div className="flex flex-wrap gap-x-4 gap-y-1">
					{charts
						.filter((series) => renderedCharts.has(series.name))
						.map((series) => (
							<div key={series.name} className="flex items-center gap-1.5">
								<span className="inline-block size-2 rounded-full" style={{ backgroundColor: series.color }} />
								<span className="body-xs text-tertiary">{series.name}</span>
							</div>
						))}
				</div>
			)}

			{/* Chart */}
			{queryReadFailed(usageStatsQuery) ? (
				<SurfaceBodyStatus variant="error" retry={usageStatsQuery} className="min-h-[200px]">
					Couldn't load usage stats.
				</SurfaceBodyStatus>
			) : usageStatsQuery.isLoading ? (
				<SurfaceBodyLoadingStatus label="Loading usage stats" className="min-h-[200px]" />
			) : sortedStats.length === 0 ? (
				<SurfaceBodyStatus variant="empty" className="min-h-[200px]">
					No usage data yet.
				</SurfaceBodyStatus>
			) : (
				<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading usage stats" className="min-h-[200px]" />}>
					<MultiSeriesChart
						dataset={dataset}
						charts={charts}
						selectedCharts={renderedCharts}
						height="200px"
						valueSymbol=""
						hideDataZoom
						exportButtons="hidden"
						chartOptions={chartOptions}
					/>
				</Suspense>
			)}
		</div>
	)
}
