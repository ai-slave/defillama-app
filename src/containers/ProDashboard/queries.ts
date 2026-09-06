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
import { filterDataByTimePeriod } from './timePeriod'
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

export { filterDataByTimePeriod, getTimePeriodBounds } from './timePeriod'

function fetchChartDirect(
	type: string,
	itemType: 'chain' | 'protocol',
	item: string,
	geckoId?: string | null,
	timePeriod?: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	dataType?: string
): () => Promise<Array<[number, number]>> {
	return async () => {
		const data =
			itemType === 'protocol'
				? await fetchProProtocolChartData(type, item, {
						...(geckoId !== undefined ? { geckoId } : {}),
						...(dataType !== undefined ? { dataType } : {})
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
	dataType?: string
): () => Promise<Array<[number, number]>> {
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
					...(dataType !== undefined ? { dataType } : {})
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
	parentMapping?: ReadonlyMap<string, ReadonlyArray<string>>,
	customPeriod?: CustomTimePeriod | null,
	dataType?: string,
	authToken?: string | null
) {
	if (!isProDashboardChartType(type)) return async () => []
	const fetcher = authToken
		? fetchChartProxied(type, itemType, item, authToken, geckoId, dataType)
		: fetchChartDirect(type, itemType, item, geckoId, timePeriod, customPeriod, dataType)

	if (itemType === 'protocol') {
		return async () => {
			if (isProtocolTokenChartType(type)) {
				return fetcher()
			}

			let direct: Array<[number, number]> = []
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
					? fetchChartProxied(type, 'protocol', childSlug, authToken, undefined, dataType)
					: fetchChartDirect(type, 'protocol', childSlug, undefined, timePeriod, customPeriod, dataType)
			)

			// A parent total must never be assembled from a partial child set. If one
			// canonical child source fails, surface the query error instead of rendering
			// an understated series as though it were complete.
			const seriesList = await Promise.all(childFetchers.map((fetchChild) => fetchChild()))

			return Array.from(sumSeriesByTimestamp(seriesList).entries()).sort((a, b) => a[0] - b[0])
		}
	}
	return fetcher
}

export function useProtocolsAndChains({ enabled = true, waitForStream = true } = {}) {
	const streamDone = useContext(StreamDoneContext)
	return useQuery({
		queryKey: ['pro-dashboard', 'protocols-and-chains'],
		enabled: enabled && (!waitForStream || streamDone),
		queryFn: async () => {
			const [protocolCatalogSource, protocolsData, chainsData] = await Promise.all([
				fetchJson<Array<ProProtocolCatalogSourceRow>>('/api/dynamic/pro-dashboard/protocol-catalog-source'),
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
	sources: Array<ChartConfig>
	sourceIndexByChart: Array<number>
}

/** React Query requires every entry in one useQueries call to have a unique key. */
export function buildProDashboardChartObserverPlan(charts: Array<ChartConfig>): ProDashboardChartObserverPlan {
	const sources: Array<ChartConfig> = []
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
	sourceData: Array<[number, number]>,
	timePeriod: TimePeriod,
	customPeriod: CustomTimePeriod | null | undefined,
	grouping: DashboardGrouping | null
): Array<[number, number]> {
	const relevantCustomPeriod = timePeriod === 'custom' ? customPeriod : null
	const filtered = filterDataByTimePeriod(sourceData, timePeriod, relevantCustomPeriod)
	return grouping ? groupData(filtered, grouping) : filtered
}

function getChartSourceQueryOptions(
	chart: ChartConfig,
	streamDone: boolean,
	prerequisite: ChartDataPrerequisite,
	authToken: string | null | undefined,
	parentMapping: ReadonlyMap<string, ReadonlyArray<string>> | undefined
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
			authToken
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
	parentMapping?: ReadonlyMap<string, ReadonlyArray<string>>
) {
	const streamDone = useContext(StreamDoneContext)
	const prerequisite = getChartDataPrerequisite(chart, protocolCatalog, protocolBySlug)
	const sourceQueryOptions = useMemo(
		() => getChartSourceQueryOptions(chart, streamDone, prerequisite, authToken, parentMapping),
		[authToken, chart, parentMapping, prerequisite, streamDone]
	)
	const projectionTimePeriod = timePeriod ?? 'all'
	const relativeBoundaryDay =
		projectionTimePeriod !== 'all' &&
		(projectionTimePeriod !== 'custom' || !customPeriod || customPeriod.type === 'relative')
			? dayjs().startOf('day').unix()
			: null
	const selectData = useCallback(
		(sourceData: Array<[number, number]>) => {
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
	charts: Array<ChartConfig>,
	protocolCatalog: ChartDataPrerequisite,
	protocolBySlug: Pick<ReadonlyMap<string, unknown>, 'has'>,
	timePeriod?: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	authToken?: string | null,
	parentMapping?: ReadonlyMap<string, ReadonlyArray<string>>
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
					parentMapping
				)
			),
		[authToken, observerPlan.sources, parentMapping, protocolBySlug, protocolCatalog, streamDone]
	)
	const projectionTimePeriod = timePeriod ?? 'all'
	const relativeBoundaryDay =
		projectionTimePeriod !== 'all' &&
		(projectionTimePeriod !== 'custom' || !customPeriod || customPeriod.type === 'relative')
			? dayjs().startOf('day').unix()
			: null
	const combineSourceQueries = useCallback(
		(sourceQueries: Array<UseQueryResult<Array<[number, number]>>>) => {
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
