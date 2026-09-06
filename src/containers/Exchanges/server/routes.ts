import { fetchExchangeDirectory } from '~/containers/Markets/server/dataset.server'

/**
 * Exchange profile routes for the sitemap. Listing pages (/exchanges, /cexs,
 * /exchanges/charts, /mica) are covered by the static nav section.
 */
export async function getExchangeSitemapRoutes(): Promise<Array<string>> {
	const routes = new Set<string>()
	const directory = await fetchExchangeDirectory()
	for (const venue of directory.venues) {
		routes.add(`exchange/${venue.slug}`)
	}
	return [...routes]
}
