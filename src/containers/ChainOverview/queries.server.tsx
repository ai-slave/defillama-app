import { fetchLlamaConfig } from '~/api'
import { fetchCoinGeckoCoinById } from '~/api/coingecko'
import { tvlOptions } from '~/components/Filters/options'
import { TRADFI_API } from '~/constants'
import { fetchAdapterChainMetrics, fetchAdapterProtocolMetrics, fetchCexVolume } from '~/containers/AdapterMetrics/api'
import { REV_PROTOCOLS } from '~/containers/AdapterMetrics/constants'
import { getSponsoredResearchReports } from '~/containers/Articles/api'
import { fetchChainsAssetTotals } from '~/containers/BridgedTVL/api'
import { getBridgeChainNetInflows } from '~/containers/Bridges/queries.server'
import { fetchChainChart } from '~/containers/Chains/api'
import type { ChainChartResponse } from '~/containers/Chains/api.types'
import { getETFData } from '~/containers/ETF/queries'
import { getChainIncentivesFromAggregatedEmissions } from '~/containers/Incentives/queries'
import { paginateProtocolRankingRows } from '~/containers/ProtocolRankings/pagination.server'
import { loadPreparedProtocolRankingRows } from '~/containers/ProtocolRankings/server/api'
import { getProtocolRankingsSnapshot } from '~/containers/ProtocolRankings/server/tableData.server'
import { DEFAULT_PROTOCOL_RANKING_QUERY, PROTOCOL_RANKINGS_LIMITS } from '~/containers/ProtocolRankings/tableQuery'
import { fetchRaises } from '~/containers/Raises/api'
import { fetchRWAStats } from '~/containers/RWA/api'
import type { IRWAStatsResponse } from '~/containers/RWA/api.types'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import { fetchStablecoinAssetsApi } from '~/containers/Stablecoins/api'
import { getStablecoinChainMcapSummary } from '~/containers/Stablecoins/queries.server'
import { fetchTreasuries } from '~/containers/Treasuries/api'
import { feeRevenueMetrics, shouldFetchChainOverviewFeeRevenueMetric } from '~/metrics/feesRevenue'
import { getPercentChange, lastDayOfWeek, slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { tokenIconUrl } from '~/utils/icons'
import type {
	ICategoriesAndTags,
	IChainMetadata,
	IProtocolMetadata,
	ProtocolLlamaswapMetadata
} from '~/utils/metadata/types'
import { roundNumber } from '~/utils/numberFormat'
import { recordOptionalPageDataFailure } from '~/utils/optionalPageData'
import type { RoutePhaseTimer } from '~/utils/perf'
import { findTokenPageRoute, type TokenDirectory } from '~/utils/tokenDirectory'
import { applyTvlOverlapBaseAdjustment } from '~/utils/tvl'
import { getPrevTvlFromChart } from '~/utils/tvlChart'
import type { ChainChartLabels } from './constants'
import { fetchHomepageUnlocksSummary } from './homepageUnlocks.server'
import type { IChainOverviewData } from './types'
import { formatChainAssets, getChainWarningBanners } from './utils'

function emptyLiteChart(): ChainChartResponse {
	return {
		tvl: [],
		staking: [],
		borrowed: [],
		pool2: [],
		vesting: [],
		offers: [],
		doublecounted: [],
		liquidstaking: [],
		dcAndLsOverlap: []
	}
}

function computeTvlChartSummary(chart: Array<[number, number]>): {
	totalValueUSD: number | null
	tvlPrevDay: number | null
	valueChange24hUSD: number | null
	change24h: number | null
} {
	const lastValue = getPrevTvlFromChart(chart, 0)
	const tvlPrevDay = getPrevTvlFromChart(chart, 1)
	const valueChange24hUSD = lastValue != null && tvlPrevDay != null ? lastValue - tvlPrevDay : null
	const change24h = lastValue != null && tvlPrevDay != null ? getPercentChange(lastValue, tvlPrevDay) : null

	return { totalValueUSD: lastValue, tvlPrevDay, valueChange24hUSD, change24h }
}

function formatExtraTvlChart(chart: ChainChartResponse['tvl']): Record<string, number> {
	const formatted: Record<string, number> = {}
	for (const [date, totalLiquidityUSD] of chart) {
		formatted[Number(date) * 1e3] = Math.trunc(totalLiquidityUSD)
	}
	return formatted
}

export function shouldFetchChainDexs({
	chain,
	currentChainMetadata,
	categoriesAndTagsMetadata
}: {
	chain: string
	currentChainMetadata: IChainMetadata
	categoriesAndTagsMetadata?: ICategoriesAndTags
}): boolean {
	if (!currentChainMetadata.dexs) return false
	if (chain === 'All' || currentChainMetadata.id === 'all') return true

	return categoriesAndTagsMetadata?.configs?.Dexs?.chains?.includes(currentChainMetadata.id) ?? false
}

export function shouldFetchChainPerps({
	chain,
	currentChainMetadata,
	categoriesAndTagsMetadata
}: {
	chain: string
	currentChainMetadata: IChainMetadata
	categoriesAndTagsMetadata?: ICategoriesAndTags
}): boolean {
	if (!currentChainMetadata.perps) return false
	if (chain === 'All' || currentChainMetadata.id === 'all') return true

	return categoriesAndTagsMetadata?.configs?.Derivatives?.chains?.includes(currentChainMetadata.id) ?? false
}

export function getRwaActiveMcapForChain(rwaStats: IRWAStatsResponse | null, chainName: string): number | null {
	const byChain = rwaStats?.byChain
	const exactMatch = byChain?.[chainName]
	if (exactMatch) return exactMatch.base.activeMcap
	if (!byChain) return null

	const chainSlug = rwaSlug(chainName)
	for (const chain in byChain) {
		const chainStats = byChain[chain]
		if (chainStats === undefined) continue
		if (rwaSlug(chain) !== chainSlug) continue
		return chainStats.base.activeMcap
	}

	return null
}

export function sumAdapterProtocol24h(rows: readonly { total24h?: number | null }[] | null): number | null {
	if (rows === null) return null
	let total = 0
	for (const row of rows) {
		total += row.total24h ?? 0
	}
	return total
}

export function getChainRev24h({
	chainFees24h,
	feeProtocols,
	revProtocolSlugs
}: {
	chainFees24h: number | null
	feeProtocols: readonly { slug: string; total24h?: number | null }[] | null
	revProtocolSlugs: Iterable<string>
}): number | null {
	if (chainFees24h == null) return null
	let total = chainFees24h
	for (const revProtocolSlug of revProtocolSlugs) {
		if (feeProtocols === null) return null
		total += feeProtocols.find((row) => row.slug === revProtocolSlug)?.total24h ?? 0
	}
	return total
}

export function getDexDominance(cexVolume: number | null, dexVolume: number | null): number | null {
	if (cexVolume == null || dexVolume == null) return null
	const total = cexVolume + dexVolume
	return total > 0 ? roundNumber((dexVolume / total) * 100, 2) : null
}

export function hasRwaActiveMcapChain(rwaChains: string[] | null | undefined, chainName: string): boolean {
	const chainSlug = rwaSlug(chainName)
	for (const chain of rwaChains ?? []) {
		if (rwaSlug(chain) === chainSlug) return true
	}
	return false
}

export function shouldShowChainOverviewBridgedTvlChart({
	chain,
	currentChainMetadata
}: {
	chain: string
	currentChainMetadata: Pick<IChainMetadata, 'chainAssets'>
}): boolean {
	return chain !== 'All' && !!currentChainMetadata.chainAssets
}

export function fetchChainActivityProtocolMetricTotal({
	chain,
	adapterType,
	dataType
}: {
	chain: string
	adapterType: 'active-users' | 'new-users'
	dataType?: 'dailyTransactionsCount'
}): Promise<number | null> {
	return fetchAdapterProtocolMetrics({
		protocol: chain,
		adapterType,
		...(dataType !== undefined ? { dataType } : {})
	}).then((data) => data?.total24h ?? null)
}

export function getChainOverviewTvlOptions(chartData: ChainChartResponse | null | undefined) {
	return tvlOptions.filter((option) => chartData?.[option.key]?.length)
}

export async function getChainOverviewData({
	chain,
	chainMetadata,
	protocolMetadata,
	categoriesAndTagsMetadata,
	protocolLlamaswapDataset = null,
	rwaChainsForActiveMcap = null,
	tokenDirectory = null,
	phaseTimer,
	researchSponsorEntitySlug
}: {
	chain: string
	chainMetadata: Record<string, IChainMetadata>
	protocolMetadata: Record<string, IProtocolMetadata>
	categoriesAndTagsMetadata: ICategoriesAndTags
	protocolLlamaswapDataset?: ProtocolLlamaswapMetadata | null
	rwaChainsForActiveMcap?: string[] | null
	tokenDirectory?: TokenDirectory | null
	phaseTimer?: RoutePhaseTimer
	researchSponsorEntitySlug?: string
}): Promise<IChainOverviewData | null> {
	const resolvedChainMetadata =
		chain === 'All'
			? { name: 'All', stablecoins: true, fees: true, dexs: true, perps: true, id: 'all' }
			: chainMetadata[slug(chain)]

	if (!resolvedChainMetadata) return null
	const currentChainMetadata: IChainMetadata = resolvedChainMetadata

	const shouldFetchDexs = shouldFetchChainDexs({ chain, currentChainMetadata, categoriesAndTagsMetadata })
	const shouldFetchPerps = shouldFetchChainPerps({ chain, currentChainMetadata, categoriesAndTagsMetadata })
	const shouldFetchRwaActiveMcap =
		chain !== 'All' && hasRwaActiveMcapChain(rwaChainsForActiveMcap, currentChainMetadata.name)
	async function timePhase<T>(
		label: string,
		run: () => T | Promise<T>,
		options?: { fallback: Awaited<T> }
	): Promise<Awaited<T>> {
		try {
			if (phaseTimer) return await phaseTimer.time(label, run)
			return await Promise.resolve().then(run)
		} catch (error) {
			if (!options) throw error
			recordOptionalPageDataFailure(`chain:${currentChainMetadata.name}:${label}`, error)
			return options.fallback
		}
	}

	const chainFeesMetric = feeRevenueMetrics.chainFees
	const chainRevenueMetric = feeRevenueMetrics.chainRevenue
	const appFeesMetric = feeRevenueMetrics.appFees
	const appRevenueMetric = feeRevenueMetrics.appRevenue
	const shouldFetchChainFeesMetric = shouldFetchChainOverviewFeeRevenueMetric({
		metric: chainFeesMetric,
		metadata: currentChainMetadata,
		chain
	})
	const shouldFetchChainRevenueMetric = shouldFetchChainOverviewFeeRevenueMetric({
		metric: chainRevenueMetric,
		metadata: currentChainMetadata,
		chain
	})
	const shouldFetchAppFeesMetric = shouldFetchChainOverviewFeeRevenueMetric({
		metric: appFeesMetric,
		metadata: currentChainMetadata,
		chain
	})
	const shouldFetchAppRevenueMetric = shouldFetchChainOverviewFeeRevenueMetric({
		metric: appRevenueMetric,
		metadata: currentChainMetadata,
		chain
	})
	const sponsoredResearchReportsPromise = timePhase(
		'research_sponsors',
		() =>
			chain === 'All'
				? Promise.resolve([])
				: getSponsoredResearchReports('chain', researchSponsorEntitySlug ?? slug(currentChainMetadata.name), {
						limit: 3
					}).then((result) => result.reports),
		{ fallback: [] }
	)
	try {
		const [
			chartData,
			protocolRankingsSnapshot,
			stablecoins,
			inflowsData,
			activeUsers,
			transactions,
			newUsers,
			raisesData,
			treasuriesData,
			cgData,
			nftVolumesData,
			chainAssets,
			appRevenue,
			appFees,
			chainFees,
			chainRevenue,
			cexVolume,
			etfData,
			homepageUnlocks,
			chainIncentives,
			datInflows,
			stablecoinsData,
			chainConfig,
			rwaStats,
			sponsoredResearchReports
		] = await Promise.all([
			timePhase('chain_chart', () => fetchChainChart(chain === 'All' ? undefined : currentChainMetadata.name), {
				fallback: emptyLiteChart()
			}),
			timePhase('protocols_by_chain', () =>
				getProtocolRankingsSnapshot({
					chain,
					chainMetadata,
					protocolMetadata,
					categoriesAndTagsMetadata,
					protocolLlamaswapDataset
				})
			),
			timePhase(
				'stablecoins',
				() =>
					currentChainMetadata.stablecoins
						? getStablecoinChainMcapSummary(chain === 'All' ? null : currentChainMetadata.name)
						: Promise.resolve(null),
				{ fallback: null }
			),
			timePhase(
				'inflows',
				() =>
					!currentChainMetadata.inflows ? Promise.resolve(null) : getBridgeChainNetInflows(currentChainMetadata.name),
				{ fallback: null }
			),
			timePhase(
				'active_users',
				() =>
					!currentChainMetadata.chainActiveUsers
						? Promise.resolve(null)
						: fetchChainActivityProtocolMetricTotal({
								chain: currentChainMetadata.name,
								adapterType: 'active-users'
							}),
				{ fallback: null }
			),
			timePhase(
				'transactions',
				() =>
					!currentChainMetadata.txCount
						? Promise.resolve(null)
						: fetchChainActivityProtocolMetricTotal({
								chain: currentChainMetadata.name,
								adapterType: 'active-users',
								dataType: 'dailyTransactionsCount'
							}),
				{ fallback: null }
			),
			timePhase(
				'new_users',
				() =>
					!currentChainMetadata.chainNewUsers
						? Promise.resolve(null)
						: fetchChainActivityProtocolMetricTotal({
								chain: currentChainMetadata.name,
								adapterType: 'new-users'
							}),
				{ fallback: null }
			),
			timePhase('raises', () => fetchRaises(), { fallback: { raises: [] } }),
			timePhase('treasuries', () => (chain === 'All' ? Promise.resolve(null) : fetchTreasuries()), { fallback: null }),
			timePhase(
				'coingecko',
				() =>
					currentChainMetadata.gecko_id ? fetchCoinGeckoCoinById(currentChainMetadata.gecko_id) : Promise.resolve(null),
				{ fallback: null }
			),
			timePhase<Record<string, number> | null>(
				'nft_volumes',
				() =>
					chain && chain !== 'All'
						? fetchJson<Record<string, number>>(`https://defillama-datasets.llama.fi/temp/chainNfts`)
						: Promise.resolve(null),
				{ fallback: null }
			),
			timePhase(
				'chain_assets',
				() =>
					fetchChainsAssetTotals().then((assets) =>
						chain !== 'All' ? (assets[currentChainMetadata.name] ?? null) : null
					),
				{ fallback: null }
			),
			timePhase(appRevenueMetric.chainOverview.phase, () =>
				shouldFetchAppRevenueMetric
					? fetchAdapterChainMetrics({
							adapterType: appRevenueMetric.chainOverview.source.adapterType,
							chain: currentChainMetadata.name,
							dataType: appRevenueMetric.chainOverview.source.dataType
						})
					: Promise.resolve(null)
			),
			timePhase(appFeesMetric.chainOverview.phase, () =>
				shouldFetchAppFeesMetric
					? fetchAdapterChainMetrics({
							adapterType: appFeesMetric.chainOverview.source.adapterType,
							chain: currentChainMetadata.name,
							dataType: appFeesMetric.chainOverview.source.dataType
						})
					: Promise.resolve(null)
			),
			timePhase(chainFeesMetric.chainOverview.phase, () =>
				shouldFetchChainFeesMetric
					? fetchAdapterProtocolMetrics({
							adapterType: chainFeesMetric.chainOverview.source.adapterType,
							protocol: currentChainMetadata.name
						})
					: Promise.resolve(null)
			),
			timePhase(chainRevenueMetric.chainOverview.phase, () =>
				shouldFetchChainRevenueMetric
					? fetchAdapterProtocolMetrics({
							adapterType: chainRevenueMetric.chainOverview.source.adapterType,
							protocol: currentChainMetadata.name,
							dataType: chainRevenueMetric.chainOverview.source.dataType
						})
					: Promise.resolve(null)
			),
			timePhase('cex_volume', () => fetchCexVolume(), { fallback: null }),
			timePhase(
				'etf_data',
				() =>
					chain === 'All'
						? getETFData().then((data) => {
								const recentFlows: Array<[number, number]> = []
								const recentDates: string[] = []
								for (const date in data.flows) {
									if (recentDates.length === 14) recentDates.shift()
									recentDates.push(date)
								}
								for (const date of recentDates) {
									const values = data.flows[date]
									if (values === undefined) continue
									let total = 0
									for (const key in values) {
										if (key === 'date') continue
										const value = values[key]
										if (value !== undefined) total += value
									}
									recentFlows.push([+date * 1000, total])
								}
								return recentFlows
							})
						: Promise.resolve(null),
				{ fallback: null }
			),
			timePhase('homepage_unlocks', () => (chain === 'All' ? fetchHomepageUnlocksSummary() : Promise.resolve(null))),
			timePhase(
				'chain_incentives',
				() =>
					currentChainMetadata.incentives && chain !== 'All'
						? getChainIncentivesFromAggregatedEmissions(currentChainMetadata.name)
						: Promise.resolve(null),
				{ fallback: null }
			),
			timePhase('dat_inflows', () => (chain === 'All' ? getDATInflows() : Promise.resolve(null))),
			timePhase('stablecoin_assets', () => (chain !== 'All' ? fetchStablecoinAssetsApi() : Promise.resolve(null)), {
				fallback: null
			}),
			timePhase(
				'chain_config',
				() =>
					chain !== 'All'
						? fetchLlamaConfig().then((data) => {
								const config = data.chainCoingeckoIds[currentChainMetadata.name]
								return {
									stablecoins: config?.stablecoins ?? null,
									website: config?.url ?? null,
									warningBanners: config?.warningBanners ?? []
								}
							})
						: Promise.resolve(null),
				{ fallback: null }
			),
			timePhase('rwa_stats', () => (shouldFetchRwaActiveMcap ? fetchRWAStats() : Promise.resolve(null)), {
				fallback: null
			}),
			sponsoredResearchReportsPromise
		])
		const { protocols: allProtocols, snapshot: rankingsSnapshot, availableActivityMetrics } = protocolRankingsSnapshot
		const { chains, feeProtocols, dexs, perps } = protocolRankingsSnapshot.source
		// Same prepare -> paginate pipeline as the public API, so ISR regeneration
		// also warms the prepared-rows cache for the default query.
		const rankingSnapshotData = { snapshot: rankingsSnapshot, protocols: allProtocols, availableActivityMetrics }
		const initialProtocolPage = paginateProtocolRankingRows({
			snapshot: rankingSnapshotData,
			query: DEFAULT_PROTOCOL_RANKING_QUERY,
			rows: await loadPreparedProtocolRankingRows(chain, rankingSnapshotData, DEFAULT_PROTOCOL_RANKING_QUERY),
			limit: PROTOCOL_RANKINGS_LIMITS.initial
		})
		const stopOverviewTransform = phaseTimer?.start('overview_transform')

		const {
			tvl = [],
			staking = [],
			borrowed = [],
			pool2 = [],
			vesting = [],
			offers = [],
			doublecounted = [],
			liquidstaking = [],
			dcAndLsOverlap = []
		} = chartData

		const availableTvlOptions = getChainOverviewTvlOptions(chartData)
		const extraTvlCharts: IChainOverviewData['extraTvlCharts'] = {
			staking: formatExtraTvlChart(staking),
			borrowed: formatExtraTvlChart(borrowed),
			pool2: formatExtraTvlChart(pool2),
			vesting: formatExtraTvlChart(vesting),
			offers: formatExtraTvlChart(offers),
			doublecounted: formatExtraTvlChart(doublecounted),
			liquidstaking: formatExtraTvlChart(liquidstaking),
			dcAndLsOverlap: formatExtraTvlChart(dcAndLsOverlap)
		}

		// by default we should not include liquidstaking and doublecounted in the tvl chart, but include overlapping tvl so you don't subtract twice
		const tvlChart: Array<[number, number]> = []
		for (const [date, totalLiquidityUSD] of tvl) {
			const timestamp = Number(date) * 1e3
			const sum = applyTvlOverlapBaseAdjustment(Math.trunc(totalLiquidityUSD), {
				liquidstaking: extraTvlCharts.liquidstaking[timestamp],
				doublecounted: extraTvlCharts.doublecounted[timestamp],
				dcAndLsOverlap: extraTvlCharts.dcAndLsOverlap[timestamp]
			})
			tvlChart.push([timestamp, sum])
		}

		// Pre-compute TVL summary to avoid client-side iteration
		const tvlChartSummary = computeTvlChartSummary(tvlChart)

		const chainRaises =
			raisesData?.raises?.filter((r) => r.defillamaId === `chain#${currentChainMetadata.name.toLowerCase()}`) ?? null

		const treasury =
			treasuriesData?.find(
				(t) =>
					t?.name?.toLowerCase().startsWith(`${currentChainMetadata.name.toLowerCase()}`) &&
					['Services', 'Chain', 'Foundation'].includes(t?.category)
			) ?? null

		let topProtocolsByFeesChart: Array<[string, number, string]> | null = null
		if (feeProtocols?.length) {
			const protocolsByFees: Array<{ protocol: (typeof allProtocols)[number]; total24h: number }> = []
			for (const protocol of allProtocols) {
				protocolsByFees.push({ protocol, total24h: protocol.fees?.total24h ?? 0 })
			}
			protocolsByFees.sort((a, b) => b.total24h - a.total24h)
			topProtocolsByFeesChart = []
			for (const { protocol, total24h } of protocolsByFees) {
				if (!total24h || topProtocolsByFeesChart.length === 14) continue
				topProtocolsByFeesChart.push([protocol.name, total24h, tokenIconUrl(protocol.name)])
			}
		}

		const feesGenerated24h = sumAdapterProtocol24h(feeProtocols)

		const chainREV = getChainRev24h({
			chainFees24h: chainFees?.total24h ?? null,
			feeProtocols,
			revProtocolSlugs: REV_PROTOCOLS[slug(currentChainMetadata.name)] ?? []
		})

		const charts: ChainChartLabels[] = []

		if (chartData) {
			charts.push('TVL')
		}

		if (stablecoins?.mcap != null) {
			charts.push('Stablecoins Mcap')
		}
		if (chainFees?.total24h != null) {
			charts.push(chainFeesMetric.label)
		}
		if (chainRevenue?.total24h != null) {
			charts.push(chainRevenueMetric.label)
		}
		if (shouldFetchDexs && dexs?.total24h != null) {
			charts.push('DEXs Volume')
		}
		if (shouldFetchPerps && perps?.total24h != null) {
			charts.push('Perps Volume')
		}
		if (chainIncentives?.emissions24h != null) {
			charts.push('Token Incentives')
		}
		if (appRevenue?.total24h != null) {
			charts.push(appRevenueMetric.label)
		}
		if (appFees?.total24h != null) {
			charts.push(appFeesMetric.label)
		}

		if (shouldShowChainOverviewBridgedTvlChart({ chain, currentChainMetadata })) {
			charts.push('Bridged TVL')
		}

		if (currentChainMetadata.chainActiveUsers) {
			charts.push('Active Addresses')
		}
		if (currentChainMetadata.chainNewUsers) {
			charts.push('New Addresses')
		}
		if (currentChainMetadata.txCount) {
			charts.push('Transactions')
		}
		if (chain === 'All') {
			charts.push('Raises')
		}
		if (inflowsData?.netInflows != null) {
			charts.push('Net Inflows')
		}
		if (chain !== 'All' && currentChainMetadata.gecko_id != null) {
			charts.push('Token Price')
		}
		if (chain !== 'All' && currentChainMetadata.gecko_id != null) {
			charts.push('Token Mcap')
		}
		if (chain !== 'All' && currentChainMetadata.gecko_id != null) {
			charts.push('Token Volume')
		}

		if (chain === 'All' && tvlChart.length === 0) {
			throw new Error('Missing chart data')
		}

		const rwaActiveMcap = shouldFetchRwaActiveMcap
			? getRwaActiveMcapForChain(rwaStats, currentChainMetadata.name)
			: null
		const descriptionMetrics = rwaActiveMcap != null ? [...charts, 'RWA Active Mcap'] : charts
		const isDataAvailable = charts.length > 0 || allProtocols.length > 0 || rwaActiveMcap != null
		const chainGeckoId = currentChainMetadata.gecko_id
		const nftVolume = chain !== 'All' ? nftVolumesData?.[currentChainMetadata.name.toLowerCase()] : undefined

		const result: IChainOverviewData = {
			chain,
			metadata: currentChainMetadata,
			protocols: initialProtocolPage.rows,
			protocolRankings: {
				nextCursor: initialProtocolPage.nextCursor,
				snapshot: initialProtocolPage.snapshot,
				total: initialProtocolPage.total,
				hasMore: initialProtocolPage.hasMore,
				availableActivityMetrics: initialProtocolPage.availableActivityMetrics
			},
			tvlChart,
			tvlChartSummary,
			extraTvlCharts,
			chainTokenInfo:
				chain !== 'All'
					? {
							gecko_id: chainGeckoId ?? null,
							token_symbol: currentChainMetadata.tokenSymbol ?? null,
							tokenPageRoute: findTokenPageRoute(tokenDirectory, {
								defillamaId: currentChainMetadata.id,
								...(chainGeckoId !== undefined ? { geckoId: chainGeckoId } : {})
							}),
							current_price: cgData?.market_data?.current_price?.usd ?? null,
							market_cap: cgData?.market_data?.market_cap?.usd ?? null,
							fully_diluted_valuation: cgData?.market_data?.fully_diluted_valuation?.usd ?? null,
							llamaswapChains: chainGeckoId ? (protocolLlamaswapDataset?.[chainGeckoId] ?? null) : null
						}
					: null,
			stablecoins,
			rwaActiveMcap,
			chainFees: {
				total24h: chainFees?.total24h ?? null,
				feesGenerated24h: feesGenerated24h,
				topProtocolsChart:
					topProtocolsByFeesChart && topProtocolsByFeesChart.length > 0 ? topProtocolsByFeesChart : null,
				totalREV24h: chainREV
			},
			chainRevenue: { total24h: chainRevenue?.total24h ?? null },
			appRevenue: { total24h: appRevenue?.total24h ?? null },
			appFees: { total24h: appFees?.total24h ?? null },
			dexs: {
				total24h: dexs?.total24h ?? null,
				total7d: dexs?.total7d ?? null,
				change_7dover7d: dexs?.change_7dover7d ?? null,
				dexsDominance: getDexDominance(cexVolume, dexs?.total24h ?? null),
				chart: dexs ? dexs.recentChart.map((point): [number, number] => [point[0] * 1000, point[1]]) : null
			},
			perps: {
				total24h: perps?.total24h ?? null,
				total7d: perps?.total7d ?? null,
				change_7dover7d: perps?.change_7dover7d ?? null
			},
			users: { activeUsers, newUsers, transactions },
			inflows: inflowsData,
			treasury: treasury ? { tvl: treasury.tvl ?? null, tokenBreakdowns: treasury.tokenBreakdowns ?? null } : null,
			chainRaises: chainRaises ?? null,
			chainAssets: formatChainAssets(chainAssets),
			devMetrics: null,
			nfts: nftVolume !== undefined ? { total24h: nftVolume } : null,
			etfs: etfData,
			allChains: [{ label: 'All', to: '/' }].concat(chains.map((c) => ({ label: c, to: `/chain/${slug(c)}` }))),
			unlocks: homepageUnlocks,
			chainIncentives: chainIncentives ?? {
				emissions24h: null,
				emissions7d: null,
				emissions30d: null
			},
			tvlOptions: availableTvlOptions,
			charts,
			description:
				currentChainMetadata.name === 'All'
					? 'Comprehensive overview of all metrics tracked on all chains, including TVL, Stablecoins Mcap, DEXs Volume, Perps Volume, protocols on all chains. DefiLlama is committed to providing accurate data without ads or sponsored content, as well as transparency.'
					: descriptionMetrics.length > 0 && allProtocols.length > 0
						? `Comprehensive overview of all metrics tracked on ${currentChainMetadata.name}, including ${descriptionMetrics.join(', ')}, and protocols on ${currentChainMetadata.name}.`
						: descriptionMetrics.length > 0
							? `Comprehensive overview of all metrics tracked on ${currentChainMetadata.name}, including ${descriptionMetrics.join(', ')}.`
							: allProtocols.length > 0
								? `Comprehensive overview of all metrics tracked on ${currentChainMetadata.name}, including protocols on ${currentChainMetadata.name}.`
								: `Comprehensive overview of all metrics tracked on ${currentChainMetadata.name}`,
			isDataAvailable,
			datInflows: datInflows ?? null,
			chainStablecoins:
				chainConfig?.stablecoins?.map((coin) => {
					const coinData = stablecoinsData?.peggedAssets?.find((c) => c.gecko_id === coin)
					return { name: coinData?.name ?? coin, url: `/stablecoin/${coin}`, symbol: coinData?.symbol ?? null }
				}) ?? null,
			website: chainConfig?.website ?? null,
			warningBanners: getChainWarningBanners(chainConfig?.warningBanners),
			sponsoredResearchReports,
			researchSponsorEntitySlug: researchSponsorEntitySlug ?? slug(currentChainMetadata.name)
		}
		stopOverviewTransform?.()
		return result
	} catch (error) {
		const msg = `Error fetching chainOverview:${chain} ${error instanceof Error ? error.message : 'Failed to fetch'}`
		const errorWithContext = new Error(msg, { cause: error })
		if (error instanceof Error && error.stack) {
			errorWithContext.stack = `${errorWithContext.stack}\nCaused by: ${error.stack}`
		}
		throw errorWithContext
	}
}

interface IDATInflow {
	flows: {
		[asset: string]: Array<[number, number, number, number, number, number]> // [timestamp, net, inflow, outflow, purchasePrice, usdValueOfPurchase]
	}
}

function getUTCTimestamp(timestamp: number) {
	// Round to nearest day boundary (midnight UTC)
	const msPerDay = 86400000 // 24 * 60 * 60 * 1000
	return Math.round(timestamp / msPerDay) * msPerDay
}

const getDATInflows = async () => {
	try {
		const data = await fetchJson<IDATInflow>(`${TRADFI_API}/institutions`)
		const weeklyInflows: Record<number, number> = {}

		let total30d = 0
		// Only keep inflows for the last 14 weeks (to match the chart window)
		const fourteenWeeksAgo = Date.now() - 14 * 7 * 24 * 60 * 60 * 1000

		for (const flowType in data.flows) {
			const flows = data.flows[flowType]
			if (flows === undefined) continue
			for (const [date, _net, _inflow, _outflow, purchasePrice, usdValueOfPurchase] of flows) {
				const utcTimestamp = getUTCTimestamp(date)
				if (utcTimestamp < fourteenWeeksAgo) continue
				const finalDate = lastDayOfWeek(utcTimestamp / 1000) * 1000
				const usdValue = purchasePrice || usdValueOfPurchase || 0
				if (utcTimestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000) {
					total30d += usdValue
				}
				weeklyInflows[finalDate] = (weeklyInflows[finalDate] || 0) + usdValue
			}
		}

		// Always end with the last day of the current week
		const mostRecentTimestamp = lastDayOfWeek(Date.now() / 1000) * 1000
		const oneWeekInMs = 7 * 24 * 60 * 60 * 1000
		const completeChart: Array<[number, number]> = []

		// Generate all 14 weekly timestamps ending with current week
		for (let i = 13; i >= 0; i--) {
			const timestamp = mostRecentTimestamp - i * oneWeekInMs
			const value = weeklyInflows[timestamp] ?? 0
			completeChart.push([timestamp, value])
		}

		return {
			chart: completeChart,
			total30d
		}
	} catch (error) {
		console.log('Error fetching DAT inflows:', error)
		return null
	}
}
