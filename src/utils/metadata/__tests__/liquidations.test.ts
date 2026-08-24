import { describe, expect, it } from 'vitest'
import { extractLiquidationsTokenSymbols } from '../liquidations'

describe('liquidations metadata helpers', () => {
	it('extracts exact producer symbols from populated positions', () => {
		expect(
			extractLiquidationsTokenSymbols({
				timestamp: 1,
				validThresholds: ['100k', '10k', 'all'],
				tokens: {
					ethereum: {
						wstETH: { symbol: 'wstETH', decimals: 18, price: 1 },
						ETH: { symbol: 'ETH', decimals: 18, price: 1 },
						LDO: { symbol: 'LDO', decimals: 18, price: 1 }
					},
					base: {
						WSTETH: { symbol: 'WSTETH', decimals: 18, price: 1 },
						cbbtc: { symbol: 'cbbtc', decimals: 8, price: 1 }
					}
				},
				data: {
					'aave-v3': {
						ethereum: [
							{
								owner: '0x1',
								liqPrice: 1,
								collateral: 'wstETH',
								collateralId: 'ethereum:wsteth',
								collateralAmount: 1,
								collateralAmountUsd: 100
							},
							{
								owner: '0x2',
								liqPrice: 1,
								collateral: 'ETH',
								collateralId: 'ethereum:eth',
								collateralAmount: 1,
								collateralAmountUsd: 100
							}
						],
						base: [
							{
								owner: '0x3',
								liqPrice: 1,
								collateral: 'cbbtc',
								collateralId: 'base:cbbtc',
								collateralAmount: 1,
								collateralAmountUsd: 100
							}
						]
					},
					'compound-v3': {
						base: [
							{
								owner: '0x4',
								liqPrice: 1,
								collateral: 'WSTETH',
								collateralId: 'base:wsteth',
								collateralAmount: 1,
								collateralAmountUsd: 100
							}
						]
					}
				}
			})
		).toEqual(['cbbtc', 'ETH', 'wstETH', 'WSTETH'])
	})
})
