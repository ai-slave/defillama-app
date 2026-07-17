import type { MasterDirectoryResponse } from '~/containers/Exchanges/master.types'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import { slug } from '~/utils'

export type TokenMarketsSymbolIndex = Record<string, true>
export type CexExchangeSlugIndexEntry = { exchange: string; defillama_slug: string }
export type CexExchangeSlugIndex = Record<string, CexExchangeSlugIndexEntry>

export function buildTokenMarketsSymbolIndex(tokensList: TokenMarketsListResponse): TokenMarketsSymbolIndex {
	const index = Object.create(null) as TokenMarketsSymbolIndex
	for (const token of tokensList.tokens) index[token.symbol.toLowerCase()] = true
	return index
}

export function buildCexExchangeSlugIndex(directory: MasterDirectoryResponse): CexExchangeSlugIndex {
	const index = Object.create(null) as CexExchangeSlugIndex
	for (const venue of directory.venues) {
		const defillama = venue.links.defillama
		if (venue.type !== 'cex' || !defillama || defillama.type !== 'cex') continue
		const key = slug(defillama.slug)
		index[key] = { exchange: venue.slug, defillama_slug: defillama.slug }
	}
	return index
}

export function resolveExchangeByDefillamaCexSlug(
	index: CexExchangeSlugIndex,
	defillamaSlug: string
): CexExchangeSlugIndexEntry | null {
	const key = slug(defillamaSlug)
	return Object.hasOwn(index, key) ? index[key] : null
}

export function hasTokenMarketsSymbol(index: TokenMarketsSymbolIndex, symbol: string): boolean {
	return Object.hasOwn(index, symbol.toLowerCase())
}
