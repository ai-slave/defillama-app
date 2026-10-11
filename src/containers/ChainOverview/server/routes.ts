import { getMetadataCache, type StaticParamPath } from '~/server/routeRegistry/common'
import { slug } from '~/utils'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import type { IChainMetadata } from '~/utils/metadata/types'

export type ChainRoute = {
	metadata: IChainMetadata
	canonicalSlug: string
	canonicalName: string
}

export type ChainMetric =
	| 'stablecoins'
	| 'chainAssets'
	| 'fees'
	| 'dexs'
	| 'perps'
	| 'dexAggregators'
	| 'perpsAggregators'
	| 'bridgeAggregators'
	| 'openInterest'
	| 'normalizedVolume'
	| 'optionsPremiumVolume'
	| 'optionsNotionalVolume'

const chainFlaggedRoutes = [
	{ prefix: 'bridged', flag: 'chainAssets' },
	{ prefix: 'fees/chain', flag: 'fees' },
	{ prefix: 'revenue/chain', flag: 'fees' },
	{ prefix: 'earnings/chain', flag: 'fees' },
	{ prefix: 'holders-revenue/chain', flag: 'fees' },
	{ prefix: 'pf/chain', flag: 'fees' },
	{ prefix: 'ps/chain', flag: 'fees' },
	{ prefix: 'dexs/chain', flag: 'dexs' },
	{ prefix: 'perps/chain', flag: 'perps' },
	{ prefix: 'dex-aggregators/chain', flag: 'dexAggregators' },
	{ prefix: 'perps-aggregators/chain', flag: 'perpsAggregators' },
	{ prefix: 'bridge-aggregators/chain', flag: 'bridgeAggregators' },
	{ prefix: 'open-interest/chain', flag: 'openInterest' },
	{ prefix: 'normalized-volume/chain', flag: 'normalizedVolume' },
	{ prefix: 'options/notional-volume/chain', flag: 'optionsNotionalVolume' },
	{ prefix: 'options/premium-volume/chain', flag: 'optionsPremiumVolume' }
] as const

export function resolveChainParamFromMetadata(chain: string, metadataCache: MetadataCache): ChainRoute | null {
	const normalizedChain = slug(chain)
	if (!normalizedChain) return null

	if (!Object.hasOwn(metadataCache.chainRouteKeyBySlug, normalizedChain)) return null
	const chainKey = metadataCache.chainRouteKeyBySlug[normalizedChain]
	if (!chainKey) return null

	if (!Object.hasOwn(metadataCache.chainMetadata, chainKey)) return null
	const metadata = metadataCache.chainMetadata[chainKey]
	if (!metadata) return null
	return {
		metadata,
		canonicalSlug: slug(metadata.name),
		canonicalName: metadata.name
	}
}

export function resolveChainFeatureParamFromMetadata(
	chain: string,
	metadataCache: MetadataCache,
	hasFeature?: (metadata: IChainMetadata) => boolean
): ChainRoute | null {
	const chainRoute = resolveChainParamFromMetadata(chain, metadataCache)
	if (!chainRoute) return null
	if (hasFeature && !hasFeature(chainRoute.metadata)) return null

	return chainRoute
}

// The redirect runs from getStaticProps, which never sees the query string, so an old or shared link with a
// non-canonical slug (/stablecoins/Ethereum?pegtype=…) lands on the canonical page with its filters reset. Accepted for
// now: such links are rare and the reader rebuilds the view; keeping the query needs the redirect in src/proxy.ts.
export function getChainRouteRedirectDestination(chain: string, chainRoute: ChainRoute, prefix: string): string | null {
	return chain === chainRoute.canonicalSlug ? null : `/${prefix}/${chainRoute.canonicalSlug}`
}

export async function resolveChainParam(chain: string): Promise<ChainRoute | null> {
	return resolveChainParamFromMetadata(chain, await getMetadataCache())
}

export function getChainSlugsFromMetadata(metadataCache: MetadataCache): Array<string> {
	const slugs = new Set<string>()

	for (const chainSlug in metadataCache.chainMetadata) {
		if (!Object.hasOwn(metadataCache.chainMetadata, chainSlug)) continue
		const metadata = metadataCache.chainMetadata[chainSlug]
		if (!metadata) continue
		const canonicalSlug = slug(metadata.name)
		if (canonicalSlug === 'all') continue
		slugs.add(canonicalSlug)
	}

	return [...slugs]
}

export async function getChainStaticPaths(): Promise<Array<StaticParamPath<'chain'>>> {
	return getChainSlugsFromMetadata(await getMetadataCache()).map((chain) => ({ params: { chain } }))
}

export function getChainMetricSlugsFromMetadata(metadataCache: MetadataCache, metric: ChainMetric): Array<string> {
	const slugs = new Set<string>()

	for (const chainSlug in metadataCache.chainMetadata) {
		if (!Object.hasOwn(metadataCache.chainMetadata, chainSlug)) continue
		const metadata = metadataCache.chainMetadata[chainSlug]
		if (!metadata) continue
		if (!metadata[metric]) continue

		const canonicalSlug = slug(metadata.name)
		if (canonicalSlug === 'all') continue

		slugs.add(canonicalSlug)
	}

	return [...slugs]
}

export async function getStablecoinChainStaticPaths(limit = 11): Promise<Array<StaticParamPath<'chain'>>> {
	const metadataCache = await getMetadataCache()
	return getChainMetricSlugsFromMetadata(metadataCache, 'stablecoins')
		.slice(0, limit)
		.map((chain) => ({ params: { chain } }))
}

export function getChainSitemapRoutes(metadataCache: MetadataCache): Array<string> {
	const routes: Array<string> = []

	for (const chainSlug of getChainSlugsFromMetadata(metadataCache)) {
		routes.push(`chain/${chainSlug}`)
	}

	for (const routeDef of chainFlaggedRoutes) {
		for (const chainSlug of getChainMetricSlugsFromMetadata(metadataCache, routeDef.flag)) {
			routes.push(`${routeDef.prefix}/${chainSlug}`)
		}
	}

	return routes
}
