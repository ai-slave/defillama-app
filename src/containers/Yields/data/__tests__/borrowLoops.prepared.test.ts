import { describe, expect, test, vi } from 'vitest'

// Route pages pull enriched rows from enrich.server; mock it so the tests
// control the dataset and can count preparations.
const getEnrichedMarkets = vi.fn()
const getEnrichedRoutes = vi.fn()
const getEnrichedLoops = vi.fn()
vi.mock('../enrich.server', () => ({
	getEnrichedMarkets: () => getEnrichedMarkets(),
	getEnrichedRoutes: () => getEnrichedRoutes(),
	getEnrichedLoops: () => getEnrichedLoops()
}))
vi.mock('~/containers/Yields/VaultRisk/coveredPools', () => ({
	getRiskCoveredPoolIds: () => Promise.resolve(new Set<string>())
}))
vi.mock('../server/raiseValuations', () => ({
	getRaiseValuationsUsd: () => Promise.resolve(new Map<string, number>()),
	getReferralUrls: () => Promise.resolve(new Map<string, string>())
}))
vi.mock('../snapshot', async (importOriginal) => ({
	...(await importOriginal<typeof import('../snapshot')>()),
	readYieldsMeta: () => Promise.resolve({ halal: [], meme_pool_ids: [] }),
	readYieldsDepegs: () => Promise.resolve([])
}))

import { getBorrowMarketsPage } from '../borrow.server'
import { getLoopsPage } from '../loops.server'

const snapshotOf = (generationId: string) => ({ generationId }) as never

describe('borrow and loops prepared-rows memoization', () => {
	test('prepares borrow markets once per generation+filters and slices pages from it', async () => {
		getEnrichedMarkets.mockResolvedValue([])
		const snapshot = snapshotOf('markets-gen')

		const first = await getBorrowMarketsPage(snapshot, { pageSize: '25' })
		const second = await getBorrowMarketsPage(snapshot, { page: '2', pageSize: '25' })

		expect(getEnrichedMarkets).toHaveBeenCalledTimes(1)
		expect(first).toMatchObject({ page: 1, pageSize: 25 })
		expect(second).toMatchObject({ page: 1, total: 0 })
	})

	test('prepares loops once per generation+filters and slices pages from it', async () => {
		getEnrichedLoops.mockResolvedValue([])
		const snapshot = snapshotOf('loops-gen')

		await getLoopsPage(snapshot, { pageSize: '25' })
		await getLoopsPage(snapshot, { page: '2', pageSize: '25' })
		expect(getEnrichedLoops).toHaveBeenCalledTimes(1)

		await getLoopsPage(snapshot, { minAvailable: '100' })
		expect(getEnrichedLoops).toHaveBeenCalledTimes(2)
	})
})
