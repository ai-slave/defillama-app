import { fetchBlockExplorers } from '~/api'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import type { IRWAList } from '~/utils/metadata/types'
import {
	fetchRWAActiveTVLs,
	fetchRWAAssetGroupBreakdownChartData,
	fetchRWAChainBreakdownChartData,
	fetchRWACategoryBreakdownChartData,
	fetchRWAPlatformBreakdownChartData,
	fetchRWAStats,
	fetchRWAChartMetricDataByAsset,
	fetchRWAAssetDataById,
	fetchRWAAssetChartData
} from './api'
import type {
	IFetchedRWAProject,
	IRWAChartMetricRows,
	IRWAAssetsOverview,
	IRWAAssetData,
	IRWAChainsOverview,
	IRWAChainsOverviewRow,
	IRWACategoriesOverview,
	IRWACategoriesOverviewRow,
	IRWAPlatformsOverview,
	IRWAPlatformsOverviewRow,
	IRWAAssetGroupsOverview,
	IRWAAssetGroupsOverviewRow,
	RWASpotOverviewAsset,
	RWAAssetChartTarget,
	RWADefiTvlProtocolBreakdown
} from './api.types'
import { UNKNOWN_RWA_ASSET_GROUP, appendUnknownRwaAssetGroup, normalizeRwaAssetGroup } from './assetGroup'
import { toOverviewBreakdownChartDataset } from './breakdownDataset'
import {
	aggregateRwaMetricData,
	applyDefaultAssetFilters,
	buildRwaCanonicalMetricDataset,
	type RWAChartAggregationMode
} from './chartAggregation'
import { getRwaTimeSeriesDefaultBreakdown } from './chartState'
import {
	filterCategoriesForStandardRwaOverview,
	getDefaultRWAOverviewInclusion,
	inferPlatformRWAOverviewInclusion,
	isCategoryIncludedInStandardRwaOverview,
	type RWAOverviewMode
} from './constants'
import { definitions } from './definitions'
import { getPrimaryRwaCategory, getRwaPlatforms, UNKNOWN_PLATFORM } from './grouping'
import { aggregateRwaMetrics, hasMetricBreakdown } from './overviewAssembly'
import { fetchRWAPerpsContractBreakdownChartData, fetchRWAPerpsCurrent } from './Perps/api'
import type { IRWAPerpsBreakdownChartResponse, IRWAPerpsMarket } from './Perps/api.types'
import {
	buildRWAPerpsContractOverlayRows,
	buildRWAPerpsOpenInterestOverlayDataset,
	getRealRwaPlatforms
} from './perpsOverlay'
import { buildRWAPlatformAssetSummary } from './PlatformPage/buildPlatformPageData'
import { getRWAPlatformRoutes } from './platformRoutes'
import { rwaSlug } from './rwaSlug'
import { emptyRWAYieldResult, getRWAYieldPools } from './yieldPools.server'

type RWAAssetsOverviewParams = {
	chain?: string
	category?: string
	platform?: string
	assetGroup?: string
	rwaList: IRWAList
}

/** Transpose the raw chain → protocol → tvl map into per-protocol rows with their chain splits, sorted desc. */
export function buildRwaDefiTvlProtocolChainBreakdown(
	breakdown: Record<string, Record<string, number>>
): RWADefiTvlProtocolBreakdown[] | null {
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
	const rows: RWADefiTvlProtocolBreakdown[] = []
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
		const [data, perpsMarkets, prefetchedChartRows, openInterestChartRows]: [
			Array<IFetchedRWAProject>,
			IRWAPerpsMarket[],
			IRWAChartMetricRows | null | undefined,
			IRWAPerpsBreakdownChartResponse | null
		] = await Promise.all([
			fetchRWAActiveTVLs(),
			fetchRWAPerpsCurrent().catch(() => []),
			selectedPlatform
				? Promise.resolve(undefined)
				: fetchRWAChartMetricDataByAsset({
						target,
						metric: 'activeMcap',
						includeStablecoins: routeDefaultInclusion.includeStablecoins,
						includeGovernance: routeDefaultInclusion.includeGovernance
					}),
			selectedChain
				? Promise.resolve(null)
				: fetchRWAPerpsContractBreakdownChartData({ key: 'openInterest', target: { kind: 'all' } })
		])

		const filteredData = data.filter(
			(item) => !(item.category ?? []).some((category) => !isCategoryIncludedInStandardRwaOverview(category))
		)
		const platformAssetSummary = selectedPlatform ? buildRWAPlatformAssetSummary(data, selectedPlatform) : null
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
		const types = new Map<string, number>()
		const assetClasses = new Map<string, number>()
		const rwaClassifications = new Map<string, number>()
		const accessModels = new Map<string, number>()
		const categories = new Map<string, number>()
		const platforms = new Map<string, number>()
		const assetGroups = new Map<string, number>()
		const assetNames = new Map<string, number>()
		const issuers = new Map<string, number>()
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

				// Add to categories/issuers/assetClasses/rwaClassifications/accessModels for assets on this chain
				if (asset.type) {
					types.set(asset.type, (types.get(asset.type) ?? 0) + effectiveOnChainMcap)
				}
				for (const assetClass of asset.assetClass ?? []) {
					if (assetClass) {
						assetClasses.set(assetClass, (assetClasses.get(assetClass) ?? 0) + effectiveOnChainMcap)
					}
				}
				const primaryCategory = getPrimaryRwaCategory(asset.category)
				if (primaryCategory) {
					categories.set(primaryCategory, (categories.get(primaryCategory) ?? 0) + effectiveOnChainMcap)
				}
				for (const platform of getRwaPlatforms(asset.parentPlatform)) {
					if (platform === UNKNOWN_PLATFORM) continue
					platforms.set(platform, (platforms.get(platform) ?? 0) + effectiveOnChainMcap)
				}
				// Preserve assets with blank assetGroup values by assigning them to the normalized Unknown bucket.
				const assetGroup = normalizeRwaAssetGroup(asset.assetGroup)
				assetGroups.set(assetGroup, (assetGroups.get(assetGroup) ?? 0) + effectiveOnChainMcap)
				if (asset.rwaClassification) {
					rwaClassifications.set(
						asset.rwaClassification,
						(rwaClassifications.get(asset.rwaClassification) ?? 0) + effectiveOnChainMcap
					)
				}
				if (asset.accessModel) {
					accessModels.set(asset.accessModel, (accessModels.get(asset.accessModel) ?? 0) + effectiveOnChainMcap)
				}
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
					issuers.set(asset.issuer, (issuers.get(asset.issuer) ?? 0) + effectiveOnChainMcap)
				} else {
					// Surface assets without a known issuer as a selectable "Unknown" bucket so they can be filtered out.
					issuers.set('Unknown', (issuers.get('Unknown') ?? 0) + effectiveOnChainMcap)
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
			if (asset.type) {
				types.set(asset.type, types.get(asset.type) ?? 0)
			}
			for (const assetClass of asset.assetClass ?? []) {
				assetClasses.set(assetClass, assetClasses.get(assetClass) ?? 0)
			}
			const primaryCategory = getPrimaryRwaCategory(asset.category)
			if (primaryCategory) {
				categories.set(primaryCategory, categories.get(primaryCategory) ?? 0)
			}
			for (const platform of getRwaPlatforms(asset.parentPlatform)) {
				if (platform === UNKNOWN_PLATFORM) continue
				platforms.set(platform, platforms.get(platform) ?? 0)
			}
			const assetGroup = normalizeRwaAssetGroup(asset.assetGroup)
			assetGroups.set(assetGroup, assetGroups.get(assetGroup) ?? 0)
			if (asset.rwaClassification) {
				rwaClassifications.set(asset.rwaClassification, rwaClassifications.get(asset.rwaClassification) ?? 0)
			}
			if (asset.accessModel) {
				accessModels.set(asset.accessModel, accessModels.get(asset.accessModel) ?? 0)
			}
			if (asset.issuer) {
				issuers.set(asset.issuer, issuers.get(asset.issuer) ?? 0)
			}
		}

		const formattedRwaClassifications = Array.from(rwaClassifications.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([key]) => key)

		const formattedAccessModels = Array.from(accessModels.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([key]) => key)

		const formattedTypes = Array.from(types.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([key]) => key)

		const formattedAssetClasses = Array.from(assetClasses.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([key]) => key)

		const formattedCategories = Array.from(categories.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([key]) => key)
		const formattedPlatforms = Array.from(platforms.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([key]) => key)
		const formattedAssetGroups = Array.from(assetGroups.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([key]) => key)

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
		const chartRows = selectedPlatform
			? await fetchRWAChartMetricDataByAsset({
					target,
					metric: 'activeMcap',
					includeStablecoins: defaultInclusion.includeStablecoins,
					includeGovernance: defaultInclusion.includeGovernance
				})
			: (prefetchedChartRows ?? null)
		const aggregationMode: RWAChartAggregationMode = getRwaTimeSeriesDefaultBreakdown(mode, selectedAssetGroup ?? null)
		const defaultFilteredAssets = applyDefaultAssetFilters(assets, {
			includeStablecoins: defaultInclusion.includeStablecoins,
			includeGovernance: defaultInclusion.includeGovernance,
			mode,
			...(selectedCategory ? { categorySlug: selectedCategory } : {})
		})
		const defaultAggregateAssets =
			mode === 'platform' ? defaultFilteredAssets : defaultFilteredAssets.filter((asset) => asset.suspicious !== true)
		const defaultFilteredPerpsRows = defaultAggregateAssets.filter((asset) => asset.kind === 'perps')
		const initialChartDataset = chartRows
			? {
					metric: 'activeMcap' as const,
					dataset: buildRwaCanonicalMetricDataset(
						aggregateRwaMetricData(defaultAggregateAssets, chartRows, aggregationMode),
						'activeMcap',
						false
					)
				}
			: null
		const initialOpenInterestChartDataset =
			selectedChain || openInterestChartRows == null
				? null
				: buildRWAPerpsOpenInterestOverlayDataset({
						rows: defaultFilteredPerpsRows,
						breakdownRows: openInterestChartRows
					})

		return {
			platformPage: null,
			platformAssetSummary,
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
				return { key: classification, name: classification, ...(help ? { help } : {}) }
			}),
			accessModelOptions: formattedAccessModels.map((accessModel) => {
				const help = definitions.accessModel.values?.[accessModel]
				return { key: accessModel, name: accessModel, ...(help ? { help } : {}) }
			}),
			categoriesOptions: formattedCategories.map((category) => {
				const help = definitions.category.values?.[category]
				return { key: category, name: category, ...(help ? { help } : {}) }
			}),
			platforms: formattedPlatforms,
			assetGroups: formattedAssetGroups,
			assetNames: selectedPlatform
				? Array.from(assetNames.entries())
						.sort((a, b) => b[1] - a[1])
						.map(([key]) => key)
				: [],
			issuers: Array.from(issuers.entries())
				.sort((a, b) => b[1] - a[1])
				.map(([key]) => key),
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
			initialChartDataset,
			initialOpenInterestChartDataset,
			chainSlug: selectedChain ?? null,
			categorySlug: selectedCategory ?? null,
			platformSlug: selectedPlatform ?? null,
			assetGroupSlug: selectedAssetGroup ?? null
		}
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : 'Failed to get RWA assets overview')
	}
}

export async function getRWAChainsOverview(): Promise<IRWAChainsOverview> {
	const [data, activeMcapRows] = await Promise.all([
		fetchRWAStats(),
		fetchRWAChainBreakdownChartData({ key: 'activeMcap' })
	])

	const rows: IRWAChainsOverviewRow[] = []
	for (const [chain, stats] of Object.entries(data.byChain)) {
		rows.push({
			...stats,
			chain
		})
	}

	return {
		rows: rows.sort((a, b) => b.base.onChainMcap - a.base.onChainMcap),
		initialChartDataset: toOverviewBreakdownChartDataset(activeMcapRows, {
			breakdown: 'chain',
			key: 'activeMcap',
			includeStablecoin: false,
			includeGovernance: false
		})
	}
}

export async function getRWACategoriesOverview(): Promise<IRWACategoriesOverview> {
	const [data, activeMcapRows] = await Promise.all([
		fetchRWAStats(),
		fetchRWACategoryBreakdownChartData({ key: 'activeMcap', includeStablecoin: false, includeGovernance: false })
	])

	const rows: IRWACategoriesOverviewRow[] = []
	for (const [category, stats] of Object.entries(data.byCategory)) {
		if (!isCategoryIncludedInStandardRwaOverview(category)) continue
		rows.push({
			category,
			...stats
		})
	}

	return {
		rows: rows.sort((a, b) => b.base.onChainMcap - a.base.onChainMcap),
		initialChartDataset: toOverviewBreakdownChartDataset(activeMcapRows, {
			breakdown: 'category',
			key: 'activeMcap',
			includeStablecoin: false,
			includeGovernance: false
		})
	}
}

export async function getRWAPlatformsOverview(): Promise<IRWAPlatformsOverview> {
	const [data, activeMcapRows] = await Promise.all([
		fetchRWAStats(),
		fetchRWAPlatformBreakdownChartData({ key: 'activeMcap', includeStablecoin: false, includeGovernance: false })
	])

	const rows: IRWAPlatformsOverviewRow[] = []
	for (const [platform, stats] of Object.entries(data.byPlatform)) {
		rows.push({
			...stats,
			platform
		})
	}

	return {
		rows: rows.sort((a, b) => b.base.onChainMcap - a.base.onChainMcap),
		initialChartDataset: toOverviewBreakdownChartDataset(activeMcapRows, {
			breakdown: 'platform',
			key: 'activeMcap',
			includeStablecoin: false,
			includeGovernance: false
		})
	}
}

export async function getRWAAssetGroupsOverview(): Promise<IRWAAssetGroupsOverview> {
	const [data, activeMcapRows] = await Promise.all([
		fetchRWAStats(),
		fetchRWAAssetGroupBreakdownChartData({ key: 'activeMcap', includeStablecoin: false, includeGovernance: false })
	])

	const rows: IRWAAssetGroupsOverviewRow[] = []
	for (const [assetGroup, stats] of Object.entries(data.byAssetGroup)) {
		rows.push({
			assetGroup: normalizeRwaAssetGroup(assetGroup),
			...stats
		})
	}

	return {
		rows: rows.sort((a, b) => b.base.onChainMcap - a.base.onChainMcap),
		initialChartDataset: toOverviewBreakdownChartDataset(activeMcapRows, {
			breakdown: 'assetGroup',
			key: 'activeMcap',
			includeStablecoin: false,
			includeGovernance: false
		})
	}
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
				...seriesDimensions.filter((dimension) => dimension !== 'Active Mcap')
			]
		}

		let yieldMatch = emptyRWAYieldResult()
		if (yieldsSnapshot) {
			try {
				yieldMatch = await getRWAYieldPools(yieldsSnapshot, data)
			} catch (err) {
				console.log('[HTTP]:[ERROR]:[RWA_YIELD]:', assetId, err instanceof Error ? err.message : '')
			}
		}

		return {
			...data,
			slug: data.canonicalMarketId,
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
		throw new Error(error instanceof Error ? error.message : 'Failed to get RWA asset data')
	}
}
