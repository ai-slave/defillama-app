import { describe, expect, it } from 'vitest'
import { formatPairPrice, pairDepthTotal } from '../PairTable'

describe('formatPairPrice', () => {
	it('keeps raw pair prices in their quote asset instead of presenting them as USD', () => {
		expect(formatPairPrice(1.25, 'eur')).toBe('1.25 EUR')
		expect(formatPairPrice(null, 'usdt')).toBe('–')
	})
})

describe('pair depth totals', () => {
	it('preserves missing, one-sided observed, and observed-zero depth', () => {
		expect(pairDepthTotal(null, null)).toBeNull()
		expect(pairDepthTotal(25, null)).toBe(25)
		expect(pairDepthTotal(null, 0)).toBe(0)
		expect(pairDepthTotal(0, 0)).toBe(0)
	})
})
