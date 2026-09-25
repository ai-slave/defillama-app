import { describe, expect, test } from 'vitest'
import { computeFinalTVL } from '../helpers'

describe('computeFinalTVL', () => {
	test('adds enabled protocol overview TVL suffix extras while preserving chain hyphen suffixes', () => {
		const result = computeFinalTVL(
			{
				Ethereum: 100,
				'Arbitrum-staking': 20,
				'Base-pool2': 30,
				'OP-Mainnet': 7,
				borrowed: 9
			},
			null,
			{ staking: true, pool2: true, borrowed: false }
		)

		expect(result.tvl).toBe(157)
		expect(result.tvlByChain).toEqual([
			['Ethereum', 100],
			['Base', 30],
			['Arbitrum', 20],
			['OP-Mainnet', 7]
		])
		expect(result.toggleOptions.map((option) => option.key)).toEqual(['staking', 'pool2', 'borrowed'])
	})

	test('keeps disabled protocol overview TVL extras out of totals but exposes their toggle options', () => {
		const result = computeFinalTVL(
			{
				Ethereum: 100,
				'Ethereum-staking': 20,
				borrowed: 9
			},
			null,
			{ staking: false, borrowed: false }
		)

		expect(result.tvl).toBe(100)
		expect(result.tvlByChain).toEqual([['Ethereum', 100]])
		expect(result.toggleOptions.map((option) => option.key)).toEqual(['staking', 'borrowed'])
	})

	test('does not expose or aggregate chain-only TVL settings on protocol surfaces', () => {
		const result = computeFinalTVL(
			{
				Ethereum: 100,
				'Ethereum-doublecounted': 20,
				'Base-liquidstaking': 30,
				govtokens: 40
			},
			null,
			{ doublecounted: true, liquidstaking: true, govtokens: true }
		)

		expect(result.tvl).toBe(100)
		expect(result.tvlByChain).toEqual([['Ethereum', 100]])
		expect(result.toggleOptions).toEqual([])
	})

	test('applies TVL toggles to oracle TVS aggregation', () => {
		const result = computeFinalTVL(
			null,
			{
				Ethereum: 200,
				'Ethereum-staking': 30,
				'Ethereum-pool2': 40
			},
			{ staking: true, pool2: false }
		)

		expect(result.oracleTvs).toBe(230)
		expect(result.oracleTvsByChain).toEqual([['Ethereum', 230]])
		expect(result.toggleOptions.map((option) => option.key)).toEqual(['staking', 'pool2'])
	})
})
