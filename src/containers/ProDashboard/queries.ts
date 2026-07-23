import { useQueries, useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { createContext, useContext, useMemo, useRef } from 'react'
import { fetchChainsList } from '~/containers/Chains/api'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { sumSeriesByTimestamp } from '~/utils/breakdowns'
import {
	getProDashboardChartSourceQueryKey,
	isChainTokenChartType,
	isProtocolTokenChartType,
	normalizeUnlocksDataType
} from './chartSource'
import type { CustomTimePeriod, TimePeriod } from './dashboardTypes'
import {
	buildProDashboardParentMapping,
	buildProDashboardProtocolCatalog,
	buildProtocolSymbolMap
} from './protocolCatalog'
import ChainCharts from './services/ChainCharts'
import { fetchChartViaProxy } from './services/fetchViaProxy'
import ProtocolCharts from './services/ProtocolCharts'
import {
	CHART_TYPES,
	isProDashboardChartType,
	type ChartConfig,
	type DashboardGrouping,
	type ProDashboardChartType
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
		if (data[mid][0] < bounds.start) low = mid + 1
		else high = mid
	}
	const startIndex = low

	low = startIndex
	high = data.length
	while (low < high) {
		const mid = (low + high) >>> 1
		if (data[mid][0] <= bounds.end) low = mid + 1
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

export function getChartCardQueryKey(chart: Pick<ChartConfig, 'type' | 'protocol' | 'chain' | 'geckoId' | 'dataType'>) {
	return getProDashboardChartSourceQueryKey(chart)
}

export function getMetricQueryKey(type: string, itemType: 'chain' | 'protocol', item: string, geckoId?: string | null) {
	return getProDashboardChartSourceQueryKey({
		type,
		protocol: itemType === 'protocol' ? item : '',
		chain: itemType === 'chain' ? item : '',
		geckoId
	})
}

// Object maps for chart query functions
type ProtocolChartHandler = (
	item: string,
	geckoId?: string | null,
	timePeriod?: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	dataType?: string,
	protocolSymbol?: string | null
) => () => Promise<[number, number][]>

const protocolChartHandlers: Partial<Record<ProDashboardChartType, ProtocolChartHandler>> = {
	tvl: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.tvl(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	volume: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.volume(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	fees: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.fees(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	liquidity: (item, geckoId, timePeriod, customPeriod, _dataType, protocolSymbol) => async () => {
		const data = await ProtocolCharts.liquidity(item, protocolSymbol)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	treasury: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.treasury(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	incentives: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.incentives(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	unlocks: (item, geckoId, timePeriod, customPeriod, dataType) => async () => {
		const data = await ProtocolCharts.unlocks(item, normalizeUnlocksDataType(dataType))
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	revenue: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.revenue(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	holdersRevenue: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.holdersRevenue(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	perps: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.perps(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	openInterest: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.openInterest(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	aggregators: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.aggregators(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	perpsAggregators: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.perpsAggregators(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	bridgeAggregators: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.bridgeAggregators(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	optionsPremium: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.optionsPremium(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	optionsNotional: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.optionsNotional(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	activeUsers: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.activeUsers(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	newUsers: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.newUsers(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	txs: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.txs(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	gasUsed: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.gasUsed(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	tokenMcap: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.tokenMcap(item, geckoId)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	tokenPrice: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.tokenPrice(item, geckoId)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	tokenVolume: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.tokenVolume(item, geckoId)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	medianApy: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.medianApy(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	borrowed: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.borrowed(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	pfRatio: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.pfRatio(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	psRatio: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ProtocolCharts.psRatio(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	}
}

type ChainChartHandler = (
	item: string,
	geckoId?: string | null,
	timePeriod?: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	dataType?: string
) => () => Promise<[number, number][]>

const chainChartHandlers: Partial<Record<ProDashboardChartType, ChainChartHandler>> = {
	tvl: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.tvl(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	volume: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.volume(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	fees: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.fees(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	users: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.users(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	txs: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.txs(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	aggregators: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.aggregators(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	perps: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.perps(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	bridgeAggregators: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.bridgeAggregators(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	perpsAggregators: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.perpsAggregators(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	options: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.options(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	optionsPremium: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.getData('optionsPremium', item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	optionsNotional: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.getData('optionsNotional', item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	revenue: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.revenue(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	activeUsers: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.activeUsers(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	newUsers: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.newUsers(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	gasUsed: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.gasUsed(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	stablecoins: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.stablecoins(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	stablecoinInflows: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.stablecoinInflows(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	chainFees: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.chainFees(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	chainRevenue: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.chainRevenue(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	bridgedTvl: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.bridgedTvl(item)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	chainMcap: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.chainMcap(item, geckoId)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	},
	chainPrice: (item, geckoId, timePeriod, customPeriod) => async () => {
		const data = await ChainCharts.chainPrice(item, geckoId)
		return filterDataByTimePeriod(data, timePeriod || 'all', customPeriod)
	}
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
	if (itemType === 'protocol') {
		const handler = isProDashboardChartType(type) ? protocolChartHandlers[type] : undefined
		if (!handler) return () => Promise.resolve([])
		return handler(item, geckoId, timePeriod, customPeriod, dataType, protocolSymbol)
	}
	const handler = isProDashboardChartType(type) ? chainChartHandlers[type] : undefined
	if (handler) return handler(item, geckoId, timePeriod, customPeriod, dataType)
	return async () => {
		const data = await ChainCharts.tvl(item)
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
		fetchChartViaProxy(
			{
				type,
				protocol: itemType === 'protocol' ? item : '',
				chain: itemType === 'chain' ? item : '',
				geckoId,
				dataType,
				protocolSymbol
			},
			authToken
		)
}

function getChartQueryFn(
	type: string,
	itemType: 'chain' | 'protocol',
	item: string,
	geckoId?: string | null,
	timePeriod?: TimePeriod,
	parentMapping?: Map<string, string[]>,
	customPeriod?: CustomTimePeriod | null,
	dataType?: string,
	authToken?: string | null,
	protocolSymbols?: ReadonlyMap<string, string>
) {
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
			if (Array.isArray(direct) && direct.length > 0) return direct

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

			const settled = await Promise.allSettled(
				childFetchers.map(async (fn) => {
					try {
						return await fn()
					} catch {
						return [] as [number, number][]
					}
				})
			)
			const seriesList = settled
				.map((res) => (res.status === 'fulfilled' ? res.value : ([] as [number, number][])))
				.filter((arr) => Array.isArray(arr))

			return Array.from(sumSeriesByTimestamp(seriesList).entries()).sort((a, b) => a[0] - b[0])
		}
	} else {
		return fetcher
	}
}

export { getChartQueryFn }

export function useProtocolsAndChains() {
	const streamDone = useContext(StreamDoneContext)
	return useQuery({
		queryKey: ['pro-dashboard', 'protocols-and-chains'],
		enabled: streamDone,
		queryFn: async () => {
			const [protocolsData, chainsData] = await Promise.all([fetchProtocols(), fetchChainsList()])
			return buildProDashboardProtocolCatalog(protocolsData, chainsData)
		},
		staleTime: 1000 * 60 * 60,
		gcTime: 1000 * 60 * 60 * 24,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		refetchOnReconnect: false
	})
}

type GroupingCacheEntry = {
	data: [number, number][]
	grouping: DashboardGrouping
	result: [number, number][]
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

	for (let index = 0; index < charts.length; index++) {
		const chart = charts[index]
		const serializedKey = JSON.stringify(getChartCardQueryKey(chart))
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

function computeGrouped(
	groupingCache: Map<string, GroupingCacheEntry>,
	id: string,
	data: [number, number][],
	grouping: DashboardGrouping
): [number, number][] {
	const prev = groupingCache.get(id)
	if (prev && prev.data === data && prev.grouping === grouping) return prev.result
	const result = groupData(data, grouping)
	groupingCache.set(id, { data, grouping, result })
	return result
}

export function useChartsData(
	charts: ChartConfig[],
	timePeriod?: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	authToken?: string | null
) {
	const streamDone = useContext(StreamDoneContext)
	const { data: catalog } = useProtocolsAndChains()
	const parentMapping = useMemo(() => buildProDashboardParentMapping(catalog?.protocols ?? []), [catalog])
	const protocolSymbols = useMemo(() => buildProtocolSymbolMap(catalog?.protocols ?? []), [catalog])
	const groupingCacheRef = useRef<Map<string, GroupingCacheEntry>>(new Map())
	const observerPlan = useMemo(() => buildProDashboardChartObserverPlan(charts), [charts])
	const sourceQueries = useQueries({
		queries: observerPlan.sources.map((chart) => {
			const itemType = chart.protocol ? 'protocol' : 'chain'
			const item = chart.protocol || chart.chain

			return {
				// Raw source keys intentionally exclude card-local time and grouping settings.
				queryKey: getChartCardQueryKey(chart),
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
					((isProtocolTokenChartType(chart.type) && !!chart.geckoId) ||
						(!!item &&
							((itemType === 'protocol' && (!isProtocolTokenChartType(chart.type) || !!chart.geckoId)) ||
								(itemType === 'chain' && (!isChainTokenChartType(chart.type) || !!chart.geckoId)))))
			}
		})
	})

	return charts.map((chart, chartIndex) => {
		const query = sourceQueries[observerPlan.sourceIndexByChart[chartIndex]]
		const sourceData = query.data
		if (!sourceData) return query

		const filtered = filterDataByTimePeriod(sourceData, timePeriod || 'all', customPeriod)
		const chartTypeDetails = CHART_TYPES[chart.type]
		const data =
			chartTypeDetails?.groupable && chart.grouping && chart.grouping !== 'day'
				? computeGrouped(groupingCacheRef.current, chart.id, filtered, chart.grouping)
				: filtered
		return { ...query, data }
	})
}
