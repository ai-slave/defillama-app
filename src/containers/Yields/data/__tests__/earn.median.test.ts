import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApyTriple, ApyWindows, EarnAttributes, EnrichedEarnRow } from '../types'

// getEarnPage pulls its rows from getEnrichedEarn; mock it so the test controls the dataset.
const getEnrichedEarn = vi.fn<() => Promise<EnrichedEarnRow[]>>()
vi.mock('../enrich.server', () => ({ getEnrichedEarn: () => getEnrichedEarn() }))
vi.mock('../snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('../snapshot')>()),
	readYieldsMeta: () => Promise.resolve({ halal: [], meme_pool_ids: [] }),
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

const NULL_TRIPLE: ApyTriple = { base: null, reward: null, total: null }
const ATTRIBUTES: EarnAttributes = {
	stablecoin_only: false,
	single_asset_exposure: false,
	impermanent_loss_risk: false
}

function apyOf(total: number | null): ApyWindows {
	return { current: { base: total, reward: null, total }, avg_7d: NULL_TRIPLE, avg_30d: NULL_TRIPLE }
}

function row(id: string, apyTotal: number | null, overrides: Partial<EnrichedEarnRow> = {}): EnrichedEarnRow {
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
		tvl_usd: 1_000,
		apy: apyOf(apyTotal),
		intrinsic: null,
		stability_30d: { base: null, base_reward: null, base_intrinsic: null, base_reward_intrinsic: null },
		holders: { count: null, avg_position_usd: null, top_10_share_pct: null },
		price_per_share: null,
		volume_1d_usd: null,
		attributes: ATTRIBUTES,
		protocolSlug: 'aave',
		chainSlug: 'ethereum',
		isEvm: true,
		category: 'Lending',
		hasAudit: false,
		protocolHasToken: false,
		trend: null,
		tokenKeys: null,
		...overrides,
		available_supply_usd: overrides.available_supply_usd ?? null
	}
}

describe('getEarnPage medianApy', () => {
	beforeEach(() => {
		getEnrichedEarn.mockReset()
	})

	it('is the median of the FULL filtered set, not the returned page', async () => {
		getEnrichedEarn.mockResolvedValue([row('a', 1), row('b', 2), row('c', 3), row('d', 4), row('e', 5)])

		const result = await getEarnPage({ pageSize: '2' })
		expect(result.rows).toHaveLength(2)
		expect(result.medianApy).toBe(3)
	})

	it('follows the active filters', async () => {
		getEnrichedEarn.mockResolvedValue([
			row('eth-1', 1),
			row('eth-2', 2),
			row('base-1', 10, { chain: 'Base', chainSlug: 'base' }),
			row('base-2', 20, { chain: 'Base', chainSlug: 'base' }),
			row('base-3', 30, { chain: 'Base', chainSlug: 'base' })
		])

		const result = await getEarnPage({ chain: 'Base', pageSize: 'all' })
		expect(result.total).toBe(3)
		expect(result.medianApy).toBe(20)
	})

	it('averages the middle pair for an even count and skips null APYs', async () => {
		getEnrichedEarn.mockResolvedValue([row('a', 1), row('b', 3), row('c', 6), row('d', 10), row('null', null)])

		const result = await getEarnPage({ pageSize: 'all' })
		expect(result.total).toBe(5)
		expect(result.medianApy).toBe(4.5)
	})

	it('is null when no filtered row has an APY', async () => {
		getEnrichedEarn.mockResolvedValue([row('a', null)])

		const result = await getEarnPage({ pageSize: 'all' })
		expect(result.medianApy).toBeNull()
	})
})
