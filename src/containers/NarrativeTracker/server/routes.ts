import { getMetadataCache, type StaticParamPath } from '~/server/routeRegistry/common'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

function dedupeSlugs(slugs: Array<string>): Array<string> {
	return [...new Set(slugs)]
}

export async function getNarrativeCategoryStaticPaths(): Promise<Array<StaticParamPath<'category'>>> {
	const metadataCache = await getMetadataCache()
	return dedupeSlugs(metadataCache.narrativeCategories.ids).map((category) => ({ params: { category } }))
}

export function getNarrativeSitemapRoutes(metadataCache: MetadataCache): Array<string> {
	const routes: Array<string> = []

	for (const categoryId of metadataCache.narrativeCategories.ids) {
		routes.push(`narrative-tracker/${categoryId}`)
	}

	return routes
}
