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

import { getEarnPage } from '../earn.server'

const NULL_TRIPLE: ApyTriple = { base: null, reward: null, total: null }
const ATTRIBUTES: EarnAttributes = {
	stablecoin_only: false,
	single_asset_exposure: false,
	impermanent_loss_risk: false
}

function apyOf(total: number | null): ApyWindows {
	return { current: { base: total, reward: null, total }, avg_7d: NULL_TRIPLE, avg_30d: NULL_TRIPLE }
}

function pool(id: string, tvl: number): EnrichedEarnRow {
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
		stability_30d: {},
		holders: null,
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
		available_supply_usd: null
	} as EnrichedEarnRow
}

const snapshotOf = (generationId: string) => ({ generationId }) as never

beforeEach(() => {
	getEnrichedEarn.mockReset()
})

describe('getEarnPage prepared-rows memoization', () => {
	it('prepares once per (generation, filters) and slices every page from it', async () => {
		const rows = Array.from({ length: 120 }, (_, index) => pool(`p${index}`, 1000 - index))
		getEnrichedEarn.mockResolvedValue(rows)
		const snapshot = snapshotOf('gen-slices')

		const first = await getEarnPage(snapshot, { pageSize: '50' })
		const second = await getEarnPage(snapshot, { page: '2', pageSize: '50' })

		expect(getEnrichedEarn).toHaveBeenCalledTimes(1)
		expect(first.rows).toHaveLength(50)
		expect(second.rows).toHaveLength(50)
		const firstRow = first.rows[0]
		const secondRow = second.rows[0]
		expect(firstRow).toBeDefined()
		expect(secondRow).toBeDefined()
		if (!firstRow || !secondRow) throw new Error('Missing prepared page row')
		expect(firstRow.id).toBe('p0')
		expect(secondRow.id).toBe('p50')
		expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(100)
		expect(second.medianApy).toBe(first.medianApy)
	})

	it('re-prepares when filters change and when the generation changes', async () => {
		getEnrichedEarn.mockResolvedValue([pool('a', 10), pool('b', 5)])
		const snapshot = snapshotOf('gen-filters')

		await getEarnPage(snapshot, {})
		await getEarnPage(snapshot, { minTvl: '7' })
		expect(getEnrichedEarn).toHaveBeenCalledTimes(2)

		await getEarnPage(snapshotOf('gen-filters-2'), {})
		expect(getEnrichedEarn).toHaveBeenCalledTimes(3)
	})

	it('signs page/pageSize out but sort in', async () => {
		getEnrichedEarn.mockResolvedValue([pool('a', 10), pool('b', 5)])
		const snapshot = snapshotOf('gen-sort')

		const desc = await getEarnPage(snapshot, {})
		const asc = await getEarnPage(snapshot, { sortBy: 'tvl', sortDesc: 'false' })

		expect(getEnrichedEarn).toHaveBeenCalledTimes(2)
		expect(desc.rows.map((row) => row.id)).toEqual(['a', 'b'])
		expect(asc.rows.map((row) => row.id)).toEqual(['b', 'a'])
	})

	it('keeps the wire contract for clamped pages and pageSize=all', async () => {
		getEnrichedEarn.mockResolvedValue(Array.from({ length: 7 }, (_, index) => pool(`p${index}`, 7 - index)))
		const snapshot = snapshotOf('gen-wire')

		const clamped = await getEarnPage(snapshot, { page: '99', pageSize: '3' })
		expect(clamped).toMatchObject({ page: 3, pageSize: 3, total: 7, hasMore: false })
		expect(clamped.rows).toHaveLength(1)

		const all = await getEarnPage(snapshot, { pageSize: 'all' })
		expect(all).toMatchObject({ page: 1, pageSize: 7, total: 7, hasMore: false })
		expect(all.rows).toHaveLength(7)
	})
})
