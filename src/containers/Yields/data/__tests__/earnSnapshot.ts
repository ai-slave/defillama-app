import { yieldsSnapshot } from '~/utils/test/yieldsSnapshotFixture'
import { getEarnPage, type EarnPageAccess } from '../earn.server'
import type { ApyTriple, ApyWindows, EarnAttributes, EarnRow } from '../types'

export const NULL_TRIPLE: ApyTriple = { base: null, reward: null, total: null }

export const ATTRIBUTES: EarnAttributes = {
	stablecoin_only: false,
	single_asset_exposure: false,
	impermanent_loss_risk: false
}

export function apyOf(total: number | null): ApyWindows {
	return { current: { base: total, reward: null, total }, avg_7d: NULL_TRIPLE, avg_30d: NULL_TRIPLE }
}

/** A raw earn artifact row; protocol and chain names join to the fixture meta during enrichment. */
export function pool(id: string, overrides: Partial<EarnRow> = {}): EarnRow {
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
		tvl_usd: 1000,
		apy: apyOf(null),
		intrinsic: null,
		stability_30d: { base: null, base_reward: null, base_intrinsic: null, base_reward_intrinsic: null },
		holders: { count: null, avg_position_usd: null, top_10_share_pct: null },
		price_per_share: null,
		volume_1d_usd: null,
		attributes: ATTRIBUTES,
		available_supply_usd: null,
		...overrides
	}
}

/** Reads one earn page from a fresh snapshot generation, so no prepared-rows cache carries over. */
export function earnPage(
	data: Parameters<typeof yieldsSnapshot>[0],
	query: Parameters<typeof getEarnPage>[1],
	access?: EarnPageAccess
) {
	return getEarnPage(yieldsSnapshot(data), query, access)
}
