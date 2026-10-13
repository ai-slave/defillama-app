import { describe, expect, test } from 'vitest'
import type { CexExchangeSlugIndexEntry } from '~/containers/Markets/server/dataset.index'
import { attachExchangeMarkets } from '../exchangeMarkets'
import type { CexReservesRow } from '../types'

const cex: CexReservesRow = {
	name: 'Binance',
	cexProtocolSlug: 'binance-cex',
	tokensToExclude: ['BNB'],
	currentTvl: 1,
	cleanAssetsTvl: 1000,
	inflows_24h: 0,
	inflows_1w: 0,
	inflows_1m: 0
}

function venue(exchange: string, patch: Partial<CexExchangeSlugIndexEntry> = {}): CexExchangeSlugIndexEntry {
	return {
		exchange,
		defillama_slug: exchange,
		rank: null,
		spot_volume_24h: null,
		usd_perp_volume_24h: null,
		usd_perp_oi_usd: null,
		volume_7d: [],
		...patch
	}
}

describe('CEX exchange markets', () => {
	test('attaches the mapped exchange venue and values leverage as USD perp OI over clean assets', () => {
		const binance = venue('binance', { usd_perp_oi_usd: 250 })
		const gemini = venue('gemini')
		const result = attachExchangeMarkets([cex, { ...cex, name: 'Gemini', cexProtocolSlug: 'gemini' }], {
			'binance-cex': binance,
			gemini
		})

		expect(result).toMatchObject([
			{ exchange: binance, leverage: 0.25 },
			// A spot-only venue has no leverage, not 0x.
			{ exchange: gemini, leverage: null }
		])
	})

	test('shows no market figures for a CEX without an exchange venue', () => {
		const [result] = attachExchangeMarkets([cex], {})

		expect(result).toStrictEqual({ ...cex, exchange: null, leverage: null })
	})
})
