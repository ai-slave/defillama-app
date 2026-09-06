import { describe, expect, test } from 'vitest'
import { isCanonicalExchangeSlug } from '../slugs'

describe('canonical exchange slug grammar', () => {
	test.each(['binance', 'bybit-eu', 'crypto-com', 'trading-212'])('accepts %s', (slug) => {
		expect(isCanonicalExchangeSlug(slug)).toBe(true)
	})

	test.each(['Coinbase-EU', 'coinbase_eu', 'coinbase.eu', '-coinbase', 'coinbase-', 'coinbase--eu', ''])(
		'rejects %s',
		(slug) => {
			expect(isCanonicalExchangeSlug(slug)).toBe(false)
		}
	)
})
