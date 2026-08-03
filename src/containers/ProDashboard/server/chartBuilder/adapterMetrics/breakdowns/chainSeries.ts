import {
	fetchAdapterChainChartData,
	fetchAdapterChainChartDataByProtocolBreakdown,
	fetchAdapterChainMetrics,
	fetchAdapterProtocolChartDataByBreakdownType
} from '~/containers/AdapterMetrics/api'
import type { AdapterChainProtocol, IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import {
	displayChainName,
	resolveAllowedChainNamesFromCategories,
	resolveAllowedChainSlugsFromCategories
} from '~/containers/ProDashboard/server/chartBuilder/breakdownChains'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { stableCacheKey } from '~/server/api/cacheKey'
import { addApiRoutePhase, timeApiRoutePhase } from '~/server/api/phaseTelemetry'
import { cachedResult } from '~/server/api/resultCache'
import { mapWithConcurrency } from '~/utils/async'
import {
	BREAKDOWN_COLOR_PALETTE,
	buildAlignedTopAndOthers,
	filterOutToday,
	normalizeDailyPairs,
	sumSeriesByTimestamp,
	toSlug,
	type ChartSeries,
	type ProtocolChainData
} from '~/utils/breakdowns'
import { toDimensionsSlug, toDisplayName } from '~/utils/chainNormalizer'
import {
	DIMENSIONS_API_METRIC_CONFIG,
	type AdapterChartBuilderMetric,
	type AdapterMetricChartBuilderConfig
} from './config'

type ProtocolCategoryLookup = {
	byName: Map<string, string>
	bySlug: Map<string, string>
}

const createEmptyCategoryLookup = (): ProtocolCategoryLookup => ({
	byName: new Map(),
	bySlug: new Map()
})

const cloneCategoryLookup = (lookup: ProtocolCategoryLookup): ProtocolCategoryLookup => ({
	byName: new Map(lookup.byName),
	bySlug: new Map(lookup.bySlug)
})

let protocolCategoryCache: { data: ProtocolCategoryLookup; timestamp: number } | null = null
const PROTOCOL_CATEGORY_CACHE_MS = 60 * 60 * 1000
const CHAIN_OVERVIEW_CACHE_MS = 10 * 60 * 1000
const CHAIN_OVERVIEW_STALE_MS = 20 * 60 * 1000

const registerCategoryLookupEntry = (
	lookup: ProtocolCategoryLookup,
	identifier: string | undefined,
	category: string | null | undefined,
	options: { asSlug?: boolean } = {}
) => {
	if (!lookup || !identifier || !category) return
	const normalizedIdentifier = identifier.toLowerCase()
	const normalizedCategory = category.toLowerCase()
	if (options.asSlug) {
		lookup.bySlug.set(normalizedIdentifier, normalizedCategory)
	} else {
		lookup.byName.set(normalizedIdentifier, normalizedCategory)
	}
}

const extendLookupWithOverviewProtocols = (
	lookup: ProtocolCategoryLookup | null,
	overviewProtocols: AdapterChainProtocol[]
) => {
	if (!lookup) return
	for (const proto of overviewProtocols) {
		const category = (proto.category || '').toLowerCase()
		if (!category) continue
		registerCategoryLookupEntry(lookup, proto.name, category)
		registerCategoryLookupEntry(lookup, proto.displayName, category)
		registerCategoryLookupEntry(lookup, proto.slug, category, { asSlug: true })
	}
}

const getCategoryFromLookup = (lookup: ProtocolCategoryLookup | null, name?: string): string => {
	if (!lookup || !name) return ''
	const normalizedName = name.toLowerCase()
	const categoryByName = lookup.byName.get(normalizedName)
	if (categoryByName !== undefined) return categoryByName
	const slug = toSlug(name)
	const categoryBySlug = slug ? lookup.bySlug.get(slug) : undefined
	if (categoryBySlug !== undefined) return categoryBySlug
	return ''
}

const sumValues = (values: Record<string, number>): number => {
	let total = 0
	for (const key in values) {
		const value = values[key]
		if (value === undefined) throw new Error(`Missing adapter metric value for ${key}`)
		total += value
	}
	return total
}

const getBreakdownColor = (index: number): string => {
	const color = BREAKDOWN_COLOR_PALETTE[index % BREAKDOWN_COLOR_PALETTE.length]
	if (color === undefined) throw new Error('Breakdown color palette must not be empty')
	return color
}

const fetchCachedAdapterChainMetrics = async (config: AdapterMetricChartBuilderConfig): Promise<IAdapterChainMetrics> =>
	cachedResult(
		'adapter-metrics-chain-overview-base',
		stableCacheKey([config.endpoint, config.dataType]),
		{ ttlMs: CHAIN_OVERVIEW_CACHE_MS, ttlJitter: 0.2, staleWhileRevalidateMs: CHAIN_OVERVIEW_STALE_MS },
		() =>
			timeApiRoutePhase('adapter_chain_fetch_metrics', () =>
				fetchAdapterChainMetrics({
					adapterType: config.endpoint,
					chain: 'All',
					...(config.dataType ? { dataType: config.dataType } : {})
				})
			)
	)

const getProtocolCategoryLookup = async (): Promise<ProtocolCategoryLookup> => {
	if (protocolCategoryCache && Date.now() - protocolCategoryCache.timestamp < PROTOCOL_CATEGORY_CACHE_MS) {
		return protocolCategoryCache.data
	}
	const json = await fetchProtocols()
	const lookup = createEmptyCategoryLookup()
	for (const proto of json.protocols) {
		const category = (proto.category || '').toLowerCase()
		if (!category) continue
		registerCategoryLookupEntry(lookup, proto.name, category)
		registerCategoryLookupEntry(lookup, toSlug(proto.name), category, { asSlug: true })
	}
	protocolCategoryCache = { data: lookup, timestamp: Date.now() }
	return lookup
}

async function getDimensionsProtocolChainData(
	protocol: string,
	metric: AdapterChartBuilderMetric,
	chains?: string[],
	topN: number = 5,
	chainFilterMode: 'include' | 'exclude' = 'include',
	chainCategoryFilterMode: 'include' | 'exclude' = 'include',
	chainCategories?: string[]
): Promise<ProtocolChainData> {
	const config = DIMENSIONS_API_METRIC_CONFIG[metric]

	try {
		const breakdown = await timeApiRoutePhase('adapter_protocol_chain_fetch_breakdown', () =>
			fetchAdapterProtocolChartDataByBreakdownType({
				adapterType: config.endpoint,
				protocol,
				type: 'chain',
				...(config.dataType ? { dataType: config.dataType } : {})
			})
		)
		const projectStartedAt = Date.now()

		if (breakdown.length === 0) {
			return {
				series: [],
				metadata: {
					protocol,
					metric: config.metricName,
					chains: [],
					totalChains: 0
				}
			}
		}

		const chainDataMap = new Map<string, [number, number][]>()

		const chainSet = chains && chains.length > 0 ? new Set(chains) : new Set<string>()
		let allowNamesFromCategories: Set<string> | null = null
		if (chainCategories && chainCategories.length > 0) {
			allowNamesFromCategories = await resolveAllowedChainNamesFromCategories(chainCategories)
		}
		for (const item of breakdown) {
			const [timestamp, chainData] = item

			for (const chain in chainData) {
				const chainTotal = chainData[chain]
				if (chainTotal === undefined) throw new Error(`Missing adapter chain total for ${chain}`)
				if (chains && chains.length > 0) {
					const matches = chainSet.has(chain)
					if (chainFilterMode === 'include') {
						if (!matches) continue
					} else {
						if (matches) continue
					}
				}

				if (allowNamesFromCategories && allowNamesFromCategories.size > 0) {
					if (chainCategoryFilterMode === 'include') {
						if (!allowNamesFromCategories.has(chain)) continue
					} else {
						if (allowNamesFromCategories.has(chain)) continue
					}
				}

				if (chainTotal > 0) {
					const existing = chainDataMap.get(chain)
					if (existing) existing.push([timestamp, chainTotal])
					else chainDataMap.set(chain, [[timestamp, chainTotal]])
				}
			}
		}

		const series: ChartSeries[] = []
		let colorIndex = 0

		for (const [chain, chainSeriesData] of chainDataMap) {
			const sortedData = chainSeriesData.toSorted((a, b) => a[0] - b[0])
			series.push({
				name: chain,
				data: filterOutToday(sortedData),
				color: getBreakdownColor(colorIndex)
			})
			colorIndex++
		}

		const sortedSeries = series.toSorted((a, b) => {
			const lastA = a.data[a.data.length - 1]?.[1] || 0
			const lastB = b.data[b.data.length - 1]?.[1] || 0
			return lastB - lastA
		})

		const availableChains = sortedSeries.map((s) => s.name)

		const topSeries = sortedSeries.slice(0, Math.min(topN, sortedSeries.length))
		const othersSeries = sortedSeries.slice(Math.min(topN, sortedSeries.length))

		const totalSeries = Array.from(sumSeriesByTimestamp(sortedSeries.map((s) => s.data)).entries()).sort(
			(a, b) => a[0] - b[0]
		)
		const { alignedTopSeries, othersData } = buildAlignedTopAndOthers(topSeries, totalSeries)

		const hasOthers = othersSeries.length > 0 && othersData.some(([, v]) => v > 0)

		const finalSeries: ChartSeries[] = [...alignedTopSeries]
		if (hasOthers) {
			finalSeries.push({
				name: `Others (${othersSeries.length} chains)`,
				data: othersData,
				color: '#999999'
			})
		}
		addApiRoutePhase('adapter_protocol_chain_project', Date.now() - projectStartedAt)

		return {
			series: finalSeries,
			metadata: {
				protocol,
				metric: config.metricName,
				chains: availableChains,
				totalChains: availableChains.length,
				topN: Math.min(topN, sortedSeries.length),
				othersCount: Math.max(0, sortedSeries.length - Math.min(topN, sortedSeries.length))
			}
		}
	} catch (error) {
		console.log(`Error fetching ${metric} for protocol ${protocol}:`, error)
		throw error
	}
}

async function getAllProtocolsTopChainsDimensionsData(
	metric: AdapterChartBuilderMetric,
	topN: number = 5,
	chains?: string[],
	chainFilterMode: 'include' | 'exclude' = 'include',
	chainCategoryFilterMode: 'include' | 'exclude' = 'include',
	protocolCategoryFilterMode: 'include' | 'exclude' = 'include',
	chainCategories?: string[],
	protocolCategories?: string[]
): Promise<ProtocolChainData> {
	const config = DIMENSIONS_API_METRIC_CONFIG[metric]

	try {
		const overview = await fetchCachedAdapterChainMetrics(config)
		const rankStartedAt = Date.now()

		const protocolCategoryFilterSet = new Set<string>()
		for (const cat of protocolCategories || []) {
			const lower = cat?.toLowerCase()
			if (lower) protocolCategoryFilterSet.add(lower)
		}
		const hasProtocolCategoryFilter = protocolCategoryFilterSet.size > 0

		let protocolCategoryLookup: ProtocolCategoryLookup | null = null
		if (hasProtocolCategoryFilter) {
			protocolCategoryLookup = cloneCategoryLookup(await getProtocolCategoryLookup())
		}

		const chainTotals = new Map<string, number>()
		const protocols = overview.protocols
		const allChainsFromApi = overview.allChains

		if (protocolCategoryLookup) {
			extendLookupWithOverviewProtocols(protocolCategoryLookup, protocols)
		}

		const resolveProtocolCategory = (protocolName: string, fallbackCategory?: string): string => {
			const fallback = (fallbackCategory || '').toLowerCase()
			if (fallback) return fallback
			return getCategoryFromLookup(protocolCategoryLookup, protocolName)
		}

		const shouldIncludeProtocol = (protocolName: string, fallbackCategory?: string): boolean => {
			if (!hasProtocolCategoryFilter) return true
			const category = resolveProtocolCategory(protocolName, fallbackCategory)
			if (!category) return protocolCategoryFilterMode === 'exclude'
			if (protocolCategoryFilterMode === 'include') {
				return protocolCategoryFilterSet.has(category)
			}
			return !protocolCategoryFilterSet.has(category)
		}

		const aggregateProtocolsForTimestamp = (protocolsMap: Record<string, number>): number => {
			let total = 0
			for (const protocolName in protocolsMap) {
				if (!shouldIncludeProtocol(protocolName)) continue
				const value = protocolsMap[protocolName]
				if (value === undefined) throw new Error(`Missing adapter protocol value for ${protocolName}`)
				total += value
			}
			return total
		}
		for (const p of protocols) {
			const protocolName = p.name || p.displayName || p.slug
			if (!shouldIncludeProtocol(protocolName, p.category || undefined)) continue

			const br24 = p.breakdown24h
			if (!br24) continue
			for (const chainSlug in br24) {
				const versions = br24[chainSlug]
				if (versions === undefined) throw new Error(`Missing adapter chain breakdown for ${chainSlug}`)
				const sum = sumValues(versions)
				chainTotals.set(chainSlug, (chainTotals.get(chainSlug) || 0) + sum)
			}
		}

		// The canonical metrics contract uses Dimensions slugs in `protocols[].breakdown24h`
		// while `allChains` contains display names, so normalize both before filtering.
		const filterSet = new Set<string>((chains || []).map((c) => toDimensionsSlug(c)))
		const filterSetOriginal = new Set<string>((chains || []).map((c) => c.toLowerCase()))
		let allowSlugsFromCategories: Set<string> | null = null
		if (chainCategories && chainCategories.length > 0) {
			allowSlugsFromCategories = await resolveAllowedChainSlugsFromCategories(chainCategories)
		}

		if (chains && chains.length > 0 && chainFilterMode === 'include') {
			for (const chainName of allChainsFromApi) {
				const slug = toDimensionsSlug(chainName)
				if ((filterSet.has(slug) || filterSetOriginal.has(chainName.toLowerCase())) && !chainTotals.has(slug)) {
					chainTotals.set(slug, 0)
				}
			}
		}

		const ranked: Array<[string, number]> = []
		const keepsExplicitlyIncludedZero = Boolean(chains && chains.length > 0 && chainFilterMode === 'include')
		for (const [slug, value] of chainTotals) {
			if (chains && chains.length > 0) {
				if (chainFilterMode === 'include') {
					if (!filterSet.has(slug)) continue
				} else if (filterSet.has(slug)) {
					continue
				}
			}
			if (!keepsExplicitlyIncludedZero && value <= 0) continue

			if (allowSlugsFromCategories && allowSlugsFromCategories.size > 0) {
				const categoryMatches = allowSlugsFromCategories.has(toDimensionsSlug(slug))
				if (chainCategoryFilterMode === 'include' ? !categoryMatches : categoryMatches) continue
			}

			ranked.push([slug, value])
		}
		ranked.sort((a, b) => b[1] - a[1])

		const picked = ranked.slice(0, Math.min(topN, ranked.length)).map(([slug]) => slug)
		addApiRoutePhase('adapter_chain_rank', Date.now() - rankStartedAt)

		const seriesRaw = await timeApiRoutePhase('adapter_chain_fetch_series', () =>
			mapWithConcurrency(picked, 8, async (slug, idx) => {
				const endpointSlug = toDisplayName(slug)
				let normalized: Array<[number, number]>
				if (hasProtocolCategoryFilter) {
					const breakdownSeries = await fetchAdapterChainChartDataByProtocolBreakdown({
						adapterType: config.endpoint,
						chain: endpointSlug,
						...(config.dataType ? { dataType: config.dataType } : {})
					})
					normalized = filterOutToday(
						normalizeDailyPairs(
							breakdownSeries.map(([timestamp, protocolsAtTimestamp]) => [
								timestamp,
								aggregateProtocolsForTimestamp(protocolsAtTimestamp)
							])
						)
					)
				} else {
					const totalDataChart = await fetchAdapterChainChartData({
						adapterType: config.endpoint,
						chain: endpointSlug,
						...(config.dataType ? { dataType: config.dataType } : {})
					})
					normalized = filterOutToday(normalizeDailyPairs(totalDataChart))
				}

				return {
					name: displayChainName(slug),
					data: normalized,
					color: getBreakdownColor(idx)
				}
			})
		)

		const projectStartedAt = Date.now()
		const totalNormalized = Array.from(sumSeriesByTimestamp(seriesRaw.map((series) => series.data))).sort(
			(a, b) => a[0] - b[0]
		)

		const { alignedTopSeries } = buildAlignedTopAndOthers(seriesRaw, totalNormalized)

		const includedTopCount = alignedTopSeries.length
		const othersCount = Math.max(0, ranked.length - includedTopCount)
		addApiRoutePhase('adapter_chain_project', Date.now() - projectStartedAt)

		return {
			series: alignedTopSeries,
			metadata: {
				protocol: 'All Protocols',
				metric: config.metricName,
				chains: alignedTopSeries.map((entry) => entry.name),
				totalChains: ranked.length,
				topN: includedTopCount,
				othersCount
			}
		}
	} catch (e) {
		console.log(`Error building all-protocols ${metric} by chain:`, e)
		throw e
	}
}

type AdapterMetricChainBreakdownParams = {
	protocol?: string
	metric: AdapterChartBuilderMetric
	chains: string[]
	topN: number
	chainFilterMode: 'include' | 'exclude'
	chainCategoryFilterMode: 'include' | 'exclude'
	protocolCategoryFilterMode: 'include' | 'exclude'
	chainCategories: string[]
	protocolCategories: string[]
}

export const getAdapterMetricChainSeries = async ({
	protocol,
	metric,
	chains,
	topN,
	chainFilterMode,
	chainCategoryFilterMode,
	protocolCategoryFilterMode,
	chainCategories,
	protocolCategories
}: AdapterMetricChainBreakdownParams): Promise<ProtocolChainData> => {
	const protocolStr = typeof protocol === 'string' ? protocol : undefined
	const isProtocolAll = !protocolStr || protocolStr.toLowerCase() === 'all'

	if (isProtocolAll) {
		return getAllProtocolsTopChainsDimensionsData(
			metric,
			topN,
			chains,
			chainFilterMode,
			chainCategoryFilterMode,
			protocolCategoryFilterMode,
			chainCategories,
			protocolCategories
		)
	}

	return getDimensionsProtocolChainData(
		protocolStr,
		metric,
		chains,
		topN,
		chainFilterMode,
		chainCategoryFilterMode,
		chainCategories
	)
}
