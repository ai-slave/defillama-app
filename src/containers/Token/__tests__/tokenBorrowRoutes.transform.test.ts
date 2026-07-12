import { describe, expect, it } from 'vitest'
import type { LendBorrowData } from '~/containers/Yields/types'
import { buildTokenBorrowRoutesData } from '../tokenBorrowRoutes.transform'

const pools: LendBorrowData['props']['pools'] = [
	{
		pool: 'eth-aave',
		project: 'aave-v3',
		projectName: 'Aave',
		chain: 'Ethereum',
		category: 'Lending',
		symbol: 'ETH',
		tvlUsd: 1_000_000,
		apy: 1.75,
		ltv: 0.75,
		apyBase: 1.5,
		apyReward: 0.25,
		apyBaseBorrow: -2,
		apyRewardBorrow: 0.1,
		apyBorrow: -1.9,
		totalSupplyUsd: 1_000_000,
		totalBorrowUsd: 500_000,
		totalAvailableUsd: 500_000,
		borrowable: true,
		mintedCoin: null,
		borrowFactor: 1,
		underlyingTokens: ['0xeth'],
		rewardTokensNames: [],
		rewardTokensSymbols: [],
		rewardTokens: [],
		airdrop: false,
		raiseValuation: null,
		audits: null,
		url: 'https://example.com/eth-aave',
		stablecoin: false,
		exposure: 'single',
		ilRisk: 'no'
	},
	{
		pool: 'usdc-aave',
		project: 'aave-v3',
		projectName: 'Aave',
		chain: 'Ethereum',
		category: 'Lending',
		symbol: 'USDC',
		tvlUsd: 2_000_000,
		apy: 2.1,
		ltv: 0.85,
		apyBase: 2,
		apyReward: 0.1,
		apyBaseBorrow: -3,
		apyRewardBorrow: 0.2,
		apyBorrow: -2.8,
		totalSupplyUsd: 2_000_000,
		totalBorrowUsd: 1_200_000,
		totalAvailableUsd: 800_000,
		borrowable: true,
		mintedCoin: null,
		borrowFactor: 1,
		underlyingTokens: ['0xusdc'],
		rewardTokensNames: [],
		rewardTokensSymbols: [],
		rewardTokens: [],
		airdrop: false,
		raiseValuation: null,
		audits: null,
		url: 'https://example.com/usdc-aave',
		stablecoin: true,
		exposure: 'single',
		ilRisk: 'no'
	},
	{
		pool: 'link-aave',
		project: 'aave-v3',
		projectName: 'Aave',
		chain: 'Ethereum',
		category: 'Lending',
		symbol: 'LINK',
		tvlUsd: 900_000,
		apy: 1,
		ltv: 0.6,
		apyBase: 1,
		apyReward: 0,
		apyBaseBorrow: -4,
		apyRewardBorrow: 0,
		apyBorrow: -4,
		totalSupplyUsd: 900_000,
		totalBorrowUsd: 600_000,
		totalAvailableUsd: 300_000,
		borrowable: true,
		mintedCoin: null,
		borrowFactor: 1,
		underlyingTokens: ['0xlink'],
		rewardTokensNames: [],
		rewardTokensSymbols: [],
		rewardTokens: [],
		airdrop: false,
		raiseValuation: null,
		audits: null,
		url: 'https://example.com/link-aave',
		stablecoin: false,
		exposure: 'single',
		ilRisk: 'no'
	}
]

describe('getTokenBorrowRoutesData', () => {
	it('returns borrow route data for a token', () => {
		const payload = buildTokenBorrowRoutesData('LINK', pools)

		expect(payload.borrowAsCollateral).toHaveLength(2)
		expect(payload.borrowAsCollateral[0].symbol).toBe('LINK')
		expect(payload.borrowAsDebt).toHaveLength(2)
		expect(payload.borrowAsDebt[0].borrow.symbol).toBe('LINK')
	})
})
