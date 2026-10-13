import { resolveExchangeByDefillamaCexSlug, type CexExchangeSlugIndex } from '~/containers/Markets/server/dataset.index'
import type { CexReservesRow, ICex } from './types'

/** Market columns use only the exchanges directory, so a CEX with no venue shows none
 *  rather than mixing in CoinGecko-reported volume measured another way. */
export function attachExchangeMarkets(cexs: Array<CexReservesRow>, index: CexExchangeSlugIndex): Array<ICex> {
	const result: Array<ICex> = []
	for (const cex of cexs) {
		const exchange = cex.cexProtocolSlug ? resolveExchangeByDefillamaCexSlug(index, cex.cexProtocolSlug) : null
		const oi = exchange?.usd_perp_oi_usd ?? null
		result.push({
			...cex,
			exchange,
			leverage: oi != null && cex.cleanAssetsTvl ? oi / cex.cleanAssetsTvl : null
		})
	}
	return result
}
