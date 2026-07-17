import { resolveExchangeByDefillamaCexSlug, type CexExchangeSlugIndex } from '~/containers/Markets/server/dataset.index'
import { fetchCexExchangeSlugIndex } from '~/containers/Markets/server/dataset.server'
import { getMetadataCache, type StaticParamPath } from '~/server/routeRegistry/common'
import { slug } from '~/utils'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import type { ICexItem, IProtocolMetadata } from '~/utils/metadata/types'

export type CexRoute = {
	id: string
	metadata: IProtocolMetadata
	cexMetadata?: ICexItem
	canonicalSlug: string
}

export function resolveCexParamFromMetadata(cex: string, metadataCache: MetadataCache): CexRoute | null {
	const normalizedCex = slug(cex)
	if (!normalizedCex) return null

	const protocolId = metadataCache.cexRouteIdBySlug[normalizedCex]
	if (!protocolId) return null

	const metadata = metadataCache.protocolMetadata[protocolId]
	const canonicalSlug = slug(metadata.name)
	return {
		id: protocolId,
		metadata,
		cexMetadata: metadataCache.cexMetadataBySlug[canonicalSlug],
		canonicalSlug
	}
}

export function getCanonicalCexSlugsFromMetadata(metadataCache: MetadataCache): string[] {
	const slugs = new Set<string>()
	for (const protocolId in metadataCache.protocolMetadata) {
		const metadata = metadataCache.protocolMetadata[protocolId]
		if (!metadata.cex || !metadata.name) continue
		slugs.add(slug(metadata.name))
	}
	return [...slugs]
}

export async function getCexStaticPaths(limit = 10): Promise<Array<StaticParamPath<'cex'>>> {
	return getCanonicalCexSlugsFromMetadata(await getMetadataCache())
		.slice(0, limit)
		.map((cex) => ({ params: { cex } }))
}

export async function getCexSitemapRoutes(metadataCache: MetadataCache): Promise<string[]> {
	const routes = new Set<string>()
	const cexSlugs = getCanonicalCexSlugsFromMetadata(metadataCache)

	let cexIndex: CexExchangeSlugIndex | null = null
	try {
		cexIndex = await fetchCexExchangeSlugIndex()
	} catch (error) {
		console.warn('[sitemap] cex exchange index unavailable; keeping all /cex routes', error)
	}

	for (const cexSlug of cexSlugs) {
		// Venues mapped to an exchange profile redirect to /exchange/:slug — a
		// sitemap must not advertise redirecting URLs.
		if (cexIndex && resolveExchangeByDefillamaCexSlug(cexIndex, cexSlug)) continue
		routes.add(`cex/${cexSlug}`)
		routes.add(`cex/assets/${cexSlug}`)
		routes.add(`cex/stablecoins/${cexSlug}`)
	}

	return [...routes]
}
