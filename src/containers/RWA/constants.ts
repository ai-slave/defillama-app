import { rwaSlug } from './rwaSlug'
import { areWrappersIncludedByDefault } from './wrappers'

export type RWAOverviewMode = 'chain' | 'category' | 'platform' | 'assetGroup'

export type RWAOverviewInclusionDefaults = {
	includeStablecoins: boolean
	includeGovernance: boolean
	// Include the bridge/interop portion of DeFi Active TVL. Default true = today's numbers. Optional so existing callers/fixtures compile.
	includeBridgeTvl?: boolean
	/** Wrapper rows; off unless the page is about them. */
	includeWrappers?: boolean
}

export type RWAOverviewInclusionContext = {
	mode: RWAOverviewMode
	chainSlug?: string | null
	categorySlug?: string | null
	platformSlug?: string | null
	assetGroupSlug?: string | null
}

type RWAOverviewPath = `/rwa${string}`

export const EXCLUDED_STANDARD_RWA_CATEGORY_SLUGS = new Set(['rwa-perps'])
const STABLECOINS_DEFAULT_RWA_PATHS = new Set<RWAOverviewPath>([
	'/rwa/category/fiat-stablecoins',
	'/rwa/category/non-rwa-stablecoins',
	'/rwa/category/other-rwas',
	'/rwa/category/rwa-stablecoins',
	'/rwa/category/rwa-yield-wrapper'
])
const GOVERNANCE_DEFAULT_RWA_PATHS = new Set<RWAOverviewPath>([
	'/rwa/category/governance-tokens',
	'/rwa/category/other-rwas',
	'/rwa/category/rwa-yield-wrapper'
])

// NOTE: defillama-server mirrors this inference to weigh RWA platform search
// results by their default-visible mcap (getRwaPlatformDefaultVisibleMcap in
// defi/src/updateSearch.ts) - keep the two implementations in sync.
export function inferPlatformRWAOverviewInclusion(
	assets: Array<{
		stablecoin: boolean | null
		governance: boolean | null
		onChainMcap: { total: number } | null
	}>
): RWAOverviewInclusionDefaults {
	let baseCount = 0
	let stablecoinCount = 0
	let governanceCount = 0
	let totalMcap = 0
	let stablecoinMcap = 0

	for (const asset of assets) {
		const mcap = asset.onChainMcap?.total ?? 0
		totalMcap += mcap
		if (asset.stablecoin) {
			stablecoinCount += 1
			stablecoinMcap += mcap
		}
		if (asset.governance) governanceCount += 1
		if (!asset.stablecoin && !asset.governance) baseCount += 1
	}
	let includeStablecoins = stablecoinCount > assets.length / 2 || stablecoinMcap > totalMcap / 2
	// A governance token is not an asset under management, so it never opens counted into a
	// platform's AUM however much of the platform it is: Ondo's On-chain AUM headline excludes
	// ONDO, and a majority rule here would have the chart under it plot nearly double.
	let includeGovernance = false

	// Avoid an empty initial page when every asset belongs to an optional classification.
	if (baseCount === 0 && !includeStablecoins) {
		includeStablecoins = stablecoinCount > 0
		// Only a platform holding nothing else falls back to showing governance tokens.
		includeGovernance = stablecoinCount === 0 && governanceCount > 0
	}

	return {
		includeStablecoins,
		includeGovernance,
		includeBridgeTvl: true,
		includeWrappers: true
	}
}

export function isCategoryIncludedInStandardRwaOverview(category: string | null | undefined): boolean {
	if (!category) return false
	return !EXCLUDED_STANDARD_RWA_CATEGORY_SLUGS.has(rwaSlug(category))
}

export function filterCategoriesForStandardRwaOverview(categories: Array<string>): Array<string> {
	return categories.filter((category) => isCategoryIncludedInStandardRwaOverview(category))
}

export function getDefaultRWAOverviewInclusion({
	mode,
	chainSlug,
	categorySlug,
	platformSlug,
	assetGroupSlug
}: RWAOverviewInclusionContext): RWAOverviewInclusionDefaults {
	const path = getRWAOverviewPath({
		mode,
		...(chainSlug !== undefined ? { chainSlug } : {}),
		...(categorySlug !== undefined ? { categorySlug } : {}),
		...(platformSlug !== undefined ? { platformSlug } : {}),
		...(assetGroupSlug !== undefined ? { assetGroupSlug } : {})
	})

	return {
		includeStablecoins: path ? STABLECOINS_DEFAULT_RWA_PATHS.has(path) : false,
		includeGovernance: path ? GOVERNANCE_DEFAULT_RWA_PATHS.has(path) : false,
		includeBridgeTvl: true,
		includeWrappers: areWrappersIncludedByDefault(mode, categorySlug)
	}
}

function getRWAOverviewPath({
	mode,
	chainSlug,
	categorySlug,
	platformSlug,
	assetGroupSlug
}: RWAOverviewInclusionContext): RWAOverviewPath | null {
	switch (mode) {
		case 'chain':
			return chainSlug ? `/rwa/chain/${chainSlug}` : '/rwa'
		case 'category':
			return categorySlug ? `/rwa/category/${categorySlug}` : '/rwa/categories'
		case 'platform':
			return platformSlug ? `/rwa/platform/${platformSlug}` : '/rwa/platforms'
		case 'assetGroup':
			return assetGroupSlug ? `/rwa/asset-group/${assetGroupSlug}` : '/rwa/asset-groups'
		default:
			return null
	}
}
