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

	it('preserves one-through-four-token totals and protocol encounter order', () => {
		const symbols = ['USDC', 'USDT', 'DAI', 'FRAX']
		const responses = symbols.map((symbol, tokenIndex) => ({
			symbol,
			data: Array.from({ length: 4 - tokenIndex }, (_, protocolIndex) => ({
				name: `Protocol ${protocolIndex + tokenIndex}`,
				category: 'Lending',
				amountUsd: { Ethereum: tokenIndex + 1 }
			}))
		}))

		expect(aggregateProtocolTokenUsage(responses, false)).toEqual([
			{
				name: 'Protocol 0',
				category: 'Lending',
				amountUsd: 1,
				logo: undefined,
				tokens: { USDC: 1 }
			},
			{
				name: 'Protocol 1',
				category: 'Lending',
				amountUsd: 3,
				logo: undefined,
				tokens: { USDC: 1, USDT: 2 }
			},
			{
				name: 'Protocol 2',
				category: 'Lending',
				amountUsd: 6,
				logo: undefined,
				tokens: { USDC: 1, USDT: 2, DAI: 3 }
			},
			{
				name: 'Protocol 3',
				category: 'Lending',
				amountUsd: 10,
				logo: undefined,
				tokens: { USDC: 1, USDT: 2, DAI: 3, FRAX: 4 }
			}
		])
	})
})
