import { fetchBlockExplorers } from '~/api'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import type { IRWAList } from '~/utils/metadata/types'
import {
	fetchRWAChainBreakdownChartData,
	fetchRWAChartDataByAsset,
	fetchRWAChartMetricDataByAsset,
	fetchRWAAssetDataById,
	fetchRWAAssetChartData,
	fetchRWACurrentListing,
	normalizeRWAChartMetricRows
} from './api'
import type {
	IFetchedRWAProject,
	IRWAAssetsOverview,
	IRWAAssetData,
	IRWAChartDataByAsset,
	IRWAChartMetricRows,
	IRWAInitialChartDataset,
	RWAChartMetricKey,
	RWAOverviewDisplayRow,
	RWASpotOverviewAsset,
	RWAAssetChartTarget,
	RWADefiTvlProtocolBreakdown
} from './api.types'
import { UNKNOWN_RWA_ASSET_GROUP, appendUnknownRwaAssetGroup, normalizeRwaAssetGroup } from './assetGroup'
import { buildRwaOverviewCards, type RwaOverviewCards } from './cards/cardData'
import { foldRwaChainSeries, rankRwaChains } from './chainFold'
import { aggregateRwaMetricData, applyDefaultAssetFilters, buildRwaCanonicalMetricDataset } from './chartAggregation'
import { getRwaSpotChartSource } from './chartBreakdown'
import type { RWAPositionalChartDataset } from './chartDataset'
import { foldRwaTopSeries } from './chartFold'
import { getDefaultChartMetric } from './chartState'
import {
	filterCategoriesForStandardRwaOverview,
	getDefaultRWAOverviewInclusion,
	inferPlatformRWAOverviewInclusion,
	isCategoryIncludedInStandardRwaOverview,
	type RWAOverviewMode
} from './constants'
import { definitions } from './definitions'
import { getRwaRowFilterValues, type RWASelectFilterKey } from './filterState'
import { aggregateRwaMetrics, hasMetricBreakdown } from './overviewAssembly'
import { fetchRWAPerpsCurrent, fetchRWAPerpsOverviewBreakdownChartData } from './Perps/api'
import type { IRWAPerpsMarket } from './Perps/api.types'
import { toRWAPerpsBreakdownChartDataset } from './Perps/breakdownDataset'
import { buildRWAPerpsContractOverlayRows, getRealRwaPlatforms } from './perpsOverlay'
import type { RWAPlatformsIndex } from './PlatformPage/api.types'
import { getRWAPlatformRoutes } from './platformRoutes'
import { rwaSlug } from './rwaSlug'
import { buildRwaPriorIndex } from './series/priorValues'
import { getRwaDefaultGroupBy } from './table/groupBy'
import { areWrappersIncludedByDefault } from './wrappers'
import { emptyRWAYieldResult, getRWAYieldPools } from './yieldPools.server'

type RWAAssetsOverviewParams = {
	chain?: string
	category?: string
	platform?: string
	assetGroup?: string
	rwaList: IRWAList
	/** For the platform logos on group rows. */
	rwaPlatformsIndex?: RWAPlatformsIndex
}

/** Transpose the raw chain → protocol → tvl map into per-protocol rows with their chain splits, sorted desc. */
export function buildRwaDefiTvlProtocolChainBreakdown(
	breakdown: Record<string, Record<string, number>>
): Array<RWADefiTvlProtocolBreakdown> | null {
	const chainsByProtocol = new Map<string, Map<string, number>>()
	for (const [chain, protocols] of Object.entries(breakdown)) {
		for (const [protocol, value] of Object.entries(protocols)) {
			let chains = chainsByProtocol.get(protocol)
			if (!chains) {
				chains = new Map()
				chainsByProtocol.set(protocol, chains)
			}
			chains.set(chain, (chains.get(chain) ?? 0) + value)
		}
	}
	const rows: Array<RWADefiTvlProtocolBreakdown> = []
	for (const [protocol, chains] of chainsByProtocol) {
		let total = 0
		const byChain = [...chains.entries()].sort((a, b) => b[1] - a[1])
		for (const [, value] of byChain) total += value
		rows.push({ protocol, total, byChain })
	}
	rows.sort((a, b) => b.total - a.total)
	return rows.length > 0 ? rows : null
}

function getSortedBreakdownEntries(breakdown: Record<string, number>, selectedChain?: string): Array<[string, number]> {
	const entries: Array<[string, number]> = []
	for (const [key, value] of Object.entries(breakdown)) {
		if (selectedChain && rwaSlug(key) !== selectedChain) continue
		entries.push([key, value])
	}
	entries.sort((a, b) => b[1] - a[1])
	return entries
}

type RWAFilterOptionKey = Exclude<RWASelectFilterKey, 'assetNames'>
type RWAFilterOptionWeights = Record<RWAFilterOptionKey, Map<string, number>>

function addRwaFilterOptions(options: RWAFilterOptionWeights, row: RWAOverviewDisplayRow, weight: number) {
	let key: RWAFilterOptionKey
	for (key in options) {
		// Types is a spot filter; the view switch owns the perps rows.
		if (key === 'types' && row.kind === 'perps') continue
		for (const value of getRwaRowFilterValues(row, key)) {
			options[key].set(value, (options[key].get(value) ?? 0) + weight)
		}
	}
}

function rankRwaFilterOptions(weights: Map<string, number>): Array<string> {
	return Array.from(weights.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([key]) => key)
}

/**
 * The chain lines for the page's default state, folded at build time: the ten largest chains' per-asset
 * histories over the default asset set, on the axis of the page total. A chain whose history fails to load
 * lands in Others. Runs on the server only; each history is a few MB.
 */
async function buildInitialChainChartDataset({
	assets,
	chartRows,
	metric
}: {
	assets: IRWAAssetsOverview['assets']
	chartRows: IRWAChartMetricRows
	metric: RWAChartMetricKey
}): Promise<RWAPositionalChartDataset> {
	const total = buildRwaCanonicalMetricDataset(aggregateRwaMetricData(assets, chartRows, 'total'), metric, true)
	const chains = rankRwaChains(assets, metric)
	const histories = await Promise.all(
		chains.map(async (chain) => {
			const rows = await fetchRWAChartMetricDataByAsset({
				target: { kind: 'chain', slug: rwaSlug(chain) },
				metric,
				includeStablecoins: true,
				includeGovernance: true
			})
			return rows ? { chain, rows } : null
		})
	)
	return foldRwaChainSeries({
		chains: histories.filter((history) => history != null),
		assets,
		total
	})
}

/**
 * The front page cards, folded at build time: the chain split for Change by Chain and the perps venue split,
 * with and without CEX venues, for the open interest line. A split that fails leaves its card empty.
 */
async function buildOverviewCards(assets: IRWAAssetsOverview['assets']): Promise<RwaOverviewCards> {
	const [chainRows, withCex, dexOnly] = await Promise.all([
		fetchRWAChainBreakdownChartData({ key: 'activeMcap' }),
		fetchRWAPerpsOverviewBreakdownChartData({
			breakdown: 'venue',
			key: 'openInterest',
			target: { kind: 'all' },
			includeCex: true
		}),
		fetchRWAPerpsOverviewBreakdownChartData({
			breakdown: 'venue',
			key: 'openInterest',
			target: { kind: 'all' },
			includeCex: false
		})
	])
	return buildRwaOverviewCards({
		assets,
		chainRows: chainRows ?? [],
		openInterestRows: {
			withCex: toRWAPerpsBreakdownChartDataset(withCex).source,
			dexOnly: toRWAPerpsBreakdownChartDataset(dexOnly).source
		}
	})
}

export async function getRWAAssetsOverview(params: RWAAssetsOverviewParams): Promise<IRWAAssetsOverview | null> {
	try {
		const selectedChain = params.chain ? rwaSlug(params.chain) : undefined
		const selectedCategory = params.category ? rwaSlug(params.category) : undefined
		const selectedPlatform = params.platform ? rwaSlug(params.platform) : undefined
		const selectedAssetGroup = params.assetGroup ? rwaSlug(params.assetGroup) : undefined

		const selectedCount =
			Number(!!selectedChain) + Number(!!selectedCategory) + Number(!!selectedPlatform) + Number(!!selectedAssetGroup)
		if (selectedCount > 1) return null

		const target: RWAAssetChartTarget = selectedChain
			? { kind: 'chain', slug: selectedChain }
			: selectedCategory
				? { kind: 'category', slug: selectedCategory }
				: selectedPlatform
					? { kind: 'platform', slug: selectedPlatform }
					: selectedAssetGroup
						? { kind: 'assetGroup', slug: selectedAssetGroup }
						: { kind: 'all' }
		const mode: RWAOverviewMode = selectedAssetGroup
			? 'assetGroup'
			: selectedPlatform
				? 'platform'
				: selectedCategory
					? 'category'
					: 'chain'
		const routeDefaultInclusion = getDefaultRWAOverviewInclusion({
			mode,
			...(selectedChain ? { chainSlug: selectedChain } : {}),
			...(selectedCategory ? { categorySlug: selectedCategory } : {}),
			...(selectedAssetGroup ? { assetGroupSlug: selectedAssetGroup } : {})
		})
		const [data, perpsMarkets, prefetchedChartData]: [
			Array<IFetchedRWAProject>,
			Array<IRWAPerpsMarket>,
			IRWAChartDataByAsset | null | undefined
		] = await Promise.all([
			fetchRWACurrentListing(),
			fetchRWAPerpsCurrent(true).catch(() => []),
			// Both scope flags on, or toggling stablecoins or governance in blanks every change.
			selectedPlatform
				? Promise.resolve(undefined)
				: fetchRWAChartDataByAsset({
						target,
						includeStablecoins: true,
						includeGovernance: true
					}).catch((error) => {
						console.error('Failed to prefetch RWA chart data by asset:', error)
						return null
					})
		])

		const filteredData = data.filter(
			(item) => !(item.category ?? []).some((category) => !isCategoryIncludedInStandardRwaOverview(category))
		)
		const filteredPerpsMarkets = perpsMarkets.map((market) => ({
			...market,
			category: (market.category ?? []).filter((category) => isCategoryIncludedInStandardRwaOverview(category))
		}))
		const hasUnknownAssetGroup = filteredData.some(
			(item) => normalizeRwaAssetGroup(item.assetGroup) === UNKNOWN_RWA_ASSET_GROUP
		)
		// Only expose the synthetic Unknown filter/route when the current dataset actually contains
		// assets without an assetGroup value.
		const assetGroupValues = hasUnknownAssetGroup
			? appendUnknownRwaAssetGroup(params.rwaList.assetGroups)
			: params.rwaList.assetGroups

		// `selectedChain` comes from the URL and is slugified; resolve a display name (original casing/spaces)
		// while still filtering breakdown keys by slug for robustness.
		let actualChainName: string | null = null
		if (selectedChain) {
			for (const item of filteredData) {
				if (item.chain) {
					for (const c of item.chain) {
						if (rwaSlug(c) === selectedChain) {
							actualChainName = c
							break
						}
					}
				}
				if (actualChainName) break
			}
			if (!actualChainName) {
				return null
			}
		}

		// `selectedCategory` comes from the URL and is slugified; resolve a display name (original casing/spaces)
		let actualCategoryName: string | null = null
		if (selectedCategory) {
			for (const category of filterCategoriesForStandardRwaOverview(params.rwaList.categories)) {
				if (rwaSlug(category) === selectedCategory) {
					actualCategoryName = category
					break
				}
			}
			if (!actualCategoryName) {
				return null
			}
		}

		let actualPlatformName: string | null = null
		if (selectedPlatform) {
			const platformCandidates = new Set(params.rwaList.platforms)
			for (const market of filteredPerpsMarkets) {
				for (const platform of getRealRwaPlatforms(market.parentPlatform)) {
					platformCandidates.add(platform)
				}
			}

			for (const platform of platformCandidates) {
				if (rwaSlug(platform) === selectedPlatform) {
					actualPlatformName = platform
					break
				}
			}
			if (!actualPlatformName) {
				return null
			}
		}

		let actualAssetGroupName: string | null = null
		if (selectedAssetGroup) {
			// Resolve the display label from the same set of filterable values used by the overview,
			// including the synthetic Unknown bucket when missing assetGroup values exist in the API data.
			for (const assetGroup of assetGroupValues) {
				const normalizedAssetGroup = normalizeRwaAssetGroup(assetGroup)
				if (rwaSlug(normalizedAssetGroup) === selectedAssetGroup) {
					actualAssetGroupName = normalizedAssetGroup
					break
				}
			}
			if (!actualAssetGroupName) {
				return null
			}
		}

		const assets: IRWAAssetsOverview['assets'] = []
		const filterOptions: RWAFilterOptionWeights = {
			types: new Map(),
			assetGroups: new Map(),
			categories: new Map(),
			platforms: new Map(),
			assetClasses: new Map(),
			rwaClassifications: new Map(),
			accessModels: new Map(),
			issuers: new Map()
		}
		const assetNames = new Map<string, number>()
		const issuerSet = new Set<string>()
		const issuerSetStablecoinsOnly = new Set<string>()
		const issuerSetGovernanceOnly = new Set<string>()
		const issuerSetStablecoinsAndGovernance = new Set<string>()
		let totalOnChainMcap = 0
		let totalActiveMcap = 0
		let totalDeFiActiveTvl = 0
		let totalOnChainMcapStablecoinsOnly = 0
		let totalActiveMcapStablecoinsOnly = 0
		let totalDeFiActiveTvlStablecoinsOnly = 0
		let totalOnChainMcapGovernanceOnly = 0
		let totalActiveMcapGovernanceOnly = 0
		let totalDeFiActiveTvlGovernanceOnly = 0
		let totalOnChainMcapStablecoinsAndGovernance = 0
		let totalActiveMcapStablecoinsAndGovernance = 0
		let totalDeFiActiveTvlStablecoinsAndGovernance = 0
		let spotAssetCount = 0
		let hasTrackedActiveMcapAsset = false

		for (const item of filteredData) {
			const onChainMcapBreakdown = hasMetricBreakdown(item.onChainMcap) ? item.onChainMcap : null
			const activeMcapBreakdown = hasMetricBreakdown(item.activeMcap) ? item.activeMcap : null
			const isChainFiltered = !!selectedChain
			const aggregatedMetrics = aggregateRwaMetrics({
				onChainMcapBreakdown,
				activeMcapBreakdown,
				defiActiveTvlBreakdown: item.defiActiveTvl,
				...(selectedChain ? { selectedChain } : {})
			})
			const hasCategoryMatch = selectedCategory
				? (item.category ?? []).some((c) => c && rwaSlug(c) === selectedCategory)
				: true
			const hasPlatformMatch = selectedPlatform
				? getRealRwaPlatforms(item.parentPlatform).some((platform) => rwaSlug(platform) === selectedPlatform)
				: true
			const hasAssetGroupMatch = selectedAssetGroup
				? // Match missing/blank asset groups through the same normalized Unknown bucket used in the filters.
					rwaSlug(normalizeRwaAssetGroup(item.assetGroup)) === selectedAssetGroup
				: true

			// Check if asset has actual TVL on the selected chain (from TVL data, not just chain array)
			const hasChainInTvl = selectedChain
				? aggregatedMetrics.hasSelectedChainData.onChainMcap ||
					aggregatedMetrics.hasSelectedChainData.activeMcap ||
					aggregatedMetrics.hasSelectedChainData.defiActiveTvl
				: true

			// Use filtered values if chain is selected, otherwise use totals
			const effectiveOnChainMcap = selectedChain
				? aggregatedMetrics.filteredTotals.onChainMcap
				: aggregatedMetrics.totals.onChainMcap
			const effectiveActiveMcap = selectedChain
				? aggregatedMetrics.filteredTotals.activeMcap
				: aggregatedMetrics.totals.activeMcap
			const effectiveDeFiActiveTvl = selectedChain
				? aggregatedMetrics.filteredTotals.defiActiveTvl
				: aggregatedMetrics.totals.defiActiveTvl

			// Bridge/interop portion of defiActiveTvl (server-provided per chain), chain-filtered to match the row total.
			const effectiveBridgeTvlByChain: Record<string, number> = {}
			const effectiveBridgeTvlByProtocol: Record<string, number> = {}
			let effectiveBridgeTvl = 0
			if (item.bridgeTvl) {
				for (const chain in item.bridgeTvl) {
					if (!selectedChain || rwaSlug(chain) === selectedChain) {
						const bridgeValue = item.bridgeTvl[chain]
						if (bridgeValue === undefined || bridgeValue === 0) continue
						effectiveBridgeTvlByChain[chain] = bridgeValue
						effectiveBridgeTvl += bridgeValue
					}
				}
			}
			if (item.bridgeTvlBreakdown) {
				for (const chain in item.bridgeTvlBreakdown) {
					if (selectedChain && rwaSlug(chain) !== selectedChain) continue
					const protocols = item.bridgeTvlBreakdown[chain]
					if (!protocols) continue
					for (const protocol in protocols) {
						const bridgeValue = protocols[protocol]
						if (bridgeValue === undefined) continue
						effectiveBridgeTvlByProtocol[protocol] = (effectiveBridgeTvlByProtocol[protocol] ?? 0) + bridgeValue
					}
				}
			}

			const isTrueRWA = item.rwaClassification === 'True RWA'
			const asset: RWASpotOverviewAsset = {
				id: item.id,
				kind: 'spot',
				detailHref: `/rwa/asset/${encodeURIComponent(item.canonicalMarketId)}`,
				canonicalMarketId: item.canonicalMarketId,
				assetName: item.assetName ?? '',
				logo: item.logo ?? null,
				ticker: item.ticker,
				primaryChain: item.primaryChain ?? null,
				chain: item.chain ?? null,
				price: item.price,
				openInterest: null,
				volume24h: null,
				volume30d: null,
				assetGroup: item.assetGroup ?? null,
				parentPlatform: item.parentPlatform ?? null,
				category: item.category ?? null,
				assetClass: item.assetClass ?? null,
				accessModel: item.accessModel,
				type: item.type ?? null,
				rwaClassification: isTrueRWA ? 'RWA' : (item.rwaClassification ?? null),
				issuer: item.issuer ?? null,
				redeemable: item.redeemable ?? null,
				attestations: item.attestations ?? null,
				cexListed: item.cexListed ?? null,
				kycForMintRedeem: item.kycForMintRedeem ?? null,
				kycAllowlistedWhitelistedToTransferHold: item.kycAllowlistedWhitelistedToTransferHold ?? null,
				transferable: item.transferable ?? null,
				selfCustody: item.selfCustody ?? null,
				stablecoin: item.stablecoin,
				governance: item.governance,
				trueRWA: isTrueRWA,
				suspicious: item.suspicious === true,
				suspiciousReason: item.suspiciousReason ?? null,
				onChainMcap: onChainMcapBreakdown
					? {
							total: effectiveOnChainMcap,
							breakdown: getSortedBreakdownEntries(aggregatedMetrics.breakdowns.onChainMcapByChain, selectedChain)
						}
					: null,
				activeMcap: activeMcapBreakdown
					? {
							total: effectiveActiveMcap,
							breakdown: getSortedBreakdownEntries(aggregatedMetrics.breakdowns.activeMcapByChain, selectedChain)
						}
					: null,
				defiActiveTvl: {
					total: effectiveDeFiActiveTvl,
					breakdown: getSortedBreakdownEntries(
						isChainFiltered
							? aggregatedMetrics.breakdowns.defiActiveTvlByProtocolFiltered
							: aggregatedMetrics.breakdowns.defiActiveTvlByProtocol
					)
				},
				defiActiveTvlByChain: {
					total: effectiveDeFiActiveTvl,
					breakdown: getSortedBreakdownEntries(
						isChainFiltered
							? aggregatedMetrics.breakdowns.defiActiveTvlByChainFiltered
							: aggregatedMetrics.breakdowns.defiActiveTvlByChain
					)
				},
				bridgeTvl: effectiveBridgeTvl,
				bridgeTvlByChain: {
					total: effectiveBridgeTvl,
					breakdown: getSortedBreakdownEntries(effectiveBridgeTvlByChain, selectedChain)
				},
				bridgeTvlByProtocol:
					item.bridgeTvlBreakdown == null
						? null
						: {
								total: effectiveBridgeTvl,
								breakdown: getSortedBreakdownEntries(effectiveBridgeTvlByProtocol)
							}
			}

			// Only include asset if it exists on the selected chain/category (or no route filter)
			if (hasChainInTvl && hasCategoryMatch && hasPlatformMatch && hasAssetGroupMatch && asset.assetName) {
				const isStablecoin = !!item.stablecoin
				const isGovernance = !!item.governance
				const isStablecoinOnly = isStablecoin && !isGovernance
				const isGovernanceOnly = isGovernance && !isStablecoin
				const isStablecoinAndGovernance = isStablecoin && isGovernance
				const isBaseAsset = !isStablecoin && !isGovernance
				const includeInAggregates = selectedPlatform != null || item.suspicious !== true

				assets.push(asset)
				spotAssetCount += 1
				if (item.activeMcapData !== false) hasTrackedActiveMcapAsset = true
				// Only expose `assetNames` when filtering by platform (used for platform-level UI filters).
				if (selectedPlatform) {
					assetNames.set(asset.assetName, (assetNames.get(asset.assetName) ?? 0) + effectiveOnChainMcap)
				}

				// Track base totals (exclude stablecoin/governance buckets entirely)
				if (includeInAggregates && isBaseAsset) {
					totalOnChainMcap += effectiveOnChainMcap
					totalActiveMcap += effectiveActiveMcap
					totalDeFiActiveTvl += effectiveDeFiActiveTvl
				}

				if (includeInAggregates && isStablecoinOnly) {
					totalOnChainMcapStablecoinsOnly += effectiveOnChainMcap
					totalActiveMcapStablecoinsOnly += effectiveActiveMcap
					totalDeFiActiveTvlStablecoinsOnly += effectiveDeFiActiveTvl
				} else if (includeInAggregates && isGovernanceOnly) {
					totalOnChainMcapGovernanceOnly += effectiveOnChainMcap
					totalActiveMcapGovernanceOnly += effectiveActiveMcap
					totalDeFiActiveTvlGovernanceOnly += effectiveDeFiActiveTvl
				} else if (includeInAggregates && isStablecoinAndGovernance) {
					totalOnChainMcapStablecoinsAndGovernance += effectiveOnChainMcap
					totalActiveMcapStablecoinsAndGovernance += effectiveActiveMcap
					totalDeFiActiveTvlStablecoinsAndGovernance += effectiveDeFiActiveTvl
				}

				// Filter options come from the rows they filter, Unknown included, ranked by onchain mcap.
				addRwaFilterOptions(filterOptions, asset, effectiveOnChainMcap)
				if (asset.issuer) {
					// issuerSet is used for *base* issuer count (exclude stablecoin/governance buckets)
					if (includeInAggregates && isBaseAsset) {
						issuerSet.add(asset.issuer)
					} else if (includeInAggregates && isStablecoinOnly) {
						issuerSetStablecoinsOnly.add(asset.issuer)
					} else if (includeInAggregates && isGovernanceOnly) {
						issuerSetGovernanceOnly.add(asset.issuer)
					} else if (includeInAggregates && isStablecoinAndGovernance) {
						issuerSetStablecoinsAndGovernance.add(asset.issuer)
					}
				}
			}
		}

		const perpsOverlayRows = selectedChain
			? []
			: buildRWAPerpsContractOverlayRows({
					markets: filteredPerpsMarkets,
					...(selectedCategory ? { selectedCategory } : {}),
					...(selectedPlatform ? { selectedPlatform } : {}),
					...(selectedAssetGroup ? { selectedAssetGroup } : {})
				})

		for (const asset of perpsOverlayRows) {
			assets.push(asset)
			if (selectedPlatform) {
				assetNames.set(asset.assetName, assetNames.get(asset.assetName) ?? 0)
			}
			addRwaFilterOptions(filterOptions, asset, 0)
		}

		const formattedRwaClassifications = rankRwaFilterOptions(filterOptions.rwaClassifications)
		const formattedAccessModels = rankRwaFilterOptions(filterOptions.accessModels)
		const formattedTypes = rankRwaFilterOptions(filterOptions.types)
		const formattedAssetClasses = rankRwaFilterOptions(filterOptions.assetClasses)
		const formattedCategories = rankRwaFilterOptions(filterOptions.categories)

		const chainNavValues = params.rwaList.chains.map((chain) => ({
			label: chain,
			to: `/rwa/chain/${rwaSlug(chain)}`
		}))
		const categoryNavValues = filterCategoriesForStandardRwaOverview(params.rwaList.categories).map((category) => ({
			label: category,
			to: `/rwa/category/${rwaSlug(category)}`
		}))
		const platformNavValues = getRWAPlatformRoutes(params.rwaList).map((platform) => ({
			label: platform.name,
			to: `/rwa/platform/${platform.slug}`
		}))
		const assetGroupNavValues = assetGroupValues.map((assetGroup) => {
			const normalizedAssetGroup = normalizeRwaAssetGroup(assetGroup)
			return {
				label: normalizedAssetGroup,
				to: `/rwa/asset-group/${rwaSlug(normalizedAssetGroup)}`
			}
		})

		// Pre-aggregate chart data server-side so we don't ship the huge ticker-level payload to the client.
		const defaultInclusion = selectedPlatform
			? inferPlatformRWAOverviewInclusion(assets.filter((asset) => asset.kind === 'spot'))
			: routeDefaultInclusion
		// Only an explicit metadata opt-out removes Active AUM. A tracked asset can have an empty current
		// breakdown while retaining valid history. Perps-only scopes keep the normal metric options.
		const chartMetricAvailability = {
			hasActiveMcapData: spotAssetCount === 0 || hasTrackedActiveMcapAsset
		}
		const defaultChartMetric = getDefaultChartMetric(chartMetricAvailability)
		const seriesByAsset = selectedPlatform
			? await fetchRWAChartDataByAsset({
					target,
					includeStablecoins: true,
					includeGovernance: true
				}).catch((error) => {
					console.error('Failed to fetch RWA platform chart data by asset:', error)
					return null
				})
			: prefetchedChartData
		const chartRows = seriesByAsset ? normalizeRWAChartMetricRows(seriesByAsset, defaultChartMetric) : null
		const priorIndex = buildRwaPriorIndex(seriesByAsset)
		for (const asset of assets) {
			if (asset.kind !== 'spot') continue
			asset.priors = priorIndex.priors(asset.canonicalMarketId)
			asset.firstSeen = priorIndex.firstSeenMs(asset.canonicalMarketId)
		}
		const defaultGroupBy = getRwaDefaultGroupBy('assets', {
			scope: target.kind
		})
		const defaultChartSource = getRwaSpotChartSource(defaultGroupBy)
		const defaultFilteredAssets = applyDefaultAssetFilters(assets, {
			includeStablecoins: defaultInclusion.includeStablecoins,
			includeGovernance: defaultInclusion.includeGovernance,
			includeWrappers: areWrappersIncludedByDefault(mode, selectedCategory ?? null)
		})
		const defaultAggregateAssets =
			mode === 'platform' ? defaultFilteredAssets : defaultFilteredAssets.filter((asset) => asset.suspicious !== true)
		/* The default Group by is folded from the rows the page already has; the front page also ships the chain
		   lines, ten upstream histories, so picking Chain costs nothing in the browser. Both wait beside the cards. */
		const initialChartDatasets: Array<IRWAInitialChartDataset> = []
		if (chartRows && defaultChartSource.kind === 'assets') {
			/* The browser folds this to the same ten before drawing it, so ship only those; a platform page's asset fold is one series per asset. */
			initialChartDatasets.push({
				metric: defaultChartMetric,
				groupBy: defaultGroupBy,
				dataset: foldRwaTopSeries(
					buildRwaCanonicalMetricDataset(
						aggregateRwaMetricData(defaultAggregateAssets, chartRows, defaultChartSource.mode),
						defaultChartMetric,
						false
					),
					{}
				)
			})
		}
		const [chainDataset, cards] = await Promise.all([
			chartRows && target.kind === 'all'
				? buildInitialChainChartDataset({
						assets: defaultAggregateAssets,
						chartRows,
						metric: defaultChartMetric
					})
				: Promise.resolve(null),
			target.kind === 'all' ? buildOverviewCards(defaultAggregateAssets) : Promise.resolve(null)
		])
		if (chainDataset)
			initialChartDatasets.push({
				metric: defaultChartMetric,
				groupBy: 'chain',
				dataset: chainDataset
			})
		return {
			platformPage: null,
			assets: assets.sort((a, b) => (b.onChainMcap?.total ?? 0) - (a.onChainMcap?.total ?? 0)),
			typeOptions: formattedTypes.map((type) => {
				const help = definitions.type.values?.[type]
				return { key: type, name: type, ...(help ? { help } : {}) }
			}),
			assetClassOptions: formattedAssetClasses.map((assetClass) => {
				const help = definitions.assetClass.values?.[assetClass]
				return { key: assetClass, name: assetClass, ...(help ? { help } : {}) }
			}),
			rwaClassificationOptions: formattedRwaClassifications.map((classification) => {
				const help = definitions.rwaClassification.values?.[classification]
				return {
					key: classification,
					name: classification,
					...(help ? { help } : {})
				}
			}),
			accessModelOptions: formattedAccessModels.map((accessModel) => {
				const help = definitions.accessModel.values?.[accessModel]
				return {
					key: accessModel,
					name: accessModel,
					...(help ? { help } : {})
				}
			}),
			categoriesOptions: formattedCategories.map((category) => {
				const help = definitions.category.values?.[category]
				return { key: category, name: category, ...(help ? { help } : {}) }
			}),
			platforms: rankRwaFilterOptions(filterOptions.platforms),
			assetGroups: rankRwaFilterOptions(filterOptions.assetGroups),
			assetNames: selectedPlatform
				? Array.from(assetNames.entries())
						.sort((a, b) => b[1] - a[1])
						.map(([key]) => key)
				: [],
			issuers: rankRwaFilterOptions(filterOptions.issuers),
			selectedChain: actualChainName ?? 'All',
			chainLinks:
				selectedCategory || selectedPlatform || selectedAssetGroup || chainNavValues.length === 0
					? []
					: [{ label: 'All', to: '/rwa' }, ...chainNavValues],
			categoryLinks:
				selectedCategory && categoryNavValues.length > 0
					? [{ label: 'All', to: '/rwa/categories' }, ...categoryNavValues]
					: [],
			selectedCategory: actualCategoryName ?? 'All',
			platformLinks:
				selectedPlatform && platformNavValues.length > 0
					? [{ label: 'All', to: '/rwa/platforms' }, ...platformNavValues]
					: [],
			selectedPlatform: actualPlatformName ?? 'All',
			assetGroupLinks: selectedAssetGroup ? [{ label: 'All', to: '/rwa/asset-groups' }, ...assetGroupNavValues] : [],
			selectedAssetGroup: actualAssetGroupName ?? 'All',
			defaultInclusion,
			totals: {
				onChainMcap: totalOnChainMcap,
				activeMcap: totalActiveMcap,
				defiActiveTvl: totalDeFiActiveTvl,
				issuers: Array.from(issuerSet),
				stablecoins: {
					onChainMcap: totalOnChainMcapStablecoinsOnly,
					activeMcap: totalActiveMcapStablecoinsOnly,
					defiActiveTvl: totalDeFiActiveTvlStablecoinsOnly,
					issuers: Array.from(issuerSetStablecoinsOnly)
				},
				governance: {
					onChainMcap: totalOnChainMcapGovernanceOnly,
					activeMcap: totalActiveMcapGovernanceOnly,
					defiActiveTvl: totalDeFiActiveTvlGovernanceOnly,
					issuers: Array.from(issuerSetGovernanceOnly)
				},
				stablecoinsAndGovernance: {
					onChainMcap: totalOnChainMcapStablecoinsAndGovernance,
					activeMcap: totalActiveMcapStablecoinsAndGovernance,
					defiActiveTvl: totalDeFiActiveTvlStablecoinsAndGovernance,
					issuers: Array.from(issuerSetStablecoinsAndGovernance)
				}
			},
			initialChartDatasets,
			cards,
			chartMetricAvailability,
			seriesLatestTimestamp: priorIndex.latestMs,
			platformLogos: collectRwaPlatformLogos(assets, params.rwaPlatformsIndex),
			chainSlug: selectedChain ?? null,
			categorySlug: selectedCategory ?? null,
			platformSlug: selectedPlatform ?? null,
			assetGroupSlug: selectedAssetGroup ?? null
		}
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : 'Failed to get RWA assets overview', { cause: error })
	}
}

// The asset's own DeFiLlama protocol listing(s), so the RWA page can link to the TVL page for the
// same product. `protocolMetadata[id].name` carries the protocol SLUG (a metadata quirk), so
// `displayName` is the only human-readable label available here. The slugs are also what the
// yields path uses to tell the asset's own pool from third-party ones.
async function resolveAssetProtocolLinks(asset: IFetchedRWAProject): Promise<Array<{ name: string; slug: string }>> {
	const ids = Array.isArray(asset.projectId) ? asset.projectId : asset.projectId != null ? [asset.projectId] : []
	if (ids.length === 0) return []
	const metadataCache = await import('~/utils/metadata').then((module) => module.default)
	const links: Array<{ name: string; slug: string }> = []
	for (const id of ids) {
		const meta = metadataCache.protocolMetadata[id]
		if (!meta?.name) continue
		if (links.some((link) => link.slug === meta.name)) continue
		links.push({ name: meta.displayName || meta.name, slug: meta.name })
	}
	return links
}

/** Logo URL per platform slug, for the platforms in the rows only. */
export function collectRwaPlatformLogos(
	assets: IRWAAssetsOverview['assets'],
	index: RWAPlatformsIndex | undefined
): Record<string, string> {
	const logos: Record<string, string> = {}
	if (!index) return logos
	for (const asset of assets) {
		for (const platform of getRealRwaPlatforms(asset.parentPlatform)) {
			const slug = rwaSlug(platform)
			if (slug in logos) continue
			const logo = index.platforms[slug]?.logo
			if (logo) logos[slug] = logo
		}
	}
	return logos
}

export async function getRWAAssetData({
	assetId,
	yieldsSnapshot
}: {
	assetId: string
	yieldsSnapshot: YieldsSnapshot | null
}): Promise<IRWAAssetData | null> {
	try {
		const [data, chartDataset, blockExplorersData] = await Promise.all([
			fetchRWAAssetDataById(assetId),
			fetchRWAAssetChartData(assetId),
			fetchBlockExplorers().catch(() => [])
		])

		const onChainMcapBreakdown = hasMetricBreakdown(data.onChainMcap) ? data.onChainMcap : null
		const activeMcapBreakdown = hasMetricBreakdown(data.activeMcap) ? data.activeMcap : null
		const aggregatedMetrics = aggregateRwaMetrics({
			onChainMcapBreakdown,
			activeMcapBreakdown,
			defiActiveTvlBreakdown: data.defiActiveTvl
		})

		const isTrueRWA = data.rwaClassification === 'True RWA'
		// Get the classification description - use True RWA definition if trueRWA flag
		const classificationKey = isTrueRWA ? 'True RWA' : data.rwaClassification
		const rwaClassificationDescription = classificationKey
			? (definitions.rwaClassification.values?.[classificationKey] ?? null)
			: null

		const accessModelDescription = definitions.accessModel.values?.[data.accessModel] ?? null
		// Get asset class descriptions
		const assetClassDescriptions: Record<string, string> = {}
		for (const ac of data.assetClass ?? []) {
			const description = ac ? definitions.assetClass.values?.[ac] : null
			if (description) {
				assetClassDescriptions[ac] = description
			}
		}

		let contractUrls: Record<string, Record<string, string>> | null = null
		if (data.contracts) {
			contractUrls = {}
			for (const chain in data.contracts) {
				const addresses = data.contracts[chain]
				if (!addresses) continue
				for (const address of addresses) {
					const result = getBlockExplorerNew({
						apiResponse: blockExplorersData,
						address,
						chainName: chain,
						urlType: 'token'
					})
					if (result) {
						contractUrls[chain] ??= {}
						contractUrls[chain][address] = result.url
					}
				}
			}
		}

		if (chartDataset && data.activeMcapData === false) {
			const [timestampDimension, ...seriesDimensions] = chartDataset.dimensions
			chartDataset.dimensions = [
				timestampDimension,
				...seriesDimensions.filter((dimension) => dimension !== 'Active AUM')
			]
		}

		const protocolLinks = await resolveAssetProtocolLinks(data)

		let yieldMatch = emptyRWAYieldResult()
		if (yieldsSnapshot) {
			try {
				yieldMatch = await getRWAYieldPools(yieldsSnapshot, data, new Set(protocolLinks.map((link) => link.slug)))
			} catch (error) {
				console.log('[HTTP]:[ERROR]:[RWA_YIELD]:', assetId, error instanceof Error ? error.message : '')
			}
		}

		return {
			...data,
			slug: data.canonicalMarketId,
			protocolLinks,
			trueRWA: isTrueRWA,
			rwaClassification: isTrueRWA ? 'RWA' : (data.rwaClassification ?? null),
			rwaClassificationDescription,
			accessModelDescription,
			assetClassDescriptions,
			contractUrls,
			onChainMcap: onChainMcapBreakdown
				? {
						total: aggregatedMetrics.totals.onChainMcap,
						breakdown: getSortedBreakdownEntries(aggregatedMetrics.breakdowns.onChainMcapByChain)
					}
				: null,
			activeMcap: activeMcapBreakdown
				? {
						total: aggregatedMetrics.totals.activeMcap,
						breakdown: getSortedBreakdownEntries(aggregatedMetrics.breakdowns.activeMcapByChain)
					}
				: null,
			defiActiveTvl: {
				total: aggregatedMetrics.totals.defiActiveTvl,
				breakdown: getSortedBreakdownEntries(aggregatedMetrics.breakdowns.defiActiveTvlByProtocol)
			},
			defiActiveTvlByChain: {
				total: aggregatedMetrics.totals.defiActiveTvl,
				breakdown: getSortedBreakdownEntries(aggregatedMetrics.breakdowns.defiActiveTvlByChain)
			},
			defiActiveTvlByProtocolChain: buildRwaDefiTvlProtocolChainBreakdown(data.defiActiveTvl),
			chartDataset,
			...yieldMatch
		}
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : 'Failed to get RWA asset data', { cause: error })
	}
}
