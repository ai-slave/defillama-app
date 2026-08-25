import { resolveExchangeByDefillamaCexSlug, type CexExchangeSlugIndex } from '~/containers/Markets/server/dataset.index'
import type { ICex } from './types'

export function attachExchangeProfileSlugs(cexs: ICex[], index: CexExchangeSlugIndex): ICex[] {
	const result: ICex[] = []
	for (const cex of cexs) {
		if (!cex.cexProtocolSlug) {
			result.push(cex)
			continue
		}
		const exchange = resolveExchangeByDefillamaCexSlug(index, cex.cexProtocolSlug)
		result.push(exchange ? { ...cex, exchangeProfileSlug: exchange.exchange } : cex)
	}
	return result
}
