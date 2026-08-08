import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'

const cacheMocks = vi.hoisted(() => ({
	getCache: vi.fn(),
	setCache: vi.fn(),
	getObjectCache: vi.fn(),
	setObjectCache: vi.fn()
}))
vi.mock('~/utils/cache-client', () => cacheMocks)
vi.mock(import('~/utils/telemetry'), async (importOriginal) => ({
	...(await importOriginal()),
	recordRuntimeError: vi.fn()
}))
const upstreamMocks = vi.hoisted(() => ({
	fetchCoinGeckoTokensListFromDataset: vi.fn(),
	fetchTokenMarketsList: vi.fn()
}))
vi.mock('~/api/coingecko', () => ({
	fetchCoinGeckoTokensListFromDataset: upstreamMocks.fetchCoinGeckoTokensListFromDataset
}))
vi.mock('~/containers/Markets/server/dataset.server', () => ({
	fetchTokenMarketsList: upstreamMocks.fetchTokenMarketsList
}))
vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: { protocolMetadata: {}, tokenDirectory: {}, emissionsSupplyMetrics: {} },
	refreshMetadataInBackgroundIfStale: vi.fn()
}))

import { getTokensMarketSnapshot } from '../server/tableData.server'

const gzipAsync = promisify(gzip)
const WINDOW_MS = 5 * 60 * 1000

async function blobFor(value: unknown) {
	return {
		Key: 'k',
		Body: await gzipAsync(Buffer.from(JSON.stringify(value))),
		ContentType: 'application/json+gzip'
	}
}

function storedSnapshot(version: string, generatedAt: number) {
	return { version, generatedAt, tokens: [], markets: { last_updated: '', tokens: [] }, currentMetricsById: {} }
}

afterEach(() => {
	vi.useRealTimers()
	vi.resetAllMocks()
})

describe('getTokensMarketSnapshot window freshness', () => {
	it('serves the published snapshot while it belongs to the current wall-clock window', async () => {
		vi.useFakeTimers()
		// Distinct base time per test: the in-process cache keys on the window.
		vi.setSystemTime(new Date('2027-01-01T10:02:00.000Z'))
		const current = storedSnapshot('version-current-0001', Date.now() - 60_000)
		cacheMocks.getObjectCache.mockResolvedValue({ version: current.version, publishedAt: current.generatedAt })
		cacheMocks.getCache.mockResolvedValue(await blobFor(current))

		const snapshot = await getTokensMarketSnapshot()

		expect(snapshot.version).toBe(current.version)
		expect(upstreamMocks.fetchCoinGeckoTokensListFromDataset).not.toHaveBeenCalled()
	})

	it('rebuilds when the pointer still holds the previous window - alignment with CDN expiry', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2027-02-01T10:05:01.000Z'))
		// Published 10:04:59 - pointer TTL alive, but the window has flipped.
		const stale = storedSnapshot('version-staleee-0001', Date.now() - 2_000 - (Date.now() % WINDOW_MS))
		cacheMocks.getObjectCache.mockResolvedValue({ version: stale.version, publishedAt: stale.generatedAt })
		cacheMocks.getCache.mockResolvedValue(await blobFor(stale))
		upstreamMocks.fetchCoinGeckoTokensListFromDataset.mockResolvedValue([])
		upstreamMocks.fetchTokenMarketsList.mockResolvedValue({ last_updated: '', tokens: [] })
		cacheMocks.setCache.mockResolvedValue(true)
		cacheMocks.setObjectCache.mockResolvedValue(true)

		const snapshot = await getTokensMarketSnapshot()

		expect(upstreamMocks.fetchCoinGeckoTokensListFromDataset).toHaveBeenCalledTimes(1)
		expect(snapshot.generatedAt).toBe(Date.now())
	})

	it('adopts a concurrent winner published for this window instead of double-publishing', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2027-03-01T10:06:00.000Z'))
		const winner = storedSnapshot('version-winnerr-0001', Date.now() - 500)
		// First pointer read: nothing current. Second read (post-build): winner.
		cacheMocks.getObjectCache
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ version: winner.version, publishedAt: winner.generatedAt })
		cacheMocks.getCache.mockResolvedValue(await blobFor(winner))
		upstreamMocks.fetchCoinGeckoTokensListFromDataset.mockResolvedValue([{ id: 'own-sample' }])
		upstreamMocks.fetchTokenMarketsList.mockResolvedValue({ last_updated: '', tokens: [] })

		const snapshot = await getTokensMarketSnapshot()

		expect(snapshot.version).toBe(winner.version)
		expect(cacheMocks.setCache).not.toHaveBeenCalled()
	})
})
