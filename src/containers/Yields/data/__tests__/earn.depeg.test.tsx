import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApyTriple, ApyWindows, DepegRow, EarnAttributes, EnrichedEarnRow } from '../types'

// getEarnPage pulls rows from getEnrichedEarn and depeg/exploit flags from the snapshot readers;
// mock them so the test controls the dataset and exercises only the sparse id-join stamping.
const getEnrichedEarn = vi.fn<() => Promise<EnrichedEarnRow[]>>()
const getYieldsDepegs = vi.fn<() => Promise<DepegRow[]>>()
const getYieldsExploits = vi.fn<() => Promise<string[]>>()
vi.mock('../enrich.server', () => ({ getEnrichedEarn: () => getEnrichedEarn() }))
vi.mock('../snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('../snapshot')>()),
	readYieldsMeta: () => Promise.resolve({ halal: [], meme_pool_ids: [] }),
	readYieldsDepegs: () => getYieldsDepegs(),
	readYieldsExploits: () => getYieldsExploits()
}))
vi.mock('../server/raiseValuations', () => ({
	getRaiseValuationsUsd: () => Promise.resolve(new Map<string, number>()),
	getReferralUrls: () => Promise.resolve(new Map<string, string>())
}))
vi.mock('~/containers/Yields/VaultRisk/coveredPools', () => ({
	getRiskCoveredPoolIds: () => Promise.resolve(new Set<string>())
}))

import { getDepegWarningSeverity } from '../../domain/apyPresentation'
import { getEarnPage as getEarnPageFromSnapshot } from '../earn.server'

const snapshot = {} as never
const getEarnPage = (query: Parameters<typeof getEarnPageFromSnapshot>[1]) => getEarnPageFromSnapshot(snapshot, query)

const ZERO_TRIPLE: ApyTriple = { base: null, reward: null, total: 5 }
const ZERO_APY: ApyWindows = { current: ZERO_TRIPLE, avg_7d: ZERO_TRIPLE, avg_30d: ZERO_TRIPLE }
const ATTRIBUTES: EarnAttributes = {
	stablecoin_only: true,
	single_asset_exposure: false,
	impermanent_loss_risk: false
}

function row(id: string): EnrichedEarnRow {
	return {
		id,
		pool_key: id,
		pool_token: null,
		display: { label: id, detail: null },
		reference_asset_symbol: null,
		url: null,
		protocol: 'test',
		chain: 'Ethereum',
		underlying_tokens: [],
		reward_tokens: [],
		tvl_usd: 1_000,
		available_supply_usd: null,
		apy: ZERO_APY,
		intrinsic: null,
		stability_30d: {},
		holders: null,
		price_per_share: null,
		volume_1d_usd: null,
		attributes: ATTRIBUTES,
		protocolSlug: 'test',
		chainSlug: 'ethereum',
		isEvm: true,
		category: 'Dexs',
		hasAudit: false,
		protocolHasToken: false,
		trend: null,
		tokenKeys: null
	}
}

describe('getEarnPage depeg stamping', () => {
	beforeEach(() => {
		getEnrichedEarn.mockReset()
		getYieldsDepegs.mockReset()
		getYieldsExploits.mockReset()
		getYieldsExploits.mockResolvedValue([])
	})

	it('stamps pegDeviation (relative) + pegTokenSymbol onto matching pools, leaves others absent', async () => {
		getEnrichedEarn.mockResolvedValue([row('a'), row('b')])
		getYieldsDepegs.mockResolvedValue([{ pool_id: 'a', deviation_pct: -0.0723, token_symbol: 'deUSD' }])

		const result = await getEarnPage({ pageSize: 'all' })
		const byId = new Map(result.rows.map((r) => [r.id, r]))

		expect(byId.get('a')?.pegDeviation).toBe(-0.0723)
		expect(byId.get('a')?.pegTokenSymbol).toBe('deUSD')
		expect(byId.get('b')?.pegDeviation).toBeUndefined()
		expect(byId.get('b')?.pegTokenSymbol).toBeUndefined()
	})

	it('stamps exploited onto pools flagged by /v2/exploits, leaves others absent', async () => {
		getEnrichedEarn.mockResolvedValue([row('a'), row('b')])
		getYieldsDepegs.mockResolvedValue([])
		getYieldsExploits.mockResolvedValue(['b'])

		const result = await getEarnPage({ pageSize: 'all' })
		const byId = new Map(result.rows.map((r) => [r.id, r]))

		expect(byId.get('b')?.exploited).toBe(true)
		expect(byId.get('a')?.exploited).toBeUndefined()
	})
})

describe('depeg warning severity', () => {
	it('returns no warning below the 5% threshold', () => {
		expect(getDepegWarningSeverity(0.0499)).toBeNull()
	})

	it('returns warning severity from 5% up to 10%', () => {
		expect(getDepegWarningSeverity(-0.05)).toBe('warning')
		expect(getDepegWarningSeverity(0.0999)).toBe('warning')
	})

	it('returns danger severity at 10% in either direction', () => {
		expect(getDepegWarningSeverity(0.1)).toBe('danger')
		expect(getDepegWarningSeverity(-0.1)).toBe('danger')
	})
})
