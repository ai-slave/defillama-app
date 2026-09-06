import { getMetadataCache, type StaticParamPath } from '~/server/routeRegistry/common'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

function dedupeSlugs(slugs: Array<string>): Array<string> {
	return [...new Set(slugs)]
}

export async function getDATCompanyStaticPaths(): Promise<Array<StaticParamPath<'company'>>> {
	const metadataCache = await getMetadataCache()
	return dedupeSlugs(metadataCache.digitalAssetTreasuryRoutes.companySlugs)
		.slice(0, 10)
		.map((company) => ({ params: { company } }))
}

export async function getDATAssetStaticPaths(): Promise<Array<StaticParamPath<'asset'>>> {
	const metadataCache = await getMetadataCache()
	return dedupeSlugs(metadataCache.digitalAssetTreasuryRoutes.assetSlugs)
		.slice(0, 10)
		.map((asset) => ({ params: { asset } }))
}

export function getDATSitemapRoutes(metadataCache: MetadataCache): Array<string> {
	const routes: Array<string> = []

	for (const companySlug of metadataCache.digitalAssetTreasuryRoutes.companySlugs) {
		routes.push(`digital-asset-treasury/${companySlug}`)
	}
	for (const assetSlug of metadataCache.digitalAssetTreasuryRoutes.assetSlugs) {
		routes.push(`digital-asset-treasuries/${assetSlug}`)
	}

	return routes
}
