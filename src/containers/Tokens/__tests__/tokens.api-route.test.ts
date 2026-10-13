import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import handler from '~/pages/api/public/tokens'
import marketMapHandler from '~/pages/api/public/tokens/market-map'
import { hydrateMetadataCache, METADATA_CI_STUBS } from '~/utils/metadata/artifactContract'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

vi.mock('~/containers/Markets/server/dataset.server', () => ({
	fetchTokenMarketSummaries: async () => ({})
}))
vi.mock('~/containers/TokenRights/server/dataset.server', () => ({ fetchTokenRightsEntries: async () => [] }))
// An empty Redis: every snapshot read misses and every write succeeds.
vi.mock('~/utils/cache-client', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/cache-client')>()),
	getCache: async () => null,
	getObjectCache: async () => null,
	setCache: async () => true,
	setImmutableCache: async () => true,
	setObjectCache: async () => true
}))
const http = installFixtureFetch()
const metadata = installMetadataSeeder()
const tokens: Array<IResponseCGTokenRankingsDatasetItem> = [
	{ id: 'sample-a', name: 'Sample A', symbol: 'A', market_cap: 300, current_price: 3 },
	{ id: 'sample-b', name: 'Sample B', symbol: 'B', market_cap: 200, current_price: 2 },
	{ id: 'sample-c', name: 'Sample C', symbol: 'C', market_cap: 100, current_price: 1 },
	{ id: 'unrelated', name: 'Unrelated', symbol: 'U', market_cap: 400, current_price: 4 }
]
beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime('2027-05-01T10:02:00Z')
	vi.stubEnv('NODE_ENV', 'development')
	vi.stubEnv('API_KEY', '')
	metadata.seed(hydrateMetadataCache(METADATA_CI_STUBS))
	http.serve({ '/tokenlist/rankings.json': tokens, '/v2/metrics/fees': { protocols: [] }, '/emissions': [] })
})
afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllEnvs()
})

describe('tokens HTTP routes', () => {
	test('filters before pagination and expires the CDN response at the window boundary', async () => {
		const res = createMockNextApiResponse()
		await handler(
			createMockNextApiRequest({ method: 'GET', query: { page: '2', pageSize: '2', search: 'sample' } }),
			res
		)
		expect(res.statusCode).toBe(200)
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({
				page: 2,
				pageSize: 2,
				total: 3,
				hasMore: false,
				rows: [expect.objectContaining({ id: 'sample-c', price: 1, marketCap: 100, rowNumber: 3 })]
			})
		)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=180, must-revalidate')
	})
	test('serves the same filtered market values through the market map route', async () => {
		const res = createMockNextApiResponse()
		await marketMapHandler(createMockNextApiRequest({ method: 'GET', query: { search: 'sample' } }), res)
		expect(res.statusCode).toBe(200)
		expect(res.json).toHaveBeenCalledWith(
			expect.objectContaining({ names: ['Sample A', 'Sample B', 'Sample C'], marketCaps: [300, 200, 100] })
		)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=180, must-revalidate')
	})
	test('rejects malformed snapshot identities before source loading', async () => {
		const res = createMockNextApiResponse()
		await handler(createMockNextApiRequest({ method: 'GET', query: { snapshot: '../bad' } }), res)
		expect(res.statusCode).toBe(400)
		expect(http.requests).toHaveLength(0)
	})
	test('returns an uncached retryable error when an immutable export has expired', async () => {
		const res = createMockNextApiResponse()
		await handler(createMockNextApiRequest({ method: 'GET', query: { snapshot: 'abcdefghijklmnopqrst' } }), res)
		expect(res.statusCode).toBe(503)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(http.requests).toHaveLength(0)
	})
})
