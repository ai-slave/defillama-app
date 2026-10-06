import { slug } from '~/utils'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

export function resolveBridgeProtocolParamFromMetadata(bridge: string, metadataCache: MetadataCache): string | null {
	const bridgeSlug = slug(bridge)
	if (!bridgeSlug) return null
	return metadataCache.bridgeProtocolSlugsSet.has(bridgeSlug) ? bridgeSlug : null
}
export function getBridgeSitemapRoutes(metadataCache: MetadataCache): Array<string> {
	const routes: Array<string> = []

	for (const bridgeSlug of metadataCache.bridgeProtocolSlugs) {
		routes.push(`bridge/${bridgeSlug}`)
	}
	for (const chainSlug of metadataCache.bridgeChainSlugs) {
		routes.push(`bridges/${chainSlug}`)
	}

	return routes
}
