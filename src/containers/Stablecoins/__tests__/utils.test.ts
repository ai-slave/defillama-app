import { describe, expect, test } from 'vitest'
import { sumStablecoinPegBalances } from '../utils'

describe('sumStablecoinPegBalances', () => {
	test('sums the finite peg balance map', () => {
		expect(sumStablecoinPegBalances({ peggedUSD: 100, peggedEUR: 25, peggedJPY: 5 })).toBe(130)
	})
})
