import { describe, expect, test } from 'vitest'
import { chainsIntro } from '../lead'

const DATE = Date.UTC(2026, 9, 14) / 1000

describe('chainsIntro', () => {
	test('names the three largest chains on the page date', () => {
		expect(
			chainsIntro(DATE, [
				{ name: 'Solana', tvl: 6e9 },
				{ name: 'Base', tvl: 6.2e9 },
				{ name: 'Ethereum', tvl: 51.2e9 },
				{ name: 'Missing', tvl: null }
			])
		).toBe(
			'Total value locked (TVL) is the dollar value of crypto deposited in DeFi protocols. On Oct 14, 2026 Ethereum led with $51.2b, ahead of Base at $6.2b and Solana at $6b.'
		)
	})

	test('keeps the definition when fewer than three chains have TVL', () => {
		expect(chainsIntro(DATE, [{ name: 'Ethereum', tvl: 1 }])).toBe(
			'Total value locked (TVL) is the dollar value of crypto deposited in DeFi protocols.'
		)
	})
})
