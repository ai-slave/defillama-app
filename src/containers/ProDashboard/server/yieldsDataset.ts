import { resolveApy, resolveVariant, stabilityRatingFromScore } from '~/containers/Yields/data/apy'
import { getEntityEarn, getEntityMarkets } from '~/containers/Yields/data/enrich.server'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import type { ApyComponent, EntityEarnRow } from '~/containers/Yields/data/types'
import { joinEarnAndBorrowMarkets, type ProBorrowMarketRow, type ProEarnRow, type ProYieldRow } from '../yieldData'

const DEFAULT_COMPONENTS: ApyComponent[] = ['base', 'reward']

function tokenSymbols(row: EntityEarnRow): string[] {
	const symbols = new Set<string>()
	for (const token of row.underlying_tokens) if (token.symbol) symbols.add(token.symbol)
	if (row.pool_token?.symbol) symbols.add(row.pool_token.symbol)
	if (row.reference_asset_symbol) symbols.add(row.reference_asset_symbol)
	return [...symbols]
}

function byTvlDesc(left: ProEarnRow, right: ProEarnRow) {
	if (left.tvl == null) return right.tvl == null ? 0 : 1
	if (right.tvl == null) return -1
	return right.tvl - left.tvl
}

export async function fetchProYieldsDataset(snapshot: YieldsSnapshot, chains: string[]): Promise<ProYieldRow[]> {
	const [earnRows, marketRows] = await Promise.all([getEntityEarn(snapshot), getEntityMarkets(snapshot)])
	const selectedChains = chains.length > 0 && !chains.includes('All') ? new Set(chains) : null
	const earn: ProEarnRow[] = []
	const markets: ProBorrowMarketRow[] = []

	for (const row of earnRows) {
		if (selectedChains && !selectedChains.has(row.chain)) continue
		const apy = resolveApy(row.apy, row.intrinsic, 'current', DEFAULT_COMPONENTS)
		const stabilityScore = resolveVariant(row.stability_30d, DEFAULT_COMPONENTS)
		const rewardTokensSymbols: string[] = []
		for (const token of row.reward_tokens) if (token.symbol) rewardTokensSymbols.push(token.symbol)
		earn.push({
			configID: row.id,
			pool: row.display.label ?? '',
			poolMeta: row.display.detail,
			projectslug: row.protocolSlug ?? row.protocol,
			project: row.protocol,
			chains: [row.chain],
			category: row.category,
			tvl: row.tvl_usd,
			apy: apy.total,
			apyBase: apy.base,
			apyReward: apy.reward,
			apyMean30d: row.apy.avg_30d.total,
			rewardTokensSymbols,
			stabilityRating: stabilityRatingFromScore(stabilityScore),
			volumeUsd1d: row.volume_1d_usd,
			stablecoin: row.attributes.stablecoin_only,
			tokenSymbols: tokenSymbols(row),
			ilRisk: row.attributes.impermanent_loss_risk
		})
	}

	for (const row of marketRows) {
		if (selectedChains && !selectedChains.has(row.chain)) continue
		const borrow = resolveApy(row.borrow_cost_apy, row.intrinsic.borrow, 'current', DEFAULT_COMPONENTS)
		markets.push({
			id: row.id,
			borrowApy: borrow.total,
			borrowApyBase: borrow.base,
			borrowApyReward: borrow.reward,
			totalSupplyUsd: row.total_supply_usd,
			totalBorrowUsd: row.total_borrow_usd,
			availableBorrowUsd: row.available_borrow_usd,
			ltv: row.loan_to_value
		})
	}

	earn.sort(byTvlDesc)
	return joinEarnAndBorrowMarkets(earn, markets)
}
