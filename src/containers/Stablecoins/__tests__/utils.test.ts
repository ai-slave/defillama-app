import { describe, expect, it } from 'vitest'
import { sumStablecoinPegBalances } from '../utils'

describe('sumStablecoinPegBalances', () => {
	it('sums the finite peg balance map', () => {
		expect(sumStablecoinPegBalances({ peggedUSD: 100, peggedEUR: 25, peggedJPY: 5 })).toBe(130)
	})

	it('keeps explicit zero and accepts a sparse balance map', () => {
		expect(sumStablecoinPegBalances({ peggedUSD: 0 })).toBe(0)
		expect(sumStablecoinPegBalances({})).toBe(0)
	})

	it('treats a producer-pruned historical balance as zero', () => {
		expect(sumStablecoinPegBalances(undefined)).toBe(0)
	})
})
