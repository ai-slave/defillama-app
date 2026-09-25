import { describe, expect, test } from 'vitest'
import { buildTokenUsageRows, filterTokenUsageRows } from '../TokenUsageSection.utils'

describe('TokenUsageSection helpers', () => {
	test('builds table rows by summing usage amounts', () => {
		expect(
			buildTokenUsageRows([
				{
					name: 'Aave',
					category: 'Lending',
					amountUsd: { ethereum: 100, base: 25 },
					logo: 'https://example.com/aave.png',
					slug: 'aave'
				}
			])
		).toEqual([
			{
				name: 'Aave',
				category: 'Lending',
				amountUsd: 125,
				logo: 'https://example.com/aave.png',
				slug: 'aave',
				misrepresentedTokens: undefined
			}
		])
	})

	test('drops misrepresented rows and optional CEX rows from the table data', () => {
		expect(
			filterTokenUsageRows(
				[
					{ name: 'Aave', category: 'Lending', amountUsd: 1 },
					{ name: 'Binance', category: 'CEX', amountUsd: 2 },
					{ name: 'Bad Row', category: 'DEX', amountUsd: 3, misrepresentedTokens: true }
				],
				false
			)
		).toEqual([{ name: 'Aave', category: 'Lending', amountUsd: 1 }])
	})
})
