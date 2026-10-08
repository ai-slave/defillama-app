import { appendUnknownRwaAssetGroup, normalizeRwaAssetGroup } from '~/containers/RWA/assetGroup'
import { getRwaPerpsOnlyPlatformSlugs, getRWAPlatformRoutes } from '~/containers/RWA/platformRoutes'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

export function getRWASitemapRoutes(metadataCache: MetadataCache): Array<string> {
	const routes: Array<string> = []
	const { rwaList, rwaPerpsList } = metadataCache

	for (const canonicalMarketId of rwaList.canonicalMarketIds) {
		routes.push(`rwa/asset/${encodeURIComponent(canonicalMarketId)}`)
	}
	// A sitemap lists final addresses: a platform that redirects to its venue page is listed as the venue.
	const redirecting = getRwaPerpsOnlyPlatformSlugs(metadataCache)
	for (const platform of getRWAPlatformRoutes(rwaList)) {
		if (!redirecting.has(platform.slug)) routes.push(`rwa/platform/${platform.slug}`)
	}
	for (const chain of rwaList.chains) {
		routes.push(`rwa/chain/${rwaSlug(chain)}`)
	}
	for (const category of rwaList.categories) {
		const categorySlug = rwaSlug(category)
		if (categorySlug !== 'rwa-perps') routes.push(`rwa/category/${categorySlug}`)
	}
	for (const assetGroup of appendUnknownRwaAssetGroup(rwaList.assetGroups)) {
		routes.push(`rwa/asset-group/${rwaSlug(normalizeRwaAssetGroup(assetGroup))}`)
	}

	for (const contract of rwaPerpsList.contracts) {
		routes.push(`rwa/perps/contract/${encodeURIComponent(contract)}`)
	}
	for (const venue of rwaPerpsList.venues) {
		routes.push(`rwa/perps/venue/${rwaSlug(venue)}`)
	}
	for (const assetGroup of rwaPerpsList.assetGroups) {
		routes.push(`rwa/perps/asset-group/${rwaSlug(assetGroup)}`)
	}
	for (const asset of rwaPerpsList.assets) {
		routes.push(`rwa/perps/asset/${rwaSlug(asset)}`)
	}

	return routes
}
