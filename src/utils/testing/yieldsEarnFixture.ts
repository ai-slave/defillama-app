import type { ApyTriple, ApyWindows, EarnAttributes, EarnPageRow, EarnRow } from '~/containers/Yields/data/types'

const NULL_TRIPLE: ApyTriple = { base: null, reward: null, total: null }
const ATTRIBUTES: EarnAttributes = {
	stablecoin_only: false,
	single_asset_exposure: false,
	impermanent_loss_risk: false
}

function apyOf(total: number | null): ApyWindows {
	return { current: { base: total, reward: null, total }, avg_7d: NULL_TRIPLE, avg_30d: NULL_TRIPLE }
}

export function earnRow(id: string, tvl: number): EarnRow {
	return {
		id,
		pool_key: id,
		pool_token: null,
		display: { label: id, detail: null },
		reference_asset_symbol: null,
		url: null,
		protocol: 'Aave',
		chain: 'Ethereum',
		underlying_tokens: [],
		reward_tokens: [],
		tvl_usd: tvl,
		apy: apyOf(1),
		intrinsic: null,
		stability_30d: { base: null, base_reward: null, base_intrinsic: null, base_reward_intrinsic: null },
		holders: { count: null, avg_position_usd: null, top_10_share_pct: null },
		price_per_share: null,
		volume_1d_usd: null,
		attributes: ATTRIBUTES,
		available_supply_usd: null
	}
}

/** An Earn table response row on Ethereum with no APY or TVL; `overrides` set the facts a test reads. */
export function earnPageRow(id: string, overrides: Partial<EarnPageRow> = {}): EarnPageRow {
	return {
		id,
		configID: id,
		pool: id,
		poolMeta: null,
		projectslug: 'aave',
		project: 'Aave',
		airdrop: false,
		raiseValuationUsd: null,
		chains: ['Ethereum'],
		url: '',
		category: null,
		referenceAsset: null,
		tvl: null,
		apy: null,
		apyBase: null,
		apyReward: null,
		apyMean30d: null,
		apyRewardRaw: null,
		rewardTokens: [],
		rewardTokensSymbols: [],
		intrinsicSourceSymbol: null,
		volumeUsd1d: null,
		pricePerShare: null,
		holderCount: null,
		avgPositionUsd: null,
		top10Pct: null,
		stabilityScore: null,
		stabilityRating: null,
		sparkline: null,
		resolvedApy: { base: null, reward: null, intrinsic: null, total: null },
		stablecoin: null,
		tokenSymbols: [],
		singleAssetExposure: null,
		ilRisk: null,
		...overrides
	}
}
