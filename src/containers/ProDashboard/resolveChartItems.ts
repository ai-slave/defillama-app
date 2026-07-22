import type { DashboardItemConfig, ChartConfig } from './types'
import { limitMultiChartItems } from './types'

const EMPTY_CHART_DATA: ChartConfig['data'] = []
const NOOP = () => {}

export type DashboardChartQueryState = {
	data?: ChartConfig['data']
	isLoading?: boolean
	isError?: boolean
	refetch?: () => unknown
}

type ResolvedChartCacheEntry = {
	config: ChartConfig
	data: ChartConfig['data']
	isLoading: boolean
	hasError: boolean
	refetch: () => unknown
	resolved: ChartConfig
}

type ResolvedMultiCacheEntry = {
	config: Extract<DashboardItemConfig, { kind: 'multi' }>
	children: ChartConfig[]
	resolved: DashboardItemConfig
}

export type DashboardChartResolutionCache = {
	charts: Map<string, ResolvedChartCacheEntry>
	multi: Map<string, ResolvedMultiCacheEntry>
	items: DashboardItemConfig[] | null
}

export function createDashboardChartResolutionCache(): DashboardChartResolutionCache {
	return { charts: new Map(), multi: new Map(), items: null }
}

export function resolveDashboardChartItems({
	items,
	chartIndexById,
	chartQueries,
	streamDone,
	cache
}: {
	items: DashboardItemConfig[]
	chartIndexById: ReadonlyMap<string, number>
	chartQueries: DashboardChartQueryState[]
	streamDone: boolean
	cache: DashboardChartResolutionCache
}): DashboardItemConfig[] {
	if (cache.items !== items) {
		const activeChartIds = new Set<string>()
		const activeMultiIds = new Set<string>()
		for (const item of items) {
			if (item.kind === 'chart') activeChartIds.add(item.id)
			else if (item.kind === 'multi') {
				activeMultiIds.add(item.id)
				for (const child of limitMultiChartItems(item.items)) activeChartIds.add(child.id)
			}
		}
		for (const id of cache.charts.keys()) {
			if (!activeChartIds.has(id)) cache.charts.delete(id)
		}
		for (const id of cache.multi.keys()) {
			if (!activeMultiIds.has(id)) cache.multi.delete(id)
		}
		cache.items = items
	}

	const resolveChart = (chart: ChartConfig) => {
		const queryIndex = chartIndexById.get(chart.id)
		const query = queryIndex === undefined ? undefined : chartQueries[queryIndex]
		const data = query?.data ?? EMPTY_CHART_DATA
		const isLoading = !query || !!query.isLoading || (!streamDone && !query.data)
		const hasError = !!query?.isError
		const refetch = query?.refetch ?? NOOP
		const previous = cache.charts.get(chart.id)
		if (
			previous?.config === chart &&
			previous.data === data &&
			previous.isLoading === isLoading &&
			previous.hasError === hasError &&
			previous.refetch === refetch
		) {
			return previous.resolved
		}

		const resolved = { ...chart, data, isLoading, hasError, refetch }
		cache.charts.set(chart.id, { config: chart, data, isLoading, hasError, refetch, resolved })
		return resolved
	}

	const resolvedItems = items.map((item) => {
		if (item.kind === 'chart') return resolveChart(item)
		if (item.kind !== 'multi') return item

		const children = limitMultiChartItems(item.items).map(resolveChart)
		const previous = cache.multi.get(item.id)
		if (
			previous?.config === item &&
			previous.children.length === children.length &&
			previous.children.every((child, index) => child === children[index])
		) {
			return previous.resolved
		}

		const resolved = { ...item, items: children }
		cache.multi.set(item.id, { config: item, children, resolved })
		return resolved
	})

	return resolvedItems
}
