import { promisify } from 'node:util'
import { gzip, gunzip } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import type { SharedTokensMarketSnapshot } from '../server/tableData.server'

const cacheMocks = vi.hoisted(() => ({
	getCache: vi.fn(),
	setCache: vi.fn(),
	getObjectCache: vi.fn(),
	setObjectCache: vi.fn()
}))
vi.mock('~/utils/cache-client', () => cacheMocks)
const upstreamMocks = vi.hoisted(() => ({
	fetchTokenMarketSummaries: vi.fn()
}))
vi.mock('~/containers/Markets/server/dataset.server', () => ({
	fetchTokenMarketSummaries: upstreamMocks.fetchTokenMarketSummaries
}))
import { getTokensMarketSnapshot } from '../server/tableData.server'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)
const published = new Map<string, unknown>()
const http = installFixtureFetch()
const metadata = installMetadataSeeder()
beforeEach(() => {
	published.clear()
	cacheMocks.setCache.mockImplementation(async (payload: { Key: string; Body: Buffer }) => {
		published.set(payload.Key, payload.Body)
		return true
	})
	cacheMocks.setObjectCache.mockImplementation(async (key: string, body: unknown) => {
		published.set(key, body)
		return true
	})
	// Keep seeded metadata stable while advancing the clock across cache windows.
	vi.stubEnv('NODE_ENV', 'development')
	vi.stubEnv('API_KEY', '')
	metadata.seed({ protocolMetadata: {}, tokenDirectory: {}, emissionsSupplyMetrics: {} })
})

const WINDOW_MS = 5 * 60 * 1000

async function blobFor(value: unknown) {
	return {
		Key: 'k',
		Body: await gzipAsync(Buffer.from(JSON.stringify(value))),
		ContentType: 'application/json+gzip'
	}
}

function storedSnapshot(version: string, generatedAt: number): SharedTokensMarketSnapshot {
	return {
		version,
		generatedAt,
		tokens: [],
		markets: {},
		currentMetricsById: {}
	}
}

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllEnvs()
	vi.resetAllMocks()
})

describe('getTokensMarketSnapshot window freshness', () => {
	test('serves the published snapshot while it belongs to the current wall-clock window', async () => {
		vi.useFakeTimers()
		// Distinct base time per test: the in-process cache keys on the window.
		vi.setSystemTime(new Date('2027-01-01T10:02:00.000Z'))
		const current = storedSnapshot('version-current-0001', Date.now() - 60_000)
		cacheMocks.getObjectCache.mockResolvedValue({ version: current.version, publishedAt: current.generatedAt })
		cacheMocks.getCache.mockResolvedValue(await blobFor(current))

		const snapshot = await getTokensMarketSnapshot()

		expect(snapshot.version).toBe(current.version)
		expect(http.requests).toHaveLength(0)
	})

	test('rebuilds when the pointer still holds the previous window - alignment with CDN expiry', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2027-02-01T10:05:01.000Z'))
		// Published 10:04:59 - pointer TTL alive, but the window has flipped.
		const stale = storedSnapshot('version-staleee-0001', Date.now() - 2000 - (Date.now() % WINDOW_MS))
		cacheMocks.getObjectCache.mockResolvedValue({ version: stale.version, publishedAt: stale.generatedAt })
		cacheMocks.getCache.mockResolvedValue(await blobFor(stale))
		http.serve({ '/tokenlist/rankings.json': [] })
		upstreamMocks.fetchTokenMarketSummaries.mockResolvedValue({})

		const snapshot = await getTokensMarketSnapshot()

		expect(http.requests).toHaveLength(1)
		expect(snapshot.generatedAt).toBe(Date.now())
		expect(published.get('tokens-market:v5:all:latest')).toMatchObject({ version: snapshot.version })
	})

	test('adopts a concurrent winner published for this window instead of double-publishing', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2027-03-01T10:06:00.000Z'))
		const winner = storedSnapshot('version-winnerr-0001', Date.now() - 500)
		// First pointer read: nothing current. Second read (post-build): winner.
		cacheMocks.getObjectCache
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ version: winner.version, publishedAt: winner.generatedAt })
		const winnerBlob = await blobFor(winner)
		published.set('tokens-market:v5:all:latest', { version: winner.version, publishedAt: winner.generatedAt })
		published.set(`tokens-market:v5:all:${winner.version}`, winnerBlob.Body)
		const existing = new Map(published)
		cacheMocks.getCache.mockResolvedValue(winnerBlob)
		http.serve({ '/tokenlist/rankings.json': [{ id: 'own-sample', name: 'Own Sample', symbol: 'own' }] })
		upstreamMocks.fetchTokenMarketSummaries.mockResolvedValue({})

		const snapshot = await getTokensMarketSnapshot()

		expect(snapshot.version).toBe(winner.version)
		expect(published).toEqual(existing)
	})
	test('keeps an outage null and does not reinterpret an old flag-based empty snapshot', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2027-04-01T10:02:00.000Z'))
		const old = { ...storedSnapshot('old-market-0000000001', Date.now()), marketsAvailable: false }
		cacheMocks.getObjectCache.mockImplementation(async (key: string) =>
			key.startsWith('tokens-market:v3:') ? { version: old.version } : null
		)
		cacheMocks.getCache.mockResolvedValue(await blobFor(old))
		http.serve({ '/tokenlist/rankings.json': [] })
		upstreamMocks.fetchTokenMarketSummaries.mockRejectedValue(new Error('Markets unavailable'))
		const snapshot = await getTokensMarketSnapshot()
		expect(snapshot.markets).toBeNull()
		expect(snapshot.version).not.toBe(old.version)
		const saved = published.get(`tokens-market:v5:all:${snapshot.version}`) as Buffer
		expect(JSON.parse((await gunzipAsync(saved)).toString()).markets).toBeNull()
	})
})
