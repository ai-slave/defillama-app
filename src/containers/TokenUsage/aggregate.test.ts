import { describe, expect, it } from 'vitest'
import { aggregateProtocolTokenUsage } from './aggregate'

describe('aggregateProtocolTokenUsage', () => {
	it('aggregates chain values and repeated protocol rows without allocating chain breakdowns', () => {
		const result = aggregateProtocolTokenUsage(
			[
				{
					symbol: 'USDC',
					data: [
						{ name: 'Aave', category: 'Lending', amountUsd: { Ethereum: 10, Base: 2 } },
						{ name: 'Aave', category: 'Lending', amountUsd: { Arbitrum: 3 } }
					]
				},
				{
					symbol: 'USDT',
					data: [{ name: 'Aave', category: 'Lending', amountUsd: { Ethereum: 5 } }]
				}
			],
			false
		)

		expect(result).toEqual([
			{
				name: 'Aave',
				category: 'Lending',
				amountUsd: 20,
				logo: undefined,
				tokens: { USDC: 15, USDT: 5 }
			}
		])
		expect(result[0]).not.toHaveProperty('amountUsdByChain')
	})

	it('skips misleading token data and filters CEX rows before aggregation', () => {
		const response = [
			{
				symbol: 'USDC',
				data: [
					{ name: 'Misleading', category: 'Lending', amountUsd: { Ethereum: 100 }, misrepresentedTokens: true },
					{ name: 'Binance', category: 'CEX', amountUsd: { Ethereum: 50 } }
				]
			}
		]

		expect(aggregateProtocolTokenUsage(response, false)).toEqual([])
		expect(aggregateProtocolTokenUsage(response, true)).toEqual([
			{
				name: 'Binance',
				category: 'CEX',
				amountUsd: 50,
				logo: undefined,
				tokens: { USDC: 50 }
			}
		])
	})
})
