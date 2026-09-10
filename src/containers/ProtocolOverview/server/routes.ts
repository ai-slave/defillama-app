import { resolveCexParamFromMetadata } from '~/containers/Cexs/server/routes'
import { getMetadataCache } from '~/server/routeRegistry/common'
import { slug } from '~/utils'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import type { IProtocolMetadata } from '~/utils/metadata/types'

const EXCLUDED_OVERVIEW_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Staking Pool'])

const isProtocolRouteMetadata = (metadata: IProtocolMetadata) => !metadata.cex

export type ProtocolRoute = {
	id: string
	metadata: IProtocolMetadata
	canonicalSlug: string
}

export type ProtocolFeatureRouteResolution =
	| {
			type: 'route'
			route: ProtocolRoute
	  }
	| {
			type: 'redirect'
			destination: string
	  }

type ProtocolMetric =
	| 'tvl'
	| 'stablecoins'
	| 'bridge'
	| 'treasury'
	| 'yields'
	| 'fees'
	| 'dexs'
	| 'perps'
	| 'dexAggregators'
	| 'perpsAggregators'
	| 'bridgeAggregators'
	| 'tokenRights'
	| 'emissions'
	| 'forks'
	| 'raises'

const protocolTabRoutes = [
	{ prefix: 'protocol/tvl', hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.tvl) },
	{
		prefix: 'protocol/rwa',
		hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.rwaPlatformSlug)
	},
	{
		prefix: 'protocol/stablecoins',
		hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.stablecoins)
	},
	{ prefix: 'protocol/bridges', hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.bridge) },
	{
		prefix: 'protocol/treasury',
		hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.treasury)
	},
	{ prefix: 'protocol/yields', hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.yields) },
	{ prefix: 'protocol/fees', hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.fees) },
	{ prefix: 'protocol/dexs', hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.dexs) },
	{ prefix: 'protocol/perps', hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.perps) },
	{
		prefix: 'protocol/dex-aggregators',
		hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.dexAggregators)
	},
	{
		prefix: 'protocol/perps-aggregators',
		hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.perpsAggregators)
	},
	{
		prefix: 'protocol/bridge-aggregators',
		hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.bridgeAggregators)
	},
	{
		prefix: 'protocol/options',
		hasMetric: (meta: MetadataCache['protocolMetadata'][string]) =>
			Boolean(meta.optionsPremiumVolume || meta.optionsNotionalVolume)
	},
	{
		prefix: 'protocol/token-rights',
		hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.tokenRights)
	},
	{
		prefix: 'protocol/unlocks',
		hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.emissions)
	},
	{ prefix: 'protocol/forks', hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => Boolean(meta.forks) }
]

const standaloneProtocolRoutes: Array<{
	prefix: 'unlocks' | 'forks'
	hasMetric: (meta: MetadataCache['protocolMetadata'][string]) => boolean
}> = [
	{ prefix: 'unlocks', hasMetric: (meta) => Boolean(meta.emissions) },
	{ prefix: 'forks', hasMetric: (meta) => Boolean(meta.forks) }
]

export function getProtocolSlug(metadata: IProtocolMetadata, protocolId: string): string {
	return slug(metadata.displayName || metadata.name || protocolId)
}

export function resolveProtocolParamFromMetadata(protocol: string, metadataCache: MetadataCache): ProtocolRoute | null {
	const normalizedProtocol = slug(protocol)
	if (!normalizedProtocol || normalizedProtocol === 'null' || normalizedProtocol === 'undefined') return null

	const protocolId = metadataCache.protocolRouteIdBySlug[normalizedProtocol]
	if (!protocolId) return null

	const metadata = metadataCache.protocolMetadata[protocolId]
	if (!metadata) return null
	return {
		id: protocolId,
		metadata,
		canonicalSlug: getProtocolSlug(metadata, protocolId)
	}
}

export function resolveProtocolFeatureRouteFromMetadata({
	cexRoutePrefix,
	hasMetric,
	metadataCache,
	protocol,
	routePrefix,
	rwaPlatformRedirect = false
}: {
	cexRoutePrefix?: string
	hasMetric: (metadata: IProtocolMetadata) => boolean
	metadataCache: MetadataCache
	protocol: string
	routePrefix: string
	rwaPlatformRedirect?: boolean
}): ProtocolFeatureRouteResolution | null {
	if (cexRoutePrefix) {
		const cexRoute = resolveCexParamFromMetadata(protocol, metadataCache)
		if (cexRoute) {
			return {
				type: 'redirect',
				destination: `/${cexRoutePrefix}/${cexRoute.canonicalSlug}`
			}
		}
	}

	const protocolRoute = resolveProtocolParamFromMetadata(protocol, metadataCache)
	if (!protocolRoute) return null

	if (!hasMetric(protocolRoute.metadata)) {
		// Retiring the TVL adapter (module: dummy.js) drops the metric, which would 404 every
		// existing link. An RWA platform still has a page, so send them there instead.
		const platformSlug = rwaPlatformRedirect ? protocolRoute.metadata.rwaPlatformSlug : null
		return platformSlug ? { type: 'redirect', destination: `/rwa/platform/${platformSlug}` } : null
	}

	if (protocol !== protocolRoute.canonicalSlug) {
		return {
			type: 'redirect',
			destination: `/${routePrefix}/${protocolRoute.canonicalSlug}`
		}
	}

	return {
		type: 'route',
		route: protocolRoute
	}
}

export async function resolveProtocolParam(protocol: string): Promise<ProtocolRoute | null> {
	return resolveProtocolParamFromMetadata(protocol, await getMetadataCache())
}

export function getProtocolOverviewSlugsFromMetadata(metadataCache: MetadataCache, limit: number): Array<string> {
	const slugs = new Set<string>()

	for (const protocolId in metadataCache.protocolMetadata) {
		const metadata = metadataCache.protocolMetadata[protocolId]
		if (!metadata) continue
		if (!isProtocolRouteMetadata(metadata)) continue
		if (EXCLUDED_OVERVIEW_CATEGORIES.has(metadata.category ?? '')) continue

		const name = metadata.displayName || metadata.name
		if (!name) continue
		const protocolSlug = slug(name)

		if (String(name).startsWith('Uniswap')) {
			slugs.add(protocolSlug)
			if (slugs.size >= limit) break
		}

		const canonicalSlug = metadata.parentProtocol
			? slug(metadata.parentProtocol.replace('parent#', '')) || protocolSlug
			: protocolSlug
		slugs.add(canonicalSlug)

		if (slugs.size >= limit) break
	}

	return [...slugs].slice(0, limit)
}

export async function getProtocolOverviewStaticPaths(limit = 35): Promise<Array<string>> {
	const metadataCache = await getMetadataCache()
	return getProtocolOverviewSlugsFromMetadata(metadataCache, limit).map((protocolSlug) => `/protocol/${protocolSlug}`)
}

export function getProtocolFeatureSlugsFromMetadata(
	metadataCache: MetadataCache,
	hasMetric: (metadata: IProtocolMetadata) => boolean
): Array<string> {
	const slugs = new Set<string>()

	for (const protocolId in metadataCache.protocolMetadata) {
		const metadata = metadataCache.protocolMetadata[protocolId]
		if (!metadata) continue
		if (!isProtocolRouteMetadata(metadata)) continue
		if (!hasMetric(metadata)) continue

		slugs.add(getProtocolSlug(metadata, protocolId))
	}

	return [...slugs]
}

export function getProtocolMetricSlugsFromMetadata(
	metadataCache: MetadataCache,
	metric: ProtocolMetric
): Array<string> {
	return getProtocolFeatureSlugsFromMetadata(metadataCache, (metadata) => Boolean(metadata[metric]))
}

export function getProtocolSitemapRoutes(metadataCache: MetadataCache): Array<string> {
	const routes: Array<string> = []

	for (const protocolId in metadataCache.protocolMetadata) {
		const metadata = metadataCache.protocolMetadata[protocolId]
		if (!metadata) continue
		if (!isProtocolRouteMetadata(metadata)) continue
		if (!metadata.displayName && !metadata.name) continue
		const protocolSlug = getProtocolSlug(metadata, protocolId)

		routes.push(`protocol/${protocolSlug}`)
	}

	for (const routeDef of protocolTabRoutes) {
		for (const protocolSlug of getProtocolFeatureSlugsFromMetadata(metadataCache, routeDef.hasMetric)) {
			routes.push(`${routeDef.prefix}/${protocolSlug}`)
		}
	}

	return routes
}

export function getStandaloneProtocolSitemapRoutes(
	metadataCache: MetadataCache
): Record<'unlocks' | 'forks', Array<string>> {
	const routes = {
		unlocks: [] as Array<string>,
		forks: [] as Array<string>
	}

	for (const routeDef of standaloneProtocolRoutes) {
		for (const protocolSlug of getProtocolFeatureSlugsFromMetadata(metadataCache, routeDef.hasMetric)) {
			routes[routeDef.prefix].push(`${routeDef.prefix}/${protocolSlug}`)
		}
	}

	for (const protocolSlug of metadataCache.emissionsProtocolsList) {
		routes.unlocks.push(`unlocks/${protocolSlug}`)
	}

	return routes
}
