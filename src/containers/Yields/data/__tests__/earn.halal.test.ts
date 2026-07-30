import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApyTriple, ApyWindows, EarnAttributes, EnrichedEarnRow } from '../types'

// getEarnPage pulls its rows from getEnrichedEarn; mock it so the test controls the
// dataset and exercises only the halal (protocolSlug ∈ whitelist) filter path.
const getEnrichedEarn = vi.fn<() => Promise<EnrichedEarnRow[]>>()
vi.mock('../enrich.server', () => ({ getEnrichedEarn: () => getEnrichedEarn() }))
vi.mock('../snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('../snapshot')>()),
	readYieldsMeta: () => Promise.resolve({ halal: ['uniswap-v2', 'lido'], meme_pool_ids: [] }),
	readYieldsDepegs: () => Promise.resolve([]),
	readYieldsExploits: () => Promise.resolve([])
}))
vi.mock('../server/raiseValuations', () => ({
	getRaiseValuationsUsd: () => Promise.resolve(new Map<string, number>()),
	getReferralUrls: () => Promise.resolve(new Map<string, string>())
}))
vi.mock('~/containers/Yields/VaultRisk/coveredPools', () => ({
	getRiskCoveredPoolIds: () => Promise.resolve(new Set<string>())
}))

import { getEarnPage as getEarnPageFromSnapshot } from '../earn.server'

const snapshot = {} as never
const getEarnPage = (query: Parameters<typeof getEarnPageFromSnapshot>[1]) => getEarnPageFromSnapshot(snapshot, query)
// `uniswap-v2` and `lido` are on the whitelist served by /v2/meta (mocked above); `aave-v3` is not.

const ZERO_TRIPLE: ApyTriple = { base: null, reward: null, total: null }
const ZERO_APY: ApyWindows = { current: ZERO_TRIPLE, avg_7d: ZERO_TRIPLE, avg_30d: ZERO_TRIPLE }
const ATTRIBUTES: EarnAttributes = {
	stablecoin_only: false,
	single_asset_exposure: false,
	impermanent_loss_risk: false
}

function row(id: string, protocolSlug: string | null, overrides: Partial<EnrichedEarnRow> = {}): EnrichedEarnRow {
	return {
		id,
		pool_key: id,
		pool_token: null,
		display: { label: id, detail: null },
		reference_asset_symbol: null,
		url: null,
		protocol: protocolSlug ?? 'unknown',
		chain: 'Ethereum',
		underlying_tokens: [],
		reward_tokens: [],
		tvl_usd: 1_000,
		apy: ZERO_APY,
		intrinsic: null,
		stability_30d: {},
		holders: null,
		price_per_share: null,
		volume_1d_usd: null,
		attributes: ATTRIBUTES,
		protocolSlug,
		chainSlug: 'ethereum',
		isEvm: true,
		category: 'Dexs',
		hasAudit: false,
		protocolHasToken: false,
		trend: null,
		tokenKeys: null,
		...overrides,
		available_supply_usd: overrides.available_supply_usd ?? null
	}
}

describe('getEarnPage halal filter', () => {
	beforeEach(() => {
		getEnrichedEarn.mockReset()
	})

	it('keeps only whitelisted-protocol rows when halal=true', async () => {
		getEnrichedEarn.mockResolvedValue([
			row('a', 'uniswap-v2'),
			row('b', 'aave-v3'),
			row('c', 'lido'),
			row('d', null),
			row('e', 'compound-v3')
		])

		const result = await getEarnPage({ halal: 'true', pageSize: 'all' })
		expect(result.rows.map((r) => r.projectslug).sort()).toEqual(['lido', 'uniswap-v2'])
	})

	it('does not filter by whitelist when halal is absent', async () => {
		getEnrichedEarn.mockResolvedValue([row('a', 'uniswap-v2'), row('b', 'aave-v3'), row('c', null)])

		const result = await getEarnPage({ pageSize: 'all' })
		expect(result.rows.map((r) => r.id).sort()).toEqual(['a', 'b', 'c'])
	})

	it('composes with other filters (halal ∩ stablecoin)', async () => {
		getEnrichedEarn.mockResolvedValue([
			row('halal-stable', 'uniswap-v2', { attributes: { ...ATTRIBUTES, stablecoin_only: true } }),
			row('halal-nonstable', 'lido'),
			row('nonhalal-stable', 'aave-v3', { attributes: { ...ATTRIBUTES, stablecoin_only: true } })
		])

		const result = await getEarnPage({ halal: 'true', stablecoin: 'true', pageSize: 'all' })
		expect(result.rows.map((r) => r.id)).toEqual(['halal-stable'])
	})
})
