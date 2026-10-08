import { chartColor, OTHERS_COLOR } from '~/constants/colors'
import { fetchAdapterChainChartDataByProtocolBreakdown } from '~/containers/AdapterMetrics/api'
import type { IAdapterBreakdownChartData } from '~/containers/AdapterMetrics/api.types'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { stableCacheKey } from '~/server/api/cacheKey'
import { addApiRoutePhase, timeApiRoutePhase } from '~/server/api/phaseTelemetry'
import { cachedResult } from '~/server/api/resultCache'
import { mapWithConcurrency } from '~/utils/async'
import { toSlug, type ChartSeries, type ProtocolBreakdownData } from '~/utils/breakdowns'
import { DIMENSIONS_API_METRIC_CONFIG, type AdapterChartBuilderMetric } from './config'

type DimensionsBreakdownParams = {
	metric: AdapterChartBuilderMetric
	chains: Array<string>
	categories: Array<string>
	topN: number
	groupByParent: boolean
	chainFilterMode: 'include' | 'exclude'
	categoryFilterMode: 'include' | 'exclude'
}

type ChainResult = { chain: string; data: IAdapterBreakdownChartData }

export type ProtocolLookup = {
	protocolCategories: Map<string, string>
	protocolCategoriesBySlug: Map<string, string>
	protocolToParentId: Map<string, string>
	parentIdToName: Map<string, string>
}

export type ProtocolBreakdownBase = {
	chainsArray: Array<string>
	metricName: string
	chainResultsCount: number
	totalDataChartBreakdown: Array<[number, Record<string, number>]>
}

const PROTOCOL_BASE_CACHE_MS = 10 * 60 * 1000
const PROTOCOL_BASE_STALE_MS = 20 * 60 * 1000
const PROTOCOL_LOOKUP_CACHE_MS = 60 * 60 * 1000
const PROTOCOL_RANKING_WINDOW_DAYS = 7
let protocolLookupCache: { data: ProtocolLookup; timestamp: number } | null = null

const buildEmptyBreakdown = (
	chainsArray: Array<string>,
	categoriesArray: Array<string>,
	metricName: string,
	topN: number,
	groupByParent: boolean,
	error?: string
): ProtocolBreakdownData => {
	const entityMetadata = groupByParent
		? ({ entityType: 'protocol-family', totalProtocolFamilies: 0 } as const)
		: ({ entityType: 'protocol', totalProtocols: 0 } as const)
	return {
		series: [],
		metadata: {
			chain: chainsArray.join(','),
			chains: chainsArray,
			categories: categoriesArray,
			metric: metricName,
			topN,
			...entityMetadata,
			othersCount: 0,
			marketSector: categoriesArray.join(',') || null,
			...(error ? { error } : {})
		}
	}
}

export const getProtocolLookup = async (): Promise<ProtocolLookup> => {
	if (protocolLookupCache && Date.now() - protocolLookupCache.timestamp < PROTOCOL_LOOKUP_CACHE_MS) {
		return protocolLookupCache.data
	}

	const protocolsData = await timeApiRoutePhase('adapter_protocol_metadata_lookup', () => fetchProtocols())
	const protocolCategories: Map<string, string> = new Map()
	const protocolCategoriesBySlug: Map<string, string> = new Map()
	const protocolToParentId: Map<string, string> = new Map()
	const parentIdToName: Map<string, string> = new Map()
	const protocols = protocolsData.protocols || []
	const parentProtocols = protocolsData.parentProtocols || []

	for (const pp of parentProtocols) {
		if (pp?.id && pp?.name) {
			parentIdToName.set(pp.id, pp.name)
		}
	}

	for (const protocol of protocols) {
		if (protocol.name) {
			if (protocol.category) {
				const cat = protocol.category.toLowerCase()
				protocolCategories.set(protocol.name, cat)
				protocolCategoriesBySlug.set(toSlug(protocol.name), cat)
			}
			if (protocol.parentProtocol) {
				protocolToParentId.set(protocol.name, protocol.parentProtocol)
			}
		}
	}

	const data = {
		parentIdToName,
		protocolCategories,
		protocolCategoriesBySlug,
		protocolToParentId
	}
	protocolLookupCache = { data, timestamp: Date.now() }
	return data
}

const fetchChainResults = async (
	chainsArray: Array<string>,
	metric: AdapterChartBuilderMetric
): Promise<Array<ChainResult>> => {
	const config = DIMENSIONS_API_METRIC_CONFIG[metric]
	return mapWithConcurrency(chainsArray, 8, async (singleChain): Promise<ChainResult> => ({
		chain: singleChain,
		data: await fetchAdapterChainChartDataByProtocolBreakdown({
			adapterType: config.endpoint,
			chain: singleChain.toLowerCase() === 'all' ? 'All' : singleChain,
			...(config.dataType ? { dataType: config.dataType } : {})
		})
	}))
}

const toBreakdownMap = (breakdown: Array<[number, Record<string, number>]>): Map<number, Map<string, number>> => {
	const map = new Map<number, Map<string, number>>()
	for (const [ts, protocols] of breakdown) {
		const m = new Map<string, number>()
		for (const name in protocols) {
			const value = protocols[name]
			if (value === undefined) throw new Error(`Missing adapter protocol value for ${name}`)
			m.set(name, value)
		}
		map.set(ts, m)
	}
	return map
}

const buildAggregatedBreakdown = (
	chainFilterMode: 'include' | 'exclude',
	chainResults: Array<ChainResult>,
	allBreakdown: IAdapterBreakdownChartData | null
): Map<number, Map<string, number>> => {
	const aggregatedBreakdown = new Map<number, Map<string, number>>()

	if (chainFilterMode === 'exclude' && allBreakdown !== null) {
		const allMap = toBreakdownMap(allBreakdown)
		const excludedMaps: Array<Map<number, Map<string, number>>> = []
		for (const result of chainResults) {
			excludedMaps.push(toBreakdownMap(result.data))
		}

		for (const [ts, allProtoMap] of allMap.entries()) {
			const out = new Map<string, number>(allProtoMap)
			for (const exMap of excludedMaps) {
				const exProtoMap = exMap.get(ts)
				if (!exProtoMap) continue
				for (const [p, v] of exProtoMap.entries()) {
					out.set(p, (out.get(p) || 0) - (v || 0))
				}
			}
			aggregatedBreakdown.set(ts, out)
		}
	} else {
		for (const result of chainResults) {
			for (const item of result.data) {
				const [timestamp, protocols] = item

				if (!aggregatedBreakdown.has(timestamp)) {
					aggregatedBreakdown.set(timestamp, new Map())
				}

				const timestampData = aggregatedBreakdown.get(timestamp)!

				for (const protocolName in protocols) {
					const value = protocols[protocolName]
					if (value === undefined) throw new Error(`Missing adapter protocol value for ${protocolName}`)
					const currentValue = timestampData.get(protocolName) || 0
					timestampData.set(protocolName, currentValue + value)
				}
			}
		}
	}

	return aggregatedBreakdown
}

export const getAdapterMetricProtocolBase = async (
	metric: AdapterChartBuilderMetric,
	chainsArray: Array<string>,
	chainFilterMode: 'include' | 'exclude'
): Promise<ProtocolBreakdownBase> => {
	const config = DIMENSIONS_API_METRIC_CONFIG[metric]
	const cacheKey = stableCacheKey([metric, chainsArray, chainFilterMode])

	return cachedResult(
		'adapter-metrics-protocol-breakdown-base',
		cacheKey,
		{
			ttlMs: PROTOCOL_BASE_CACHE_MS,
			ttlJitter: 0.2,
			staleWhileRevalidateMs: PROTOCOL_BASE_STALE_MS,
			maxEntries: 8
		},
		async () => {
			const realChains = chainsArray.filter((chain) => chain.toLowerCase() !== 'all')
			const excludesRealChains = chainFilterMode === 'exclude' && realChains.length > 0
			const [chainResults, allBreakdown] = await timeApiRoutePhase('adapter_protocol_fetch_chains', () =>
				Promise.all([
					fetchChainResults(excludesRealChains ? realChains : chainsArray, metric),
					excludesRealChains
						? fetchAdapterChainChartDataByProtocolBreakdown({
								adapterType: config.endpoint,
								chain: 'All',
								...(config.dataType ? { dataType: config.dataType } : {})
							})
						: Promise.resolve(null)
				])
			)
			const directResult = chainFilterMode === 'include' && chainResults.length === 1 ? chainResults[0] : undefined
			if (directResult) {
				return {
					chainResultsCount: 1,
					chainsArray,
					metricName: config.metricName,
					totalDataChartBreakdown: directResult.data
				}
			}
			const aggregatedBreakdown = await timeApiRoutePhase('adapter_protocol_aggregate', () =>
				buildAggregatedBreakdown(chainFilterMode, chainResults, allBreakdown)
			)
			const convertStartedAt = Date.now()
			const sortedBreakdown = Array.from(aggregatedBreakdown.entries())
			sortedBreakdown.sort(([a], [b]) => a - b)
			const totalDataChartBreakdown: Array<[number, Record<string, number>]> = []
			for (const [timestamp, protocolEntries] of sortedBreakdown) {
				const protocols: Record<string, number> = {}
				for (const [protocol, value] of protocolEntries) protocols[protocol] = value
				totalDataChartBreakdown.push([timestamp, protocols])
			}
			addApiRoutePhase('adapter_protocol_base_to_object', Date.now() - convertStartedAt)

			return {
				chainResultsCount: chainResults.length,
				chainsArray,
				metricName: config.metricName,
				totalDataChartBreakdown
			}
		}
	)
}

export const getAdapterMetricProtocolSeries = async ({
	metric,
	chains,
	categories,
	topN,
	groupByParent,
	chainFilterMode,
	categoryFilterMode
}: DimensionsBreakdownParams): Promise<ProtocolBreakdownData> => {
	const config = DIMENSIONS_API_METRIC_CONFIG[metric]

	const chainsArray = chains.length > 0 ? chains : ['all']
	const categoriesArray = (categories || []).map((cat) => cat.toLowerCase())
	const categoriesSet = new Set(categoriesArray)

	const base = await getAdapterMetricProtocolBase(metric, chainsArray, chainFilterMode)

	if (base.chainResultsCount === 0 && chainFilterMode === 'include') {
		return buildEmptyBreakdown(
			chainsArray,
			categoriesArray,
			config.metricName,
			topN,
			groupByParent,
			`No data available for chains: ${chainsArray.join(', ')}`
		)
	}

	const projectionStartedAt = Date.now()
	const startOfTodayUtc = Math.floor(Date.now() / 86_400_000) * 86_400
	const rankingDays = base.totalDataChartBreakdown
		.filter(([timestamp]) => timestamp < startOfTodayUtc)
		.slice(-PROTOCOL_RANKING_WINDOW_DAYS)

	if (rankingDays.length === 0) {
		return buildEmptyBreakdown(chainsArray, categoriesArray, config.metricName, topN, groupByParent)
	}

	const latestProtocolValues = new Map<string, number>()
	for (const [, protocols] of rankingDays) {
		for (const name in protocols) {
			const value = protocols[name]
			if (value === undefined) throw new Error(`Missing ranked protocol value for ${name}`)
			latestProtocolValues.set(name, value)
		}
	}

	const { parentIdToName, protocolCategories, protocolCategoriesBySlug, protocolToParentId } = await getProtocolLookup()

	const getCategory = (name: string): string => {
		return protocolCategories.get(name) || protocolCategoriesBySlug.get(toSlug(name)) || ''
	}

	let protocolEntries = Array.from(latestProtocolValues, ([name, value]) => ({ name, value }))

	if (categoriesSet.size > 0 && (protocolCategories.size > 0 || protocolCategoriesBySlug.size > 0)) {
		if (categoryFilterMode === 'exclude') {
			protocolEntries = protocolEntries.filter((p) => !categoriesSet.has(getCategory(p.name)))
		} else {
			protocolEntries = protocolEntries.filter((p) => categoriesSet.has(getCategory(p.name)))
		}
	}

	let topProtocols: Array<string>
	let topProtocolsSet: Set<string>
	let protocolNameMapping: Map<string, string> = new Map()
	let protocolFamilyValues: Map<string, { name: string; value: number; isParent: boolean }> = new Map()

	if (groupByParent) {
		for (const entry of protocolEntries) {
			const parentId = protocolToParentId.get(entry.name)
			if (parentId) {
				const parentName = parentIdToName.get(parentId) || entry.name
				const existing = protocolFamilyValues.get(parentId)
				if (existing) {
					protocolFamilyValues.set(parentId, {
						name: parentName,
						value: existing.value + entry.value,
						isParent: true
					})
				} else {
					protocolFamilyValues.set(parentId, {
						name: parentName,
						value: entry.value,
						isParent: true
					})
				}
			} else {
				const key = `protocol:${entry.name}`
				protocolFamilyValues.set(key, {
					name: entry.name,
					value: entry.value,
					isParent: false
				})
			}
		}

		const sortedFamilies = Array.from(protocolFamilyValues.values()).sort((a, b) => b.value - a.value)
		topProtocols = sortedFamilies.slice(0, topN).map((f) => f.name)
		topProtocolsSet = new Set(topProtocols)

		for (const [protocolName, parentId] of protocolToParentId.entries()) {
			const parentName = parentIdToName.get(parentId)
			if (parentName && topProtocolsSet.has(parentName)) {
				protocolNameMapping.set(protocolName, parentName)
			}
		}
	} else {
		const sortedProtocolEntries = protocolEntries.toSorted((a, b) => b.value - a.value)
		topProtocols = sortedProtocolEntries.slice(0, topN).map((p) => p.name)
		topProtocolsSet = new Set(topProtocols)

		for (const entry of protocolEntries) {
			protocolFamilyValues.set(`protocol:${entry.name}`, {
				name: entry.name,
				value: entry.value,
				isParent: false
			})
		}
	}

	const protocolData: Map<string, Map<number, number>> = new Map()
	for (const protocol of topProtocols) {
		protocolData.set(protocol, new Map())
	}

	const timestampTotals: Map<number, number> = new Map()
	const timestampTopTotals: Map<number, number> = new Map()

	for (const item of base.totalDataChartBreakdown) {
		const [timestamp, protocolBreakdown] = item
		if (!protocolBreakdown) continue

		let dayTotal = 0
		let topTotal = 0

		for (const protocolName in protocolBreakdown) {
			const protocolValue = protocolBreakdown[protocolName]
			if (protocolValue === undefined) throw new Error(`Missing protocol breakdown value for ${protocolName}`)
			if (categoriesSet.size > 0 && (protocolCategories.size > 0 || protocolCategoriesBySlug.size > 0)) {
				const cat = getCategory(protocolName)
				const inCategories = categoriesSet.has(cat)
				if (categoryFilterMode === 'exclude' ? inCategories : !inCategories) continue
			}

			dayTotal += protocolValue

			const displayName = groupByParent ? protocolNameMapping.get(protocolName) || protocolName : protocolName

			if (topProtocolsSet.has(displayName)) {
				topTotal += protocolValue
				const series = protocolData.get(displayName)
				if (series) {
					series.set(timestamp, (series.get(timestamp) || 0) + protocolValue)
				}
			}
		}

		timestampTotals.set(timestamp, dayTotal)
		timestampTopTotals.set(timestamp, topTotal)
	}

	const allTimestamps = Array.from(timestampTotals.keys()).sort((a, b) => a - b)

	const series: Array<ChartSeries> = []

	for (const [i, protocol] of topProtocols.entries()) {
		const protocolDataMap = protocolData.get(protocol) || new Map<number, number>()

		const alignedData: Array<[number, number]> = allTimestamps.map((timestamp) => {
			return [timestamp, protocolDataMap.get(timestamp) || 0]
		})

		series.push({
			name: protocol,
			data: alignedData,
			color: chartColor(i)
		})
	}

	const othersData: Array<[number, number]> = allTimestamps.map((timestamp) => {
		const total = timestampTotals.get(timestamp) || 0
		const topTotal = timestampTopTotals.get(timestamp) || 0
		const othersValue = Math.max(0, total - topTotal)
		return [timestamp, othersValue]
	})

	const hasOthersData = othersData.some(([_, value]) => value > 0)
	const totalEntities = groupByParent ? protocolFamilyValues.size : protocolEntries.length
	const othersCount = Math.max(0, totalEntities - topN)
	const entityMetadata = groupByParent
		? ({ entityType: 'protocol-family', totalProtocolFamilies: totalEntities } as const)
		: ({ entityType: 'protocol', totalProtocols: totalEntities } as const)
	const othersEntityLabel = groupByParent ? (othersCount === 1 ? 'protocol family' : 'protocol families') : 'protocols'

	if (hasOthersData) {
		series.push({
			name: `Others (${othersCount} ${othersEntityLabel})`,
			data: othersData,
			color: OTHERS_COLOR
		})
	}
	addApiRoutePhase('adapter_protocol_project', Date.now() - projectionStartedAt)

	return {
		series,
		metadata: {
			chain: chainsArray.join(','),
			chains: chainsArray,
			categories: categoriesArray,
			metric: config.metricName,
			topN,
			...entityMetadata,
			othersCount,
			marketSector: categoriesArray.join(',') || null
		}
	}
}
