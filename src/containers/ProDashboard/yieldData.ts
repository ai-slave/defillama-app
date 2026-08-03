import type { EarnPageRow, MarketTableRow } from '~/containers/Yields/data/types'

/** Canonical normalized row contract shared by Pro yield producers and renderers. */

export type ProEarnRow = Pick<
	EarnPageRow,
	| 'configID'
	| 'pool'
	| 'poolMeta'
	| 'projectslug'
	| 'project'
	| 'chains'
	| 'category'
	| 'tvl'
	| 'apy'
	| 'apyBase'
	| 'apyReward'
	| 'apyMean30d'
	| 'rewardTokensSymbols'
	| 'stabilityRating'
	| 'volumeUsd1d'
	| 'stablecoin'
	| 'tokenSymbols'
	| 'ilRisk'
>

export type ProBorrowMarketRow = Pick<
	MarketTableRow,
	| 'id'
	| 'borrowApy'
	| 'borrowApyBase'
	| 'borrowApyReward'
	| 'totalSupplyUsd'
	| 'totalBorrowUsd'
	| 'availableBorrowUsd'
	| 'ltv'
>

export type ProYieldRow = ProEarnRow & {
	apyBorrow: number | null
	apyBaseBorrow: number | null
	apyRewardBorrow: number | null
	totalSupplyUsd: number | null
	totalBorrowUsd: number | null
	totalAvailableUsd: number | null
	ltv: number | null
}

export function joinEarnAndBorrowMarkets(earnRows: ProEarnRow[], marketRows: ProBorrowMarketRow[]): ProYieldRow[] {
	const marketById = new Map<string, ProBorrowMarketRow>()
	for (const market of marketRows) marketById.set(market.id, market)
	return earnRows.map((row) => {
		const market = marketById.get(row.configID)
		return {
			...row,
			apyBorrow: market?.borrowApy ?? null,
			apyBaseBorrow: market?.borrowApyBase ?? null,
			apyRewardBorrow: market?.borrowApyReward ?? null,
			totalSupplyUsd: market?.totalSupplyUsd ?? null,
			totalBorrowUsd: market?.totalBorrowUsd ?? null,
			totalAvailableUsd: market?.availableBorrowUsd ?? null,
			ltv: market?.ltv ?? null
		}
	})
}
