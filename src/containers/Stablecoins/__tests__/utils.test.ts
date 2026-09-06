import { describe, expect, test } from 'vitest'
import { sumStablecoinPegBalances } from '../utils'

describe('sumStablecoinPegBalances', () => {
	test('sums the finite peg balance map', () => {
		expect(sumStablecoinPegBalances({ peggedUSD: 100, peggedEUR: 25, peggedJPY: 5 })).toBe(130)
	})

	test('keeps explicit zero and accepts a sparse balance map', () => {
		expect(sumStablecoinPegBalances({ peggedUSD: 0 })).toBe(0)
		expect(sumStablecoinPegBalances({})).toBe(0)
	})

	test('treats a producer-pruned historical balance as zero', () => {
		expect(sumStablecoinPegBalances(undefined)).toBe(0)
	})
})
