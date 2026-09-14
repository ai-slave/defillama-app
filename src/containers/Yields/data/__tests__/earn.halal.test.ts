import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ApyTriple, ApyWindows, EarnAttributes, EnrichedEarnRow } from '../types'

// getEarnPage pulls its rows from getEnrichedEarn; mock it so the test controls the
// dataset and exercises only the halal (protocolSlug ∈ whitelist) filter path.
const getEnrichedEarn = vi.fn<() => Promise<Array<EnrichedEarnRow>>>()
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

// Unique generation per call: the prepared-rows cache keys on generationId,
// and each test case mocks different upstream data under the same filters.
let generationCounter = 0
const getEarnPage = (query: Parameters<typeof getEarnPageFromSnapshot>[1]) =>
	getEarnPageFromSnapshot({ generationId: `test-${++generationCounter}` } as never, query)
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
		tvl_usd: 1000,
		apy: ZERO_APY,
		intrinsic: null,
		stability_30d: { base: null, base_reward: null, base_intrinsic: null, base_reward_intrinsic: null },
		holders: { count: null, avg_position_usd: null, top_10_share_pct: null },
		price_per_share: null,
		volume_1d_usd: null,
		attributes: ATTRIBUTES,
		protocolSlug,
		chainSlug: 'ethereum',
		isEvm: true,
		category: 'Dexs',
		hasAudit: false,
		potentialAirdrop: true,
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

	test('keeps only whitelisted-protocol rows when halal=true', async () => {
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

	test('does not filter by whitelist when halal is absent', async () => {
		getEnrichedEarn.mockResolvedValue([row('a', 'uniswap-v2'), row('b', 'aave-v3'), row('c', null)])

		const result = await getEarnPage({ pageSize: 'all' })
		expect(result.rows.map((r) => r.id).sort()).toEqual(['a', 'b', 'c'])
	})

	test('composes with other filters (halal ∩ stablecoin)', async () => {
		getEnrichedEarn.mockResolvedValue([
			row('halal-stable', 'uniswap-v2', { attributes: { ...ATTRIBUTES, stablecoin_only: true } }),
			row('halal-nonstable', 'lido'),
			row('nonhalal-stable', 'aave-v3', { attributes: { ...ATTRIBUTES, stablecoin_only: true } })
		])

		const result = await getEarnPage({ halal: 'true', stablecoin: 'true', pageSize: 'all' })
		expect(result.rows.map((r) => r.id)).toEqual(['halal-stable'])
	})

	test('does not classify unknown attributes as explicit false values', async () => {
		getEnrichedEarn.mockResolvedValue([
			row('safe', 'aave-v3'),
			row('unknown', 'aave-v3', {
				attributes: { stablecoin_only: null, single_asset_exposure: null, impermanent_loss_risk: null }
			}),
			row('risky', 'aave-v3', {
				attributes: { stablecoin_only: false, single_asset_exposure: false, impermanent_loss_risk: true }
			})
		])

		const result = await getEarnPage({ noIlRisk: 'true', pageSize: 'all' })
		expect(result.rows.map((item) => item.id)).toEqual(['safe'])
	})
})
