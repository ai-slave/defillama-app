import { fetchExchangeMarketsList } from '~/containers/Markets/server/dataset.server'
import { slug } from '~/utils'

export async function getCexMarketSlugsFromSnapshot(): Promise<string[]> {
	const marketsList = await fetchExchangeMarketsList()
	const marketCexSlugs = new Set<string>()

	for (const marketType in marketsList.cex) {
		const entries = marketsList.cex[marketType]
		for (const entry of entries) {
			const cexSlug = slug(entry.defillama_slug ?? '')
			if (cexSlug) marketCexSlugs.add(cexSlug)
		}
	}

	return [...marketCexSlugs]
}
