import { describe, expect, it } from 'vitest'
import { buildAaveApyDataset, formatAaveMarkets, type AaveMarket, type AaveReserve } from './api'

function reserve(overrides: Partial<AaveReserve> = {}): AaveReserve {
	return {
		underlyingToken: { symbol: 'USDC', name: 'USD Coin', address: '0x1', decimals: 6 },
		size: { usd: '2000' },
		usdExchangeRate: '1',
		isFrozen: false,
		isPaused: false,
		supplyInfo: {
			apy: { value: '0.03' },
			maxLTV: { value: '0.8' },
			liquidationThreshold: { value: '0.85' },
			liquidationBonus: { value: '0.05' },
			canBeCollateral: true,
			supplyCap: { usd: '10000' },
			supplyCapReached: false,
			total: { value: '2000' }
		},
		borrowInfo: {
			apy: { value: '0.04' },
			total: { usd: '750' },
			reserveFactor: { value: '0.1' },
			availableLiquidity: { usd: '1250' },
			utilizationRate: { value: '0.375' },
			borrowCap: { usd: '5000' },
			borrowCapReached: false,
			borrowingState: 'ENABLED',
			baseVariableBorrowRate: { value: '0.01' }
		},
		incentives: [{ extraSupplyApr: { value: '0.005' }, borrowAprDiscount: { value: '0.002' } }],
		eModeInfo: [
			{ categoryId: 1, label: 'Stablecoins', maxLTV: { value: '0.9' }, liquidationThreshold: { value: '0.93' } }
		],
		...overrides
	}
}

describe('Aave dashboard data contracts', () => {
	it('formats API reserves and filters insignificant markets', () => {
		const markets: AaveMarket[] = [
			{
				name: 'Core',
				address: '0xmarket',
				chain: { chainId: 1, name: 'Ethereum' },
				totalMarketSize: '2500',
				totalAvailableLiquidity: '1250',
				reserves: [
					reserve(),
					reserve({
						size: { usd: '999' },
						underlyingToken: { symbol: 'DUST', name: 'Dust', address: '0x2', decimals: 18 }
					})
				]
			}
		]

		expect(formatAaveMarkets(markets)).toEqual([
			expect.objectContaining({
				symbol: 'USDC',
				chain: 'Ethereum',
				sizeUsd: 2000,
				supplyApy: 3,
				borrowApy: 4,
				utilization: 37.5,
				rewardSupplyApr: 0.5,
				rewardBorrowDiscount: 0.2,
				baseVariableBorrowRate: 1,
				eModeCategories: ['Stablecoins']
			})
		])
	})

	it('converts newest-first APY samples to an ascending, named dataset', () => {
		const samples = [
			{ date: '2026-01-02T00:00:00Z', avgRate: { value: '0.04' } },
			{ date: '2026-01-01T00:00:00Z', avgRate: { value: '0.03' } }
		]
		const result = buildAaveApyDataset(samples, 'borrow')

		expect(result).toEqual({
			dimensions: ['timestamp', 'Borrow APY'],
			source: [
				[Date.parse('2026-01-01T00:00:00Z'), 3],
				[Date.parse('2026-01-02T00:00:00Z'), 4]
			]
		})
	})
})
