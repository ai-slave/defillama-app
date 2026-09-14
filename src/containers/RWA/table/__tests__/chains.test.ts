import { describe, expect, test } from 'vitest'
import { getChainShares, mergeBreakdowns } from '../chains'

describe('getChainShares', () => {
	test('keeps every chain with value, ordered by value, with its share', () => {
		expect(
			getChainShares([
				['Mantle', 5000],
				['Ethereum', 700_000],
				['Solana', 295_000]
			])
		).toEqual([
			{ chain: 'Ethereum', value: 700_000, share: 0.7 },
			{ chain: 'Solana', value: 295_000, share: 0.295 },
			{ chain: 'Mantle', value: 5000, share: 0.005 }
		])
	})

	test('drops chains with no value', () => {
		expect(
			getChainShares([
				['Ethereum', 90_000],
				['Base', 0]
			])
		).toEqual([{ chain: 'Ethereum', value: 90_000, share: 1 }])
	})

	test('returns nothing for a missing, empty or unpriced breakdown', () => {
		expect(getChainShares(null)).toEqual([])
		expect(getChainShares([])).toEqual([])
		expect(getChainShares([['Ethereum', 0]])).toEqual([])
	})
})

describe('mergeBreakdowns', () => {
	test('sums entries by chain across lists and skips missing lists', () => {
		expect(
			mergeBreakdowns([
				[
					['Ethereum', 10],
					['Solana', 5]
				],
				null,
				[['Ethereum', 2]]
			])
		).toEqual([
			['Ethereum', 12],
			['Solana', 5]
		])
	})
})
