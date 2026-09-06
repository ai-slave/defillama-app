import { fetchChainChart } from '~/containers/Chains/api'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { fetchProtocolTvlChart } from '~/containers/ProtocolOverview/api'
import { fetchCategoryChart } from '~/containers/ProtocolTaxonomy/api'
import { mapWithConcurrency } from '~/utils/async'
import {
	alignSeries,
	BREAKDOWN_COLOR_PALETTE,
	filterOutToday,
	normalizeDailyPairs,
	sumSeriesByTimestamp,
	toSlug,
	type ChartSeries,
	type ProtocolBreakdownData
} from '~/utils/breakdowns'
import { processAdjustedTvl } from '~/utils/tvl'
import { sumProtocolTvlBreakdown } from './protocolTvlBreakdown'
import { buildProtocolTvlRanking, fetchProtocolTvlRankingRows } from './protocolTvlRanking'

const fetchChainTotalTvl = async (chains: Array<string>): Promise<Array<[number, number]>> => {
	const isAll = chains.length === 0 || chains.some((c) => c.toLowerCase() === 'all')
	if (isAll) {
		const j = await fetchChainChart()
		const adjustedTvl = processAdjustedTvl(j)
		return filterOutToday(normalizeDailyPairs(adjustedTvl, 'last'))
	}

	const perChain = await mapWithConcurrency(chains, 8, async (chain) => {
		const j = await fetchChainChart(chain)
		const adjustedTvl = processAdjustedTvl(j)
		return filterOutToday(normalizeDailyPairs(adjustedTvl, 'last'))
	})
	const summed = sumSeriesByTimestamp(perChain)
	return Array.from(summed.entries()).sort((a, b) => a[0] - b[0])
}

const subtractSeries = (a: Array<[number, number]>, b: Array<[number, number]>): Array<[number, number]> => {
	const mapA = new Map<number, number>()
	for (const [timestamp, value] of a) mapA.set(timestamp, value)
	for (const [t, v] of b) {
		mapA.set(t, (mapA.get(t) || 0) - (v || 0))
	}
	return Array.from(mapA.entries()).sort((x, y) => x[0] - y[0])
}

const fetchAllChainTotalTvl = async (): Promise<Array<[number, number]>> => {
	return fetchChainTotalTvl(['all'])
}

const fetchChainTvlSingle = async (chain: string): Promise<Array<[number, number]>> => {
	const j = await fetchChainChart(chain)
	const adjustedTvl = processAdjustedTvl(j)
	return filterOutToday(normalizeDailyPairs(adjustedTvl, 'last'))
}

const fetchCategorySeriesAll = async (category: string): Promise<Array<[number, number]>> => {
	const j = await fetchCategoryChart({ category })
	const tvl = j?.tvl || {}
	const mapped: Array<[number, number]> = []
	for (const ts in tvl) mapped.push([parseInt(ts, 10), Number(tvl[ts]) || 0])
	return filterOutToday(normalizeDailyPairs(mapped, 'last'))
}

const fetchCategorySeriesPerChain = async (category: string, chain: string): Promise<Array<[number, number]>> => {
	const j = await fetchCategoryChart({ category, chain })
	const tvl = j?.tvl || {}
	const mapped: Array<[number, number]> = []
	for (const ts in tvl) mapped.push([parseInt(ts, 10), Number(tvl[ts]) || 0])
	return filterOutToday(normalizeDailyPairs(mapped, 'last'))
}

const fetchCategoryTvl = async (chains: Array<string>, categories: Array<string>): Promise<Array<[number, number]>> => {
	if (categories.length === 0) {
		return fetchChainTotalTvl(chains)
	}

	const isAllChains = chains.length === 0 || chains.some((c) => c.toLowerCase() === 'all')
	const requests: Array<{ category: string; chain: string | null }> = []

	for (const category of categories) {
		if (isAllChains) {
			requests.push({ category, chain: null })
		} else {
			for (const chain of chains) {
				requests.push({ category, chain })
			}
		}
	}

	const allCategoryData = await mapWithConcurrency(requests, 8, ({ category, chain }) =>
		chain === null ? fetchCategorySeriesAll(category) : fetchCategorySeriesPerChain(category, chain)
	)
	const summed = sumSeriesByTimestamp(allCategoryData)
	return Array.from(summed.entries()).sort((a, b) => a[0] - b[0])
}

export const getTvlBreakdownData = async (
	chains: Array<string>,
	categories: Array<string>,
	topN: number,
	groupByParent: boolean = false,
	chainFilterMode: 'include' | 'exclude' = 'include',
	categoryFilterMode: 'include' | 'exclude' = 'include'
): Promise<ProtocolBreakdownData> => {
	const selectedChains = (chains && chains.length > 0 ? chains : ['all']).filter(Boolean)
	const isAll = selectedChains.some((c) => c.toLowerCase() === 'all')
	const categoriesFilter = (categories || []).map((c) => c.toLowerCase())

	const [protocolsJson, rankingRows] = await Promise.all([
		fetchProtocols(),
		fetchProtocolTvlRankingRows({ chains: selectedChains, chainFilterMode })
	])
	const protocolNameBySlug = new Map<string, string>()
	for (const protocol of protocolsJson.protocols) {
		const protocolSlug = toSlug(protocol.name)
		if (protocolSlug) protocolNameBySlug.set(protocolSlug, protocol.name)
	}
	const parentNameBySlug = new Map<string, string>()
	for (const parent of protocolsJson.parentProtocols) {
		const parentSlug = toSlug(parent.name)
		if (parentSlug) parentNameBySlug.set(parentSlug, parent.name)
		if (parent.id) parentNameBySlug.set(parent.id.replace(/^parent#/, ''), parent.name)
	}

	const excludedChainSetForProtocols: Set<string> = new Set(chainFilterMode === 'exclude' ? selectedChains : [])
	const includedChainSetForProtocols: Set<string> = new Set(
		chainFilterMode === 'include' && !isAll ? selectedChains : []
	)

	const hasRealExcludedChains =
		chainFilterMode === 'exclude' &&
		Array.from(excludedChainSetForProtocols).some((chain) => chain.toLowerCase() !== 'all')
	const ranking = buildProtocolTvlRanking({
		rows: rankingRows,
		topN,
		groupByParent,
		categories,
		categoryFilterMode
	})
	const childrenByParent = new Map<string, Set<string>>()
	for (const row of ranking.eligibleRows) {
		if (!row.parentProtocolSlug || row.excludeTvlFromParent) continue
		const children = childrenByParent.get(row.parentProtocolSlug) ?? new Set<string>()
		children.add(row.protocolSlug)
		childrenByParent.set(row.parentProtocolSlug, children)
	}
	const top = ranking.items.map((item) => ({
		name: item.isParent
			? (parentNameBySlug.get(item.protocolSlug) ?? protocolNameBySlug.get(item.protocolSlug) ?? item.protocolSlug)
			: (protocolNameBySlug.get(item.protocolSlug) ?? item.protocolSlug),
		slug: item.protocolSlug,
		parentId: item.parentProtocolSlug,
		isParent: item.isParent
	}))
	const uniqueTotal = ranking.totalEntities
	const emptyEntityMetadata = groupByParent
		? ({ entityType: 'protocol-family', totalProtocolFamilies: 0 } as const)
		: ({ entityType: 'protocol', totalProtocols: 0 } as const)

	if (top.length === 0) {
		const displayChains = isAll ? ['All'] : selectedChains
		return {
			series: [],
			metadata: {
				chain: displayChains.join(','),
				chains: displayChains,
				categories,
				metric: 'TVL',
				topN,
				...emptyEntityMetadata,
				othersCount: 0,
				marketSector: categories.join(',') || null
			}
		}
	}

	const protocolSeries = await mapWithConcurrency(top, 8, async (t) => {
		const useChildrenOnly = groupByParent && !!t.parentId && categoriesFilter.length > 0

		const buildSeriesForSlug = async (slug: string): Promise<Array<[number, number]>> => {
			const chart = await fetchProtocolTvlChart({ protocol: slug, breakdownType: 'chain-breakdown' })
			return sumProtocolTvlBreakdown(chart, {
				...(chainFilterMode === 'exclude' && hasRealExcludedChains
					? { excludeChains: excludedChainSetForProtocols }
					: null),
				...(chainFilterMode === 'include' && !isAll && includedChainSetForProtocols.size > 0
					? { includeChains: includedChainSetForProtocols }
					: null)
			})
		}

		if (useChildrenOnly) {
			const childSet = t.parentId ? childrenByParent.get(t.parentId) : undefined
			const childSlugs = childSet ? Array.from(childSet) : []
			if (childSlugs.length === 0) {
				return { name: t.name, data: [] }
			}
			const childSeries = await mapWithConcurrency(childSlugs, 8, buildSeriesForSlug)
			const summed = sumSeriesByTimestamp(childSeries)
			const data = Array.from(summed.entries()).sort((a, b) => a[0] - b[0])
			return { name: t.name, data }
		}

		const data = await buildSeriesForSlug(t.slug)
		return { name: t.name, data }
	})

	let totalSeries: Array<[number, number]>
	const hasCategories = categoriesFilter.length > 0
	const excludedChains = selectedChains.filter((c) => c.toLowerCase() !== 'all')

	const buildCategorySeriesAll = async (): Promise<Array<[number, number]>> => {
		const perCategoryAll = await mapWithConcurrency(categoriesFilter, 8, fetchCategorySeriesAll)
		return Array.from(sumSeriesByTimestamp(perCategoryAll).entries()).sort((a, b) => a[0] - b[0])
	}

	const buildCategorySeriesExcludingChains = async (): Promise<Array<[number, number]>> => {
		let series = await buildCategorySeriesAll()
		if (excludedChains.length === 0) return series
		const excludedRequests: Array<{ category: string; chain: string }> = []
		for (const category of categoriesFilter) {
			for (const chain of excludedChains) excludedRequests.push({ category, chain })
		}
		const excludedSeries = await mapWithConcurrency(excludedRequests, 8, ({ category, chain }) =>
			fetchCategorySeriesPerChain(category, chain)
		)
		const sumExcludedCatsAcrossChains = Array.from(sumSeriesByTimestamp(excludedSeries).entries()).sort(
			(a, b) => a[0] - b[0]
		)
		return subtractSeries(series, sumExcludedCatsAcrossChains)
	}

	const buildTotalSeriesForChains = async (): Promise<Array<[number, number]>> => {
		if (chainFilterMode === 'exclude' && hasRealExcludedChains) {
			const allTvl = await fetchAllChainTotalTvl()
			const excludedPerChain = await mapWithConcurrency(excludedChains, 8, fetchChainTvlSingle)
			const sumExcluded = Array.from(sumSeriesByTimestamp(excludedPerChain).entries()).sort((a, b) => a[0] - b[0])
			return subtractSeries(allTvl, sumExcluded)
		}
		return fetchChainTotalTvl(isAll ? ['all'] : selectedChains)
	}

	const buildCategorySeriesWithChains = async (): Promise<Array<[number, number]>> => {
		if (chainFilterMode === 'exclude' && hasRealExcludedChains) {
			return buildCategorySeriesExcludingChains()
		}
		return fetchCategoryTvl(isAll ? ['all'] : selectedChains, categoriesFilter)
	}

	if (hasCategories) {
		if (categoryFilterMode === 'include') {
			totalSeries = await buildCategorySeriesWithChains()
		} else {
			const base = await buildTotalSeriesForChains()
			const excludedCats = await buildCategorySeriesWithChains()
			totalSeries = subtractSeries(base, excludedCats)
		}
	} else {
		totalSeries = await buildTotalSeriesForChains()
	}

	const timestampSet = new Set<number>()
	for (const [t] of totalSeries) {
		timestampSet.add(t)
	}
	for (const s of protocolSeries) {
		for (const [t] of s.data) {
			timestampSet.add(t)
		}
	}
	const allTimestamps = Array.from(timestampSet).sort((a, b) => a - b)

	const alignedProtocolSeries: Array<ChartSeries> = protocolSeries.map((s, idx) => {
		const color = BREAKDOWN_COLOR_PALETTE[idx % BREAKDOWN_COLOR_PALETTE.length]
		return {
			name: s.name,
			data: alignSeries(allTimestamps, s.data),
			...(color !== undefined ? { color } : {})
		}
	})

	const alignedTotal = alignSeries(allTimestamps, totalSeries)
	const topSumPerTs = alignSeries(
		allTimestamps,
		Array.from(sumSeriesByTimestamp(alignedProtocolSeries.map((s) => s.data)).entries()).sort((a, b) => a[0] - b[0])
	)

	const othersData: Array<[number, number]> = allTimestamps.map((t, i) => {
		const total = alignedTotal[i]?.[1] || 0
		const topSum = topSumPerTs[i]?.[1] || 0
		const rest = Math.max(0, total - topSum)
		return [t, rest]
	})

	const hasOthers = othersData.some(([, v]) => v > 0)
	const othersCount = Math.max(0, uniqueTotal - protocolSeries.length)
	const entityMetadata = groupByParent
		? ({ entityType: 'protocol-family', totalProtocolFamilies: uniqueTotal } as const)
		: ({ entityType: 'protocol', totalProtocols: uniqueTotal } as const)
	const othersEntityLabel = groupByParent ? (othersCount === 1 ? 'protocol family' : 'protocol families') : 'protocols'

	const series: Array<ChartSeries> = [...alignedProtocolSeries]
	if (hasOthers) {
		series.push({
			name: `Others (${othersCount} ${othersEntityLabel})`,
			data: othersData,
			color: '#999999'
		})
	}

	const displayChains = isAll ? ['All'] : selectedChains
	return {
		series,
		metadata: {
			chain: displayChains.join(','),
			chains: displayChains,
			categories,
			metric: 'TVL',
			topN,
			...entityMetadata,
			othersCount,
			marketSector: categories.join(',') || null
		}
	}
}
