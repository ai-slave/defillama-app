import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YIELDS_SNAPSHOT_FILES } from '../data/snapshot.contract'

const fetchers = vi.hoisted(() => ({
	earn: vi.fn(),
	trends: vi.fn(),
	borrowMarkets: vi.fn(),
	borrowRoutes: vi.fn(),
	loops: vi.fn(),
	tokenKeys: vi.fn(),
	meta: vi.fn(),
	depegs: vi.fn(),
	exploits: vi.fn()
}))

vi.mock('../data/server/fetchers', () => ({
	fetchEarnFromNetwork: fetchers.earn,
	fetchTrendsFromNetwork: fetchers.trends,
	fetchBorrowMarketsFromNetwork: fetchers.borrowMarkets,
	fetchBorrowRoutesFromNetwork: fetchers.borrowRoutes,
	fetchLoopsFromNetwork: fetchers.loops,
	fetchTokenKeysFromNetwork: fetchers.tokenKeys,
	fetchYieldsMetaFromNetwork: fetchers.meta,
	fetchDepegsFromNetwork: fetchers.depegs,
	fetchExploitsFromNetwork: fetchers.exploits
}))

import { buildYieldsSnapshotCandidate } from '../server/dataset.builder.server'

function validMeta() {
	return {
		chains: [{ slug: 'ethereum', name: 'Ethereum', is_evm: true }],
		protocols: [{ slug: 'aave-v3', name: 'Aave V3', category: 'Lending', has_audit: true, has_token: true }],
		categories: [{ slug: 'lending', name: 'Lending' }],
		tokens: { families: [{ value: 'family:eth', symbol: 'ETH' }], assets: [] },
		halal: [],
		meme_pool_ids: []
	}
}

beforeEach(() => {
	vi.clearAllMocks()
	fetchers.earn.mockResolvedValue([{ id: 'earn' }])
	fetchers.trends.mockResolvedValue([{ id: 'trend' }])
	fetchers.borrowMarkets.mockResolvedValue([{ id: 'borrow-market' }])
	fetchers.borrowRoutes.mockResolvedValue([{ collateral: { id: 'collateral' }, borrow: { id: 'borrow' } }])
	fetchers.loops.mockResolvedValue([{ id: 'loop' }])
	fetchers.tokenKeys.mockResolvedValue([{ id: 'token-key' }])
	fetchers.meta.mockResolvedValue(validMeta())
	fetchers.depegs.mockResolvedValue([])
	fetchers.exploits.mockResolvedValue([])
})

describe('Yields v2 snapshot builder', () => {
	it('writes all nine endpoint responses while allowing empty optional feeds', async () => {
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await buildYieldsSnapshotCandidate({ writeJson })

		for (const fetcher of Object.values(fetchers)) {
			expect(fetcher).toHaveBeenCalledWith({ extraRetry: true, timeout: 180_000 })
		}
		expect(writeJson.mock.calls.map(([path]) => path)).toEqual(Object.values(YIELDS_SNAPSHOT_FILES))
	})

	it('does not write a partial candidate when an endpoint fails', async () => {
		fetchers.borrowRoutes.mockRejectedValueOnce(new Error('upstream failed'))
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow(
			'Yields snapshot requests failed:\nborrow routes: upstream failed'
		)
		expect(writeJson).not.toHaveBeenCalled()
	})

	it('reports every failed endpoint', async () => {
		fetchers.trends.mockRejectedValueOnce(new Error('trends unavailable'))
		fetchers.meta.mockRejectedValueOnce(new Error('meta unavailable'))
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow(
			'Yields snapshot requests failed:\ntrends: trends unavailable\nmeta: meta unavailable'
		)
		expect(writeJson).not.toHaveBeenCalled()
	})

	it.each([
		['earn', fetchers.earn],
		['trends', fetchers.trends],
		['borrow markets', fetchers.borrowMarkets],
		['borrow routes', fetchers.borrowRoutes],
		['loops', fetchers.loops],
		['tokens', fetchers.tokenKeys]
	])('rejects an empty %s dataset without replacing the candidate', async (name, fetcher) => {
		fetcher.mockResolvedValueOnce([])
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow(
			`Yields snapshot ${name} dataset is empty`
		)
		expect(writeJson).not.toHaveBeenCalled()
	})

	it('rejects empty core metadata', async () => {
		fetchers.meta.mockResolvedValueOnce({ ...validMeta(), chains: [] })
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow('Yields snapshot metadata has no chains')
		expect(writeJson).not.toHaveBeenCalled()
	})

	it('rejects a generation whose default earn view is entirely hidden', async () => {
		fetchers.meta.mockResolvedValueOnce({ ...validMeta(), meme_pool_ids: ['earn'] })
		const writeJson = vi.fn().mockResolvedValue(undefined)

		await expect(buildYieldsSnapshotCandidate({ writeJson })).rejects.toThrow(
			'Yields snapshot earn dataset has no default-visible rows'
		)
		expect(writeJson).not.toHaveBeenCalled()
	})
})
