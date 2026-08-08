import { fetchChainChart, fetchChainsTvlOverview } from '~/containers/Chains/api'
import { resolveAllowedChainNamesFromCategories } from '~/containers/ProDashboard/server/chartBuilder/breakdownChains'
import { fetchProtocolTvlChart } from '~/containers/ProtocolOverview/api'
import { mapWithConcurrency } from '~/utils/async'
import {
	BREAKDOWN_COLOR_PALETTE,
	buildAlignedTopAndOthers,
	filterOutToday,
	normalizeDailyPairs,
	type ChartSeries,
	type ProtocolChainData
} from '~/utils/breakdowns'
import { processAdjustedTvl } from '~/utils/tvl'
import { buildTopProtocolChainSeries } from './protocolTvlBreakdown'

async function getTvlProtocolChainData(
	protocol: string,
	chains?: string[],
	topN: number = 5,
	chainFilterMode: 'include' | 'exclude' = 'include',
	chainCategoryFilterMode: 'include' | 'exclude' = 'include',
	chainCategories?: string[]
): Promise<ProtocolChainData> {
	try {
		const chart = await fetchProtocolTvlChart({ protocol, breakdownType: 'chain-breakdown' })
		const chainSet = chains?.length ? new Set(chains) : undefined
		let allowNamesFromCategories: Set<string> | null = null
		if (chainCategories?.length) {
			allowNamesFromCategories = await resolveAllowedChainNamesFromCategories(chainCategories)
		}

		const result = buildTopProtocolChainSeries({
			chart,
			topN,
			filter: {
				...(chainSet
					? chainFilterMode === 'include'
						? { includeChains: chainSet }
						: { excludeChains: chainSet }
					: {}),
				categoryChains: allowNamesFromCategories,
				categoryFilterMode: chainCategoryFilterMode
			}
		})

		return {
			series: result.series,
			metadata: {
				protocol,
				metric: 'TVL',
				chains: result.chains,
				totalChains: result.totalChains,
				topN: result.topN,
				othersCount: result.othersCount
			}
		}
	} catch (error) {
		console.log(`Error fetching TVL for protocol ${protocol}:`, error)
		throw error
	}
}

async function getAllProtocolsTopChainsTvlData(
	topN: number = 5,
	chains?: string[],
	chainFilterMode: 'include' | 'exclude' = 'include',
	chainCategoryFilterMode: 'include' | 'exclude' = 'include',
	chainCategories?: string[]
): Promise<ProtocolChainData> {
	try {
		const allChains = await fetchChainsTvlOverview()
		const includeSet = new Set<string>(chains || [])
		let allowNamesFromCategories: Set<string> | null = null
		if (chainCategories && chainCategories.length > 0) {
			allowNamesFromCategories = await resolveAllowedChainNamesFromCategories(chainCategories)
		}

		let ranked = allChains
			.filter((c) => typeof c.tvl === 'number' && c.tvl > 0 && c.name)
			.filter((c) => {
				if (!chains || chains.length === 0) return true
				if (chainFilterMode === 'include') return includeSet.has(c.name)
				return !includeSet.has(c.name)
			})
			.filter((c) => {
				if (!allowNamesFromCategories || allowNamesFromCategories.size === 0) return true
				if (chainCategoryFilterMode === 'include') return allowNamesFromCategories.has(c.name)
				return !allowNamesFromCategories.has(c.name)
			})
			.sort((a, b) => (b.tvl || 0) - (a.tvl || 0))

		const picked = ranked.slice(0, Math.min(topN, ranked.length))
		const pickedNames = picked.map((c) => c.name)
		const hasScopedFilter = Boolean(chains?.length || chainCategories?.length)

		const [globalJson, chainResponses] = await Promise.all([
			hasScopedFilter ? null : fetchChainChart(),
			mapWithConcurrency(pickedNames, 8, (name) => fetchChainChart(name).then((data) => ({ name, data })))
		])

		const topSeriesRaw: ChartSeries[] = []
		let colorIndex = 0
		for (const chainResponse of chainResponses) {
			const { name, data: j } = chainResponse
			const adjustedTvl = processAdjustedTvl(j)
			const normalized = filterOutToday(
				normalizeDailyPairs(
					adjustedTvl.map(([ts, v]) => [Number(ts), Number(v)]),
					'last'
				)
			)
			const color = BREAKDOWN_COLOR_PALETTE[colorIndex % BREAKDOWN_COLOR_PALETTE.length]
			colorIndex++
			topSeriesRaw.push({
				name,
				data: normalized,
				...(color === undefined ? {} : { color })
			})
		}

		if (hasScopedFilter) {
			return {
				series: topSeriesRaw,
				metadata: {
					protocol: 'All Protocols',
					metric: 'TVL',
					chains: topSeriesRaw.map((series) => series.name),
					totalChains: ranked.length,
					topN: topSeriesRaw.length,
					othersCount: Math.max(0, ranked.length - topSeriesRaw.length)
				}
			}
		}

		if (!globalJson) throw new Error('Missing the unfiltered global TVL series')
		const adjustedGlobalTvl = processAdjustedTvl(globalJson)
		const totalSeries = filterOutToday(
			normalizeDailyPairs(
				adjustedGlobalTvl.map(([ts, v]) => [Number(ts), Number(v)]),
				'last'
			)
		)
		const { alignedTopSeries, othersData } = buildAlignedTopAndOthers(topSeriesRaw, totalSeries)

		const includedTopCount = topSeriesRaw.length
		const includedTopNames = topSeriesRaw.map((series) => series.name)
		const othersCount = Math.max(0, ranked.length - includedTopCount)
		const hasOthers = othersCount > 0 && othersData.some(([, v]) => v > 0)
		const finalSeries = [...alignedTopSeries]
		if (hasOthers) finalSeries.push({ name: `Others (${othersCount} chains)`, data: othersData, color: '#999999' })

		return {
			series: finalSeries,
			metadata: {
				protocol: 'All Protocols',
				metric: 'TVL',
				chains: includedTopNames,
				totalChains: ranked.length,
				topN: includedTopCount,
				othersCount
			}
		}
	} catch (e) {
		console.log('Error building all-protocols TVL by chain:', e)
		throw e
	}
}

type ProtocolChainBreakdownParams = {
	protocol?: string
	metric: string
	chains: string[]
	topN: number
	chainFilterMode: 'include' | 'exclude'
	chainCategoryFilterMode: 'include' | 'exclude'
	chainCategories: string[]
}

export const getProtocolChainBreakdownData = async ({
	protocol,
	metric,
	chains,
	topN,
	chainFilterMode,
	chainCategoryFilterMode,
	chainCategories
}: ProtocolChainBreakdownParams): Promise<ProtocolChainData> => {
	const isProtocolAll = !protocol || protocol.toLowerCase() === 'all'

	if (metric !== 'tvl') {
		throw new Error('Unsupported ProtocolOverview by-chain metric: ' + metric)
	}

	if (isProtocolAll) {
		return getAllProtocolsTopChainsTvlData(topN, chains, chainFilterMode, chainCategoryFilterMode, chainCategories)
	}

	return getTvlProtocolChainData(protocol, chains, topN, chainFilterMode, chainCategoryFilterMode, chainCategories)
}
