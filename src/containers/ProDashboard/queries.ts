import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { createContext, useCallback, useContext, useMemo } from 'react'
import { fetchChainsList } from '~/containers/Chains/api'
import { fetchOracleMetrics } from '~/containers/Oracles/api'
import { buildOracleNamesByProtocol } from '~/containers/Oracles/membership'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { fetchJson } from '~/utils/async'
import { sumSeriesByTimestamp } from '~/utils/breakdowns'
import { getChartDataPrerequisite, type ChartDataPrerequisite } from './chartRuntime'
import { getProDashboardChartSourceQueryKey, isChainTokenChartType, isProtocolTokenChartType } from './chartSource'
import type { CustomTimePeriod, TimePeriod } from './dashboardTypes'
import { buildProDashboardProtocolCatalog } from './protocolCatalog'
import type { ProProtocolCatalogSourceRow } from './protocolCatalog'
import { fetchProChainChartData } from './services/ChainCharts'
import { fetchProDashboardBridgedTvl } from './services/fetchBridgedTvl'
import { fetchProDashboardProxy } from './services/fetchViaProxy'
import { fetchProProtocolChartData } from './services/ProtocolCharts'
import { ORACLE_MEMBERSHIP_QUERY_KEY } from './tableQueryKeys'
import {
	getProDashboardChartTypeConfig,
	isProDashboardChartType,
	type ChartConfig,
	type DashboardGrouping
} from './types'
import { groupData } from './utils'

/**
 * When false, query hooks skip their own client-side fetches (the stream is providing data).
 * When true (stream finished or no stream), queries fire as fallback.
 * Default true so hooks work normally outside the streaming provider.
 */
export const StreamDoneContext = createContext(true)

/**
 * Auth token for proxying chart fetches through the server (bypasses rate limits).
 * null = no active subscription, fetch directly from public APIs.
 */
export const ProxyAuthTokenContext = createContext<string | null>(null)

export type TimePeriodBounds = { start: number; end: number } | null

export function filterDataByTimePeriod(
	data: [number, number][],
	timePeriod: TimePeriod,
	customPeriod?: CustomTimePeriod | null
): [number, number][] {
	if (!data.length) return data
	const bounds = getTimePeriodBounds(timePeriod, customPeriod)
	if (!bounds) return data

	let low = 0
	let high = data.length
	while (low < high) {
		const mid = (low + high) >>> 1
		const point = data.at(mid)
		if (!point) throw new Error(`Missing chart point at binary-search index ${mid}`)
		if (point[0] < bounds.start) low = mid + 1
		else high = mid
	}
	const startIndex = low

	low = startIndex
	high = data.length
	while (low < high) {
		const mid = (low + high) >>> 1
		const point = data.at(mid)
		if (!point) throw new Error(`Missing chart point at binary-search index ${mid}`)
		if (point[0] <= bounds.end) low = mid + 1
		else high = mid
	}

	if (startIndex === 0 && low === data.length) return data
	return data.slice(startIndex, low)
}

export function getTimePeriodBounds(
	timePeriod: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	now: dayjs.Dayjs = dayjs()
): TimePeriodBounds {
	if (timePeriod === 'all') return null
	if (timePeriod === 'custom' && customPeriod) {
		if (customPeriod.type === 'relative' && customPeriod.relativeDays) {
			return { start: now.subtract(customPeriod.relativeDays, 'day').unix(), end: Infinity }
		}
		if (customPeriod.type === 'absolute' && customPeriod.startDate && customPeriod.endDate) {
			return { start: customPeriod.startDate, end: customPeriod.endDate }
		}
		return null
	}

	let cutoffDate: dayjs.Dayjs

	switch (timePeriod) {
		case '30d':
			cutoffDate = now.subtract(30, 'day')
			break
		case '90d':
			cutoffDate = now.subtract(90, 'day')
			break
		case '365d':
			cutoffDate = now.subtract(365, 'day')
			break
		case 'ytd':
			cutoffDate = now.startOf('year')
			break
		case '3y':
			cutoffDate = now.subtract(3, 'year')
			break
		default:
			return null
	}

	return { start: cutoffDate.unix(), end: Infinity }
}

function fetchChartDirect(
	type: string,
	itemType: 'chain' | 'protocol',
	item: string,
	geckoId?: string | null,
	timePeriod?: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	dataType?: string,
	protocolSymbol?: string | null
): () => Promise<[number, number][]> {
	return async () => {
		const data =
			itemType === 'protocol'
				? await fetchProProtocolChartData(type, item, {
						...(geckoId !== undefined ? { geckoId } : {}),
						...(dataType !== undefined ? { dataType } : {}),
						...(protocolSymbol !== undefined ? { protocolSymbol } : {})
					})
				: type === 'bridgedTvl'
					? await fetchProDashboardBridgedTvl(item)
					: await fetchProChainChartData(type, item, geckoId ?? undefined)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	}
}

function fetchChartProxied(
	type: string,
	itemType: 'chain' | 'protocol',
	item: string,
	authToken: string,
	geckoId?: string | null,
	dataType?: string,
	protocolSymbol?: string | null
): () => Promise<[number, number][]> {
	return () =>
		fetchProDashboardProxy(
			'chart',
			{
				chart: {
					type,
					...(itemType === 'protocol'
						? { subjectType: 'protocol', protocol: item }
						: { subjectType: 'chain', chain: item }),
					...(geckoId !== undefined ? { geckoId } : {}),
					...(dataType !== undefined ? { dataType } : {}),
					...(protocolSymbol !== undefined ? { protocolSymbol } : {})
				}
			},
			authToken
		)
}

export function getChartQueryFn(
	type: string,
	itemType: 'chain' | 'protocol',
	item: string,
	geckoId?: string | null,
	timePeriod?: TimePeriod,
	parentMapping?: ReadonlyMap<string, readonly string[]>,
	customPeriod?: CustomTimePeriod | null,
	dataType?: string,
	authToken?: string | null,
	protocolSymbols?: ReadonlyMap<string, string>
) {
	if (!isProDashboardChartType(type)) return async () => []
	const protocolSymbol = protocolSymbols?.get(item)
	const fetcher = authToken
		? fetchChartProxied(type, itemType, item, authToken, geckoId, dataType, protocolSymbol)
		: fetchChartDirect(type, itemType, item, geckoId, timePeriod, customPeriod, dataType, protocolSymbol)

	if (itemType === 'protocol') {
		return async () => {
			if (isProtocolTokenChartType(type)) {
				return fetcher()
			}

			let direct: [number, number][] = []
			let directError: unknown = null
			try {
				direct = await fetcher()
			} catch (error) {
				directError = error
			}
			if (direct.length > 0) return direct

			const children = parentMapping?.get(item) || []
			if (children.length === 0) {
				if (directError) {
					throw directError instanceof Error
						? directError
						: new Error(`Failed to fetch ${type} chart for ${item}`, { cause: directError })
				}
				return direct
			}

			const childFetchers = children.map((childSlug) =>
				authToken
					? fetchChartProxied(
							type,
							'protocol',
							childSlug,
							authToken,
							undefined,
							dataType,
							protocolSymbols?.get(childSlug)
						)
					: fetchChartDirect(
							type,
							'protocol',
							childSlug,
							undefined,
							timePeriod,
							customPeriod,
							dataType,
							protocolSymbols?.get(childSlug)
						)
			)

			// A parent total must never be assembled from a partial child set. If one
			// canonical child source fails, surface the query error instead of rendering
			// an understated series as though it were complete.
			const seriesList = await Promise.all(childFetchers.map((fetchChild) => fetchChild()))

			return Array.from(sumSeriesByTimestamp(seriesList).entries()).sort((a, b) => a[0] - b[0])
		}
	} else {
		return fetcher
	}
}

export function useProtocolsAndChains({ enabled = true, waitForStream = true } = {}) {
	const streamDone = useContext(StreamDoneContext)
	return useQuery({
		queryKey: ['pro-dashboard', 'protocols-and-chains'],
		enabled: enabled && (!waitForStream || streamDone),
		queryFn: async () => {
			const [protocolCatalogSource, protocolsData, chainsData] = await Promise.all([
				fetchJson<ProProtocolCatalogSourceRow[]>('/api/dynamic/pro-dashboard/protocol-catalog-source'),
				fetchProtocols(),
				fetchChainsList()
			])
			return buildProDashboardProtocolCatalog(protocolCatalogSource, protocolsData, chainsData)
		},
		staleTime: 1000 * 60 * 60,
		gcTime: 1000 * 60 * 60 * 24,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		refetchOnReconnect: false
	})
}

export function useOracleNamesByProtocol() {
	return useQuery({
		queryKey: ORACLE_MEMBERSHIP_QUERY_KEY,
		queryFn: async () => buildOracleNamesByProtocol((await fetchOracleMetrics()).oracles),
		staleTime: 1000 * 60 * 60,
		gcTime: 1000 * 60 * 60 * 24,
		refetchOnWindowFocus: false
	})
}

export type ProDashboardChartObserverPlan = {
	sources: ChartConfig[]
	sourceIndexByChart: number[]
}

/** React Query requires every entry in one useQueries call to have a unique key. */
export function buildProDashboardChartObserverPlan(charts: ChartConfig[]): ProDashboardChartObserverPlan {
	const sources: ChartConfig[] = []
	const sourceIndexByChart = new Array<number>(charts.length)
	const sourceIndexByKey = new Map<string, number>()

	for (const [index, chart] of charts.entries()) {
		const serializedKey = JSON.stringify(getProDashboardChartSourceQueryKey(chart))
		let sourceIndex = sourceIndexByKey.get(serializedKey)
		if (sourceIndex === undefined) {
			sourceIndex = sources.length
			sourceIndexByKey.set(serializedKey, sourceIndex)
			sources.push(chart)
		}
		sourceIndexByChart[index] = sourceIndex
	}

	return { sources, sourceIndexByChart }
}

function projectChartData(
	sourceData: [number, number][],
	timePeriod: TimePeriod,
	customPeriod: CustomTimePeriod | null | undefined,
	grouping: DashboardGrouping | null
): [number, number][] {
	const relevantCustomPeriod = timePeriod === 'custom' ? customPeriod : null
	const filtered = filterDataByTimePeriod(sourceData, timePeriod, relevantCustomPeriod)
	return grouping ? groupData(filtered, grouping) : filtered
}

function getChartSourceQueryOptions(
	chart: ChartConfig,
	streamDone: boolean,
	prerequisite: ChartDataPrerequisite,
	authToken: string | null | undefined,
	parentMapping: ReadonlyMap<string, readonly string[]> | undefined,
	protocolSymbols: ReadonlyMap<string, string> | undefined
) {
	const itemType = chart.subjectType
	const item = chart.subjectType === 'protocol' ? chart.protocol : chart.chain
	return {
		// Raw source keys intentionally exclude card-local time and grouping settings.
		queryKey: getProDashboardChartSourceQueryKey(chart),
		queryFn: getChartQueryFn(
			chart.type,
			itemType,
			item,
			chart.geckoId,
			undefined,
			parentMapping,
			undefined,
			chart.dataType,
			authToken,
			itemType === 'protocol' ? protocolSymbols : undefined
		),
		staleTime: 1000 * 60 * 5,
		gcTime: 1000 * 60 * 30,
		refetchOnWindowFocus: false,
		enabled:
			streamDone &&
			prerequisite.status === 'ready' &&
			((isProtocolTokenChartType(chart.type) && !!chart.geckoId) ||
				(!!item &&
					((itemType === 'protocol' && (!isProtocolTokenChartType(chart.type) || !!chart.geckoId)) ||
						(itemType === 'chain' && (!isChainTokenChartType(chart.type) || !!chart.geckoId)))))
	}
}

export function useChartData(
	chart: ChartConfig,
	protocolCatalog: ChartDataPrerequisite,
	protocolBySlug: Pick<ReadonlyMap<string, unknown>, 'has'>,
	timePeriod?: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	authToken?: string | null,
	parentMapping?: ReadonlyMap<string, readonly string[]>,
	protocolSymbols?: ReadonlyMap<string, string>
) {
	const streamDone = useContext(StreamDoneContext)
	const prerequisite = getChartDataPrerequisite(chart, protocolCatalog, protocolBySlug)
	const sourceQueryOptions = useMemo(
		() => getChartSourceQueryOptions(chart, streamDone, prerequisite, authToken, parentMapping, protocolSymbols),
		[authToken, chart, parentMapping, prerequisite, protocolSymbols, streamDone]
	)
	const projectionTimePeriod = timePeriod ?? 'all'
	const relativeBoundaryDay =
		projectionTimePeriod !== 'all' &&
		(projectionTimePeriod !== 'custom' || !customPeriod || customPeriod.type === 'relative')
			? dayjs().startOf('day').unix()
			: null
	const selectData = useCallback(
		(sourceData: [number, number][]) => {
			// A relative period must be projected again after the UTC day boundary even when source data is unchanged.
			void relativeBoundaryDay
			const chartTypeDetails = getProDashboardChartTypeConfig(chart.type)
			const groupable = chartTypeDetails && 'groupable' in chartTypeDetails && chartTypeDetails.groupable
			const grouping = groupable && chart.grouping && chart.grouping !== 'day' ? chart.grouping : null
			return projectChartData(sourceData, projectionTimePeriod, customPeriod, grouping)
		},
		[chart.grouping, chart.type, customPeriod, projectionTimePeriod, relativeBoundaryDay]
	)

	return useQuery({ ...sourceQueryOptions, select: selectData })
}

export function useChartsData(
	charts: ChartConfig[],
	protocolCatalog: ChartDataPrerequisite,
	protocolBySlug: Pick<ReadonlyMap<string, unknown>, 'has'>,
	timePeriod?: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	authToken?: string | null,
	parentMapping?: ReadonlyMap<string, readonly string[]>,
	protocolSymbols?: ReadonlyMap<string, string>
) {
	const streamDone = useContext(StreamDoneContext)
	const observerPlan = useMemo(() => buildProDashboardChartObserverPlan(charts), [charts])
	const sourceQueryOptions = useMemo(
		() =>
			observerPlan.sources.map((chart) =>
				getChartSourceQueryOptions(
					chart,
					streamDone,
					getChartDataPrerequisite(chart, protocolCatalog, protocolBySlug),
					authToken,
					parentMapping,
					protocolSymbols
				)
			),
		[authToken, observerPlan.sources, parentMapping, protocolBySlug, protocolCatalog, protocolSymbols, streamDone]
	)
	const projectionTimePeriod = timePeriod ?? 'all'
	const relativeBoundaryDay =
		projectionTimePeriod !== 'all' &&
		(projectionTimePeriod !== 'custom' || !customPeriod || customPeriod.type === 'relative')
			? dayjs().startOf('day').unix()
			: null
	const combineSourceQueries = useCallback(
		(sourceQueries: UseQueryResult<[number, number][]>[]) => {
			// A relative period must be projected again after the UTC day boundary even when source data is unchanged.
			void relativeBoundaryDay
			return charts.map((chart, chartIndex) => {
				const sourceIndex = observerPlan.sourceIndexByChart.at(chartIndex)
				if (sourceIndex === undefined) throw new Error(`Missing chart observer source index for ${chart.id}`)
				const query = sourceQueries.at(sourceIndex)
				if (!query) throw new Error(`Missing chart observer query for ${chart.id}`)
				const sourceData = query.data
				if (!sourceData) return query

				const chartTypeDetails = getProDashboardChartTypeConfig(chart.type)
				const groupable = chartTypeDetails && 'groupable' in chartTypeDetails && chartTypeDetails.groupable
				const grouping = groupable && chart.grouping && chart.grouping !== 'day' ? chart.grouping : null
				return {
					...query,
					data: projectChartData(sourceData, projectionTimePeriod, customPeriod, grouping)
				}
			})
		},
		[charts, customPeriod, observerPlan.sourceIndexByChart, projectionTimePeriod, relativeBoundaryDay]
	)

	return useQueries({ queries: sourceQueryOptions, combine: combineSourceQueries })
}
