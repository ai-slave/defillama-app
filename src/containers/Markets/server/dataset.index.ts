import type { MasterDirectoryResponse, MasterVenueRank } from '~/containers/Exchanges/master.types'
import { sumSparks } from '~/containers/Exchanges/modelHelpers'
import type { TokenExchangeListingsResponse, TokenMarketSummary } from '~/containers/Markets/api.types'
import { slug } from '~/utils'

export type TokenMarketsGeckoIdIndex = Record<string, true>
export type CexExchangeSlugIndexEntry = {
	exchange: string
	defillama_slug: string
	/** REAL score, tier and pillars; null for a venue not scored yet. */
	rank: MasterVenueRank | null
	spot_volume_24h: number | null
	usd_perp_volume_24h: number | null
	usd_perp_oi_usd: number | null
	/** Spot plus USD perp daily volume for the last 7 days, oldest first. */
	volume_7d: Array<number>
}
export type CexExchangeSlugIndex = Record<string, CexExchangeSlugIndexEntry>

export function buildTokenMarketsGeckoIdIndex(listings: TokenExchangeListingsResponse): TokenMarketsGeckoIdIndex {
	const index = Object.create(null) as TokenMarketsGeckoIdIndex
	for (const token of listings.tokens) index[token.coingecko_id.toLowerCase()] = true
	return index
}

/** DefiLlama slug (cex or protocol page) → exchange profile slug plus the venue's REAL
 *  tier and market figures `/cexs` shows, so that page never reads the full directory. Regional arms
 *  (`secondary`) never win the key; the first primary venue for a slug does. Perp volume
 *  and OI are the USD perp class only, as on `/exchanges`; COIN perps are never folded in. */
export function buildCexExchangeSlugIndex(directory: MasterDirectoryResponse): CexExchangeSlugIndex {
	const index = Object.create(null) as CexExchangeSlugIndex
	for (const venue of directory.venues) {
		const defillama = venue.links.defillama
		if (!defillama || venue.secondary) continue
		const key = slug(defillama.slug)
		if (Object.hasOwn(index, key)) continue
		index[key] = {
			exchange: venue.slug,
			defillama_slug: defillama.slug,
			rank: venue.rank,
			spot_volume_24h: venue.segments.spot?.volume_24h ?? null,
			usd_perp_volume_24h: venue.segments.linear_perp?.volume_24h ?? null,
			usd_perp_oi_usd: venue.segments.linear_perp?.oi_usd ?? null,
			volume_7d: sumSparks(venue.sparks.spot ?? [], venue.sparks.linear_perp ?? []).slice(-7)
		}
	}
	return index
}

export function resolveExchangeByDefillamaCexSlug(
	index: CexExchangeSlugIndex,
	defillamaSlug: string
): CexExchangeSlugIndexEntry | null {
	const key = slug(defillamaSlug)
	return Object.hasOwn(index, key) ? (index[key] ?? null) : null
}

export function hasTokenMarketsGeckoId(index: TokenMarketsGeckoIdIndex, geckoId: string): boolean {
	return Object.hasOwn(index, geckoId.toLowerCase())
}

export function buildTokenMarketSummaries(listings: TokenExchangeListingsResponse): Record<string, TokenMarketSummary> {
	const index: Record<string, TokenMarketSummary> = Object.create(null)
	for (const token of listings.tokens) {
		if (token.summary) index[token.coingecko_id.toLowerCase()] = token.summary
	}
	return index
}
