import { describe, expect, test } from 'vitest'
import { attachExchangeProfileSlugs } from '../exchangeProfile'
import type { ICex } from '../types'

const cex: ICex = {
	name: 'Binance',
	cexProtocolSlug: 'binance-cex',
	tokensToExclude: ['BNB'],
	currentTvl: 1,
	cleanAssetsTvl: 1,
	inflows_24h: 0,
	inflows_1w: 0,
	inflows_1m: 0,
	spotVolume: null,
	oi: null,
	derivVolume: null,
	leverage: null
}

describe('CEX Exchange profile identity', () => {
	test('keeps the CEX protocol key separate from its Exchange profile slug', () => {
		const [result] = attachExchangeProfileSlugs([cex], {
			'binance-cex': { exchange: 'binance', defillama_slug: 'binance-cex' }
		})

		expect(result).toMatchObject({ cexProtocolSlug: 'binance-cex', exchangeProfileSlug: 'binance' })
	})

	test('leaves a CEX without an Exchange profile unchanged', () => {
		const [result] = attachExchangeProfileSlugs([cex], {})

		expect(result).toBe(cex)
	})
})
