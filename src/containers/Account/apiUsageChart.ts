import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { chartColor, OTHERS_COLOR } from '~/constants/colors'

export interface ApiUsageDay {
	date: string
	totalRequests: number
	routes?: Record<string, number>
}

const TOP_ROUTES = 6
const DAY_MS = 86_400_000

const toUtcDayStart = (ts: number) => Math.floor(ts / DAY_MS) * DAY_MS
const makeTimestamp = (date: string) => (date.includes('T') ? Date.parse(date) : Date.parse(`${date}T00:00:00Z`))

/** Routes ordered by total requests (descending), ties broken alphabetically. */
export function rankRoutesByTotal(stats: Array<ApiUsageDay>): Array<string> {
	const totals = new Map<string, number>()
	for (const day of stats) {
		for (const [route, count] of Object.entries(day.routes ?? {})) {
			totals.set(route, (totals.get(route) ?? 0) + count)
		}
	}
	return Array.from(totals, ([route, total]) => ({ route, total }))
		.sort((a, b) => b.total - a.total || a.route.localeCompare(b.route))
		.map(({ route }) => route)
}

export function buildApiUsageChartData(
	sortedStats: Array<ApiUsageDay>,
	windowDays: number,
	routeSeries: Array<string>,
	selectedRoutes: Array<string>,
	fetchedAt: number | null
): { dataset: MultiSeriesChartDataset; charts: NonNullable<IMultiSeriesChartProps['charts']> } {
	if (sortedStats.length === 0 || fetchedAt === null) {
		return { dataset: { source: [], dimensions: ['timestamp'] }, charts: [] }
	}

	const selected = new Set(selectedRoutes)
	const rankedSelection = routeSeries.filter((route) => selected.has(route))
	const topRoutes = rankedSelection.slice(0, TOP_ROUTES)
	const omittedRoutes = rankedSelection.slice(TOP_ROUTES)
	const omittedRoutesSet = new Set(omittedRoutes)
	const hasOthers = omittedRoutes.length > 0

	const seriesNames = hasOthers ? [...topRoutes, 'Others'] : topRoutes
	const dimensions = ['timestamp', ...seriesNames]

	const statsByDay = new Map<number, ApiUsageDay>()
	for (const day of sortedStats) {
		statsByDay.set(toUtcDayStart(makeTimestamp(day.date)), day)
	}

	// span the full window so empty days are included in the chart, even if they have no data
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
	// A route keeps the color of its rank among all routes, so deselecting one leaves the others' colors alone.
	const charts = seriesNames.map((name, index) => ({
		type: 'bar' as const,
		name,
		stack: 'routes',
		encode: { x: 0, y: index + 1 },
		color: name === 'Others' ? OTHERS_COLOR : chartColor(canonicalIndex.get(name) ?? index),
		large: false
	}))

	return { dataset: { source, dimensions }, charts }
}
