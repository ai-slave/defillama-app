// API-only export builders. Keep snapshot readers out of the browser-safe
// downloads catalog module.
import { getEntityEarn, getEntityMarkets } from '~/containers/Yields/data/enrich.server'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'

export async function getYieldsExportRows(snapshot: YieldsSnapshot): Promise<Array<Record<string, unknown>>> {
	const pools = await getEntityEarn(snapshot)
	return pools.map((pool) => ({
		chain: pool.chain,
		protocol: pool.protocol,
		protocolSlug: pool.protocolSlug,
		category: pool.category,
		pool: pool.display.label,
		poolMeta: pool.display.detail,
		poolId: pool.id,
		tvlUsd: pool.tvl_usd,
		supplyApy: pool.apy.current.total,
		supplyApyBase: pool.apy.current.base,
		supplyApyReward: pool.apy.current.reward,
		supplyApyIntrinsic: pool.intrinsic?.apy.current.base ?? null,
		supplyApy7d: pool.apy.avg_7d.total,
		supplyApyBase7d: pool.apy.avg_7d.base,
		supplyApyReward7d: pool.apy.avg_7d.reward,
		supplyApyIntrinsic7d: pool.intrinsic?.apy.avg_7d.base ?? null,
		supplyApy30d: pool.apy.avg_30d.total,
		supplyApyBase30d: pool.apy.avg_30d.base,
		supplyApyReward30d: pool.apy.avg_30d.reward,
		supplyApyIntrinsic30d: pool.intrinsic?.apy.avg_30d.base ?? null,
		stability30d: pool.stability_30d.base_reward ?? null,
		stablecoinOnly: pool.attributes.stablecoin_only,
		singleAssetExposure: pool.attributes.single_asset_exposure,
		impermanentLossRisk: pool.attributes.impermanent_loss_risk,
		referenceAsset: pool.reference_asset_symbol,
		underlyingTokens: pool.underlying_tokens.map((token) => token.symbol),
		rewardTokens: pool.reward_tokens.map((token) => token.symbol),
		volumeUsd1d: pool.volume_1d_usd,
		holderCount: pool.holders?.count ?? null,
		top10HolderPct: pool.holders?.top_10_share_pct ?? null,
		avgPositionUsd: pool.holders?.avg_position_usd ?? null,
		url: pool.url
	}))
}

export async function getBorrowMarketsExportRows(snapshot: YieldsSnapshot): Promise<Array<Record<string, unknown>>> {
	const markets = await getEntityMarkets(snapshot)
	return markets.map((market) => ({
		chain: market.chain,
		protocol: market.protocol,
		protocolSlug: market.protocolSlug,
		category: market.category,
		market: market.display.label,
		marketMeta: market.display.detail,
		marketId: market.id,
		collateralToken: market.collateral_token?.symbol ?? null,
		borrowToken: market.borrow_token?.symbol ?? null,
		supplyApy: market.supply_apy.current.total,
		supplyApyBase: market.supply_apy.current.base,
		supplyApyReward: market.supply_apy.current.reward,
		supplyApyIntrinsic: market.intrinsic.supply?.apy.current.base ?? null,
		borrowCostApy: market.borrow_cost_apy.current.total,
		borrowCostApyBase: market.borrow_cost_apy.current.base,
		borrowCostApyReward: market.borrow_cost_apy.current.reward,
		borrowCostApyIntrinsic: market.intrinsic.borrow?.apy.current.base ?? null,
		totalSupplyUsd: market.total_supply_usd,
		totalBorrowUsd: market.total_borrow_usd,
		availableBorrowUsd: market.available_borrow_usd,
		ltv: market.loan_to_value,
		rewardTokens: market.reward_tokens.map((token) => token.symbol),
		url: market.url
	}))
}
