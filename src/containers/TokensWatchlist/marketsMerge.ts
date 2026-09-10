import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import type { TokensTableRow } from '~/containers/Tokens/types'
import { formatUsd } from '~/utils/numberFormat'

type MarketsListEntry = TokenMarketsListResponse['tokens'][number]

// Mirrors the server-side sumSegments: perps metrics are the sum of the linear + inverse perp segments.
function sumPerpSegments(entry: MarketsListEntry, key: 'volume_24h' | 'oi_usd'): number | null {
	let total = 0
	let hasValue = false
	const linear = entry.segments.linear_perp?.[key]
	const inverse = entry.segments.inverse_perp?.[key]
	if (linear != null) {
		total += linear
		hasValue = true
	}
	if (inverse != null) {
		total += inverse
		hasValue = true
	}
	return hasValue ? total : null
}

/**
 * The shared /api/public/tokens dataset intentionally drops markets for symbols used by more than one coin
 * (so one symbol's metrics don't smear across duplicates), which leaves mega-cap rows like BTC/ETH with empty
 * Spot/Perps/OI. This fills only those gaps — client-side, watchlist-only, so /tokens is untouched — by
 * attaching the symbol-keyed markets summary to the highest-market-cap saved coin per symbol. Values the
 * server already computed (unique-symbol coins) are never overwritten.
 */
export function mergeMarketsSummary(
	baseRows: Array<TokensTableRow>,
	marketsList: TokenMarketsListResponse | undefined
): Array<TokensTableRow> {
	if (!marketsList || baseRows.length === 0) return baseRows

	const entryBySymbol = new Map<string, MarketsListEntry>()
	for (const entry of marketsList.tokens) entryBySymbol.set(entry.symbol.toUpperCase(), entry)

	const canonicalIdBySymbol = new Map<string, string>()
	const bestBySymbol = new Map<string, { marketCap: number; rank: number }>()
	for (const row of baseRows) {
		const symbol = row.symbol.toUpperCase()
		const marketCap = row.marketCap ?? -1
		const rank = row.rank ?? Number.POSITIVE_INFINITY
		const best = bestBySymbol.get(symbol)
		if (!best || marketCap > best.marketCap || (marketCap === best.marketCap && rank < best.rank)) {
			bestBySymbol.set(symbol, { marketCap, rank })
			canonicalIdBySymbol.set(symbol, row.id)
		}
	}

	return baseRows.map((row) => {
		const symbol = row.symbol.toUpperCase()
		if (canonicalIdBySymbol.get(symbol) !== row.id) return row
		const entry = entryBySymbol.get(symbol)
		if (!entry) return row

		const spotVolume24h = row.spotVolume24h ?? entry.segments.spot?.volume_24h ?? null
		const perpsVolume24h = row.perpsVolume24h ?? sumPerpSegments(entry, 'volume_24h')
		const openInterest24h = row.openInterest24h ?? sumPerpSegments(entry, 'oi_usd')

		if (
			spotVolume24h === row.spotVolume24h &&
			perpsVolume24h === row.perpsVolume24h &&
			openInterest24h === row.openInterest24h
		) {
			return row
		}

		return {
			...row,
			spotVolume24h,
			perpsVolume24h,
			openInterest24h,
			display: {
				...row.display,
				spotVolume24h: formatUsd(spotVolume24h, { compact: true }),
				perpsVolume24h: formatUsd(perpsVolume24h, { compact: true }),
				openInterest24h: formatUsd(openInterest24h, { compact: true })
			}
		}
	})
}
