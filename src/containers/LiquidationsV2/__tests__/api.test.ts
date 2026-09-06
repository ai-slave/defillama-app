import { describe, expect, test } from 'vitest'
import { fetchTokenLiquidationsClient } from '../api'
import type { TokenLiquidationsSectionData } from '../api.types'

function makeTokenLiquidationsPart(symbol: string, firstUsd: number, secondUsd: number): TokenLiquidationsSectionData {
	const totalUsd = firstUsd + secondUsd

	return {
		tokenSymbol: symbol,
		timestamp: totalUsd,
		positionCount: 1,
		protocolCount: 1,
		chainCount: 1,
		totalCollateralUsd: totalUsd,
		distributionChart: {
			tokens: [
				{
					key: 'WBTC',
					label: 'WBTC',
					totalUsd,
					breakdowns: {
						total: {
							bins: [0, 1],
							series: [{ key: 'WBTC', label: 'WBTC', usd: [firstUsd, secondUsd], amount: [1, 2], totalUsd }]
						},
						protocol: {
							bins: [0, 1],
							series: [{ key: 'Aave', label: 'Aave', usd: [firstUsd, secondUsd], amount: [1, 2], totalUsd }]
						},
						chain: {
							bins: [0, 1],
							series: [{ key: 'Ethereum', label: 'Ethereum', usd: [firstUsd, secondUsd], amount: [1, 2], totalUsd }]
						}
					}
				}
			]
		},
		protocolRows: [
			{
				id: 'aave',
				name: 'Aave',
				slug: 'aave',
				positionCount: 1,
				chainCount: 1,
				collateralCount: 1,
				totalCollateralUsd: totalUsd
			}
		],
		chainRows: [
			{
				id: 'ethereum',
				name: 'Ethereum',
				slug: 'ethereum',
				positionCount: 1,
				protocolCount: 1,
				collateralCount: 1,
				totalCollateralUsd: totalUsd
			}
		]
	}
}

describe('fetchTokenLiquidationsClient', () => {
	test('preserves the Token-page symbol in its private route', async () => {
		const urls: Array<string> = []
		const result = await fetchTokenLiquidationsClient('wstETH', async (url: string) => {
			urls.push(url)
			return new Response(JSON.stringify(makeTokenLiquidationsPart('BTC', 10, 20)), { status: 200 })
		})

		expect(urls).toEqual(['/api/private/token-liquidations/wstETH'])
		expect(result.tokenSymbol).toBe('BTC')
		expect(result.totalCollateralUsd).toBe(30)
	})

	test('keeps a failed family route unavailable', async () => {
		await expect(
			fetchTokenLiquidationsClient(
				'wbtc',
				async () => new Response(JSON.stringify({ error: 'upstream unavailable' }), { status: 500 })
			)
		).rejects.toThrow('upstream unavailable')
	})
})
