import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type {
	IMultiSeriesChartProps,
	MultiSeriesChartDataset,
	MultiSeriesChartOptions
} from '~/components/ECharts/MultiSeriesChart/types'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import { getTooltipAxisValue, getTooltipRawYValue, normalizeTooltipItems } from '~/components/ECharts/shared/tooltip'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
import { LoadingSpinner } from '~/ui/Loaders'
import { formatCompactNumber } from '~/utils/numberFormat'

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

interface ApiUsageBreakdownProps {
	usageStats: ApiUsageStats | null | undefined
	isLoading: boolean
	isError: boolean
}

const DEFAULT_WINDOW_DAYS = 30
const TOP_ROUTES = 6
const DAY_MS = 86_400_000

const toUtcDayStart = (ts: number) => Math.floor(ts / DAY_MS) * DAY_MS

const CSS_VAR_KEYS = {
	routes: [
		'--sub-chart-1',
		'--sub-chart-2',
		'--sub-chart-3',
		'--sub-chart-4',
		'--sub-chart-5',
		'--sub-chart-6',
		'--sub-chart-7'
	],
	others: '--sub-chart-others',
	split: '--sub-chart-split',
	muted: '--sub-text-muted',
	axis: '--sub-chart-axis',
	tooltipBg: '--sub-chart-tooltip-bg',
	tooltipBorder: '--sub-chart-tooltip-border'
} as const

function resolveChartColors() {
	const style = getComputedStyle(document.documentElement)
	const get = (key: string) => style.getPropertyValue(key).trim()
	return {
		routes: CSS_VAR_KEYS.routes.map(get),
		others: get(CSS_VAR_KEYS.others),
		split: get(CSS_VAR_KEYS.split),
		muted: get(CSS_VAR_KEYS.muted),
		axis: get(CSS_VAR_KEYS.axis),
		tooltipBg: get(CSS_VAR_KEYS.tooltipBg),
		tooltipBorder: get(CSS_VAR_KEYS.tooltipBorder)
	}
}

type ChartColors = ReturnType<typeof resolveChartColors>

const FALLBACK_CHART_COLORS: ChartColors = {
	routes: CSS_VAR_KEYS.routes.map(() => ''),
	others: '',
	split: '',
	muted: '',
	axis: '',
	tooltipBg: '',
	tooltipBorder: ''
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
	const routeSeries = useMemo(() => {
		const totals = new Map<string, number>()
		for (const day of sortedStats) {
			for (const [route, count] of Object.entries(day.routes ?? {})) {
				totals.set(route, (totals.get(route) ?? 0) + count)
			}
		}
		return Array.from(totals, ([route, total]) => ({ route, total }))
			.sort((a, b) => b.total - a.total || a.route.localeCompare(b.route))
			.map(({ route }) => route)
	}, [sortedStats])

	return { sortedStats, totalRequests, averageRequests, windowDays, routeSeries }
}

function useChartData(
	sortedStats: ApiUsageStats['stats'],
	windowDays: number,
	routeSeries: Array<string>,
	selectedRoutes: Array<string>,
	colors: ChartColors,
	fetchedAt: number | null
) {
	const { dataset, charts } = useMemo<{
		dataset: MultiSeriesChartDataset
		charts: IMultiSeriesChartProps['charts']
	}>(() => {
		if (sortedStats.length === 0 || fetchedAt === null) {
			return { dataset: { source: [], dimensions: ['date'] }, charts: [] }
		}

		const selected = new Set(selectedRoutes)
		const rankedSelection = routeSeries.filter((route) => selected.has(route))
		const topRoutes = rankedSelection.slice(0, TOP_ROUTES)
		const omittedRoutes = rankedSelection.slice(TOP_ROUTES)
		const omittedRoutesSet = new Set(omittedRoutes)
		const hasOthers = omittedRoutes.length > 0

		const makeTimestamp = (date: string) => (date.includes('T') ? Date.parse(date) : Date.parse(`${date}T00:00:00Z`))

		const seriesNames = hasOthers ? [...topRoutes, 'Others'] : topRoutes
		const dimensions = ['date', ...seriesNames]

		const statsByDay = new Map<number, ApiUsageStats['stats'][number]>()
		for (const day of sortedStats) {
			statsByDay.set(toUtcDayStart(makeTimestamp(day.date)), day)
		}

		// span the full 30d window so empty days are included in the chart, even if they have no data
		const lastDay = toUtcDayStart(fetchedAt)
		const firstDay = lastDay - (windowDays - 1) * DAY_MS

		const source: MultiSeriesChartDataset['source'] = []
		for (let ts = firstDay; ts <= lastDay; ts += DAY_MS) {
			const day = statsByDay.get(ts)
			const row = new Array<number>(dimensions.length)
			row[0] = ts
			for (let routeIndex = 0; routeIndex < topRoutes.length; routeIndex++) {
				row[routeIndex + 1] = day?.routes?.[topRoutes[routeIndex]] ?? 0
			}
			if (hasOthers) {
				let others = 0
				for (const [route, count] of Object.entries(day?.routes ?? {})) {
					if (omittedRoutesSet.has(route)) others += count
				}
				row[dimensions.length - 1] = others
			}
			source.push(row)
		}

		const canonicalIndex = new Map(routeSeries.map((name, index) => [name, index]))
		const charts: IMultiSeriesChartProps['charts'] = seriesNames.map((name, index) => ({
			type: 'bar' as const,
			name,
			stack: 'routes',
			encode: { x: 0, y: index + 1 },
			color:
				name === 'Others'
					? colors.others
					: (colors.routes[(canonicalIndex.get(name) ?? index) % colors.routes.length] ?? colors.routes[0]),
			large: false
		}))

		return { dataset: { source, dimensions }, charts }
	}, [sortedStats, colors, windowDays, routeSeries, selectedRoutes, fetchedAt])

	return { dataset, charts }
}

export function ApiUsageBreakdown({ usageStats, isLoading, isError }: ApiUsageBreakdownProps) {
	const [colors, setColors] = useState<ChartColors | null>(null)
	const resolved = useRef(false)

	useEffect(() => {
		if (!resolved.current) {
			resolved.current = true
			setColors(resolveChartColors())
		}
	}, [])

	// Use fallback colors for SSR / first render — will be replaced immediately on mount
	const activeColors = colors ?? FALLBACK_CHART_COLORS

	const { sortedStats, totalRequests, averageRequests, windowDays, routeSeries } = useChartSource(usageStats)
	const { activeSeries, setSelectedSeries } = useAllSeriesSelection({
		availableSeries: routeSeries,
		selectionKey: String(windowDays)
	})
	const { dataset, charts } = useChartData(
		sortedStats,
		windowDays,
		routeSeries,
		activeSeries,
		activeColors,
		usageStats?.fetchedAt ?? null
	)
	const renderedCharts = useMemo(() => new Set(charts.map((chart) => chart.name)), [charts])

	const hasData = sortedStats.length > 0 && !isLoading && !isError
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
				left: 0,
				containLabel: true
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
				backgroundColor: activeColors.tooltipBg || '#131516',
				borderColor: activeColors.tooltipBorder || '#2f3336',
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

					const rows = items
						.map(
							(item) =>
								`<li style="list-style:none;padding:1px 0">${item.marker}${item.name}&nbsp;&nbsp;<b>${formatCompactNumber(item.value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</b></li>`
						)
						.join('')
					const totalRow = `<li style="list-style:none;padding:2px 0 0;border-top:1px solid ${activeColors.axis};margin-top:4px;font-weight:600">Total&nbsp;&nbsp;${formatCompactNumber(total, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</li>`

					return `<div><div style="margin-bottom:6px;font-weight:500">${dateLabel}</div><ul style="margin:0;padding:0">${rows}${totalRow}</ul></div>`
				}
			}
		}),
		[activeColors]
	)

	return (
		<div className="flex flex-col gap-4 rounded-lg bg-sub-surface-panel p-3 dark:bg-sub-dark-page">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<span className="text-sm text-sub-text-primary">API Usage Breakdown</span>
					<span className="text-xs text-sub-text-muted">Last {windowDays} days</span>
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
						<span className="text-sm font-semibold text-sub-text-primary">{totalLabel}</span>
						<span className="text-[10px] text-sub-text-muted">Total Requests</span>
					</div>
					<div className="flex flex-col items-end">
						<span className="text-sm font-semibold text-sub-text-primary">{avgLabel}</span>
						<span className="text-[10px] text-sub-text-muted">Ave/Day</span>
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
								<span className="text-[10px] text-sub-text-muted">{series.name}</span>
							</div>
						))}
				</div>
			)}

			{/* Chart */}
			{isLoading ? (
				<div className="flex min-h-[200px] items-center justify-center gap-2 text-xs text-sub-text-muted">
					<LoadingSpinner size={14} />
					<span>Loading usage stats...</span>
				</div>
			) : isError ? (
				<div className="flex min-h-[200px] items-center justify-center text-xs text-sub-text-muted">
					Unable to load usage stats right now.
				</div>
			) : sortedStats.length === 0 ? (
				<div className="flex min-h-[200px] items-center justify-center text-xs text-sub-text-muted">
					No usage data yet.
				</div>
			) : (
				<Suspense fallback={<div className="min-h-[200px]" />}>
					<MultiSeriesChart
						dataset={dataset}
						charts={charts}
						selectedCharts={renderedCharts}
						height="200px"
						valueSymbol=""
						hideDataZoom
						hideDefaultLegend
						exportButtons="hidden"
						chartOptions={chartOptions}
					/>
				</Suspense>
			)}
		</div>
	)
}
