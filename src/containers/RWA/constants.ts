import { rwaSlug } from './rwaSlug'

export type RWAOverviewMode = 'chain' | 'category' | 'platform' | 'assetGroup'

export type RWAOverviewInclusionDefaults = {
	includeStablecoins: boolean
	includeGovernance: boolean
	includeRwaPerps: boolean
	// Include the bridge/interop portion of DeFi Active TVL. Default true = today's numbers. Optional so existing callers/fixtures compile.
	includeBridgeTvl?: boolean
}

export type RWAOverviewInclusionContext = {
	mode: RWAOverviewMode
	chainSlug?: string | null
	categorySlug?: string | null
	platformSlug?: string | null
	assetGroupSlug?: string | null
}

type RWAOverviewPath = `/rwa${string}`

export const DEFAULT_EXCLUDED_TYPES = new Set(['Wrapper'])
export const OTHER_RWAS_SLUG = 'other-rwas'
export const RWA_WRAPPERS_SLUG = 'rwa-wrappers'
export const RWA_YIELD_WRAPPER_SLUG = 'rwa-yield-wrapper'
export const EXCLUDED_STANDARD_RWA_CATEGORY_SLUGS = new Set(['rwa-perps'])
const DEFAULT_INCLUDED_TYPES_BY_CATEGORY = new Map([
	[OTHER_RWAS_SLUG, new Set(['Asset', 'Platform', 'Wrapper'])],
	[RWA_WRAPPERS_SLUG, new Set(['Asset', 'Platform', 'Wrapper'])]
])
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
	let governanceMcap = 0

	for (const asset of assets) {
		const mcap = asset.onChainMcap?.total ?? 0
		totalMcap += mcap
		if (asset.stablecoin) {
			stablecoinCount += 1
			stablecoinMcap += mcap
		}
		if (asset.governance) {
			governanceCount += 1
			governanceMcap += mcap
		}
		if (!asset.stablecoin && !asset.governance) baseCount += 1
	}
	let includeStablecoins = stablecoinCount > assets.length / 2 || stablecoinMcap > totalMcap / 2
	let includeGovernance = governanceCount > assets.length / 2 || governanceMcap > totalMcap / 2

	// Avoid an empty initial page when every asset belongs to an evenly split optional classification.
	if (baseCount === 0 && !includeStablecoins && !includeGovernance) {
		includeStablecoins = stablecoinCount > 0
		includeGovernance = governanceCount > 0
	}

	return {
		includeStablecoins,
		includeGovernance,
		includeRwaPerps: false,
		includeBridgeTvl: true
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
		includeRwaPerps: false,
		includeBridgeTvl: true
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

export function isTypeIncludedByDefault(
	type: string | null | undefined,
	mode: RWAOverviewMode,
	categorySlug?: string | null
): boolean {
	const normalizedType = type || 'Unknown'
	if (mode === 'platform' || mode === 'assetGroup') return true
	if (mode === 'category' && categorySlug) {
		const includedTypes = DEFAULT_INCLUDED_TYPES_BY_CATEGORY.get(categorySlug)
		if (includedTypes) return includedTypes.has(normalizedType)
	}
	if (mode === 'category' && categorySlug === RWA_YIELD_WRAPPER_SLUG) return true
	return !DEFAULT_EXCLUDED_TYPES.has(normalizedType)
}

export function getDefaultSelectedTypes(
	allTypes: Array<string>,
	mode: RWAOverviewMode,
	categorySlug?: string | null
): Array<string> {
	return allTypes.filter((type) => isTypeIncludedByDefault(type, mode, categorySlug))
}
