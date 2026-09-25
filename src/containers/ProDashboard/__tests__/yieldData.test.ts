import { describe, expect, test } from 'vitest'
import type { EarnPageRow, MarketTableRow } from '~/containers/Yields/data/types'
import { joinEarnAndBorrowMarkets } from '../yieldData'

function earnRow(id: string): EarnPageRow {
	return {
		id,
		configID: id,
		pool: 'ETH',
		poolMeta: null,
		project: 'Aave V3',
		projectslug: 'aave-v3',
		airdrop: false,
		raiseValuationUsd: null,
		chains: ['Ethereum'],
		url: 'https://example.com',
		category: 'Lending',
		referenceAsset: 'ETH',
		tvl: 7000,
		apy: 4,
		apyBase: 3,
		apyReward: 1,
		apyMean30d: 3.5,
		apyRewardRaw: 1,
		rewardTokens: [],
		volumeUsd1d: null,
		pricePerShare: null,
		rewardTokensSymbols: [],
		intrinsicSourceSymbol: null,
		stablecoin: false,
		tokenSymbols: ['ETH'],
		singleAssetExposure: true,
		ilRisk: false,
		holderCount: null,
		avgPositionUsd: null,
		top10Pct: null,
		stabilityScore: null,
		stabilityRating: null,
		sparkline: null,
		resolvedApy: { base: 3, reward: 1, intrinsic: null, total: 4 }
	}
}

function marketRow(id: string): MarketTableRow {
	return {
		id,
		configID: id,
		pool: 'ETH',
		poolMeta: null,
		url: null,
		project: 'Aave V3',
		projectslug: 'aave-v3',
		airdrop: false,
		raiseValuationUsd: null,
		chain: 'Ethereum',
		chains: ['Ethereum'],
		supplyApy: 4,
		supplyApyBase: 3,
		supplyApyReward: 1,
		supplyApyIntrinsic: null,
		supplyIntrinsicSourceSymbol: null,
		borrowApy: 5,
		borrowApyBase: 6,
		borrowApyReward: 1,
		borrowApyIntrinsic: null,
		borrowIntrinsicSourceSymbol: null,
		supplyRewardTokensSymbols: [],
		borrowRewardTokensSymbols: [],
		collateralSymbol: 'ETH',
		borrowSymbol: 'USDC',
		totalSupplyUsd: 10_000,
		availableBorrowUsd: 6000,
		totalBorrowUsd: 4000,
		borrowCapacityFilled: 0.4,
		ltv: 0.8
	}
}

describe('joinEarnAndBorrowMarkets', () => {
	test('adds current borrow-market facts without changing earn values', () => {
		const rows = joinEarnAndBorrowMarkets([earnRow('pool-1')], [marketRow('pool-1')])
		expect(rows[0]).toMatchObject({
			tvl: 7000,
			apy: 4,
			apyBorrow: 5,
			apyBaseBorrow: 6,
			apyRewardBorrow: 1,
			totalSupplyUsd: 10_000,
			totalBorrowUsd: 4000,
			totalAvailableUsd: 6000,
			ltv: 0.8
		})
	})

	test('keeps supply-only pools and marks borrow facts unavailable', () => {
		const rows = joinEarnAndBorrowMarkets([earnRow('supply-only')], [])
		expect(rows[0]).toMatchObject({
			apy: 4,
			apyBorrow: null,
			totalSupplyUsd: null,
			totalBorrowUsd: null,
			totalAvailableUsd: null,
			ltv: null
		})
	})
})
