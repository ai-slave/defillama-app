import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
	version: 'initial',
	enrichmentCalls: 0,
	order: ['a', 'b', 'c', 'd'],
	price: 1,
	publish: true,
	feesAvailable: true,
	fee: 10,
	generatedAt: 1_800_000_000_000
}))
const cache = vi.hoisted(() => ({
	blobs: new Map<string, { Key: string; Body: Buffer; ContentType: string }>(),
	pointers: new Map<string, { version: string }>(),
	expiresAt: new Map<string, number>()
}))
vi.mock('~/utils/cache-client', () => ({
	getCache: async (key: string) =>
		(cache.expiresAt.get(key) ?? Infinity) <= Date.now() ? null : (cache.blobs.get(key) ?? null),
	setImmutableCache: vi.fn(async (value: { Key: string; Body: Buffer; ContentType: string }, ttlSeconds: number) => {
		if (!state.publish) return false
		cache.blobs.set(value.Key, value)
		cache.expiresAt.set(value.Key, Math.max(cache.expiresAt.get(value.Key) ?? 0, Date.now() + ttlSeconds * 1000))
		return true
	}),
	setCache: async (value: { Key: string; Body: Buffer; ContentType: string }) => {
		if (!state.publish) return false
		cache.blobs.set(value.Key, value)
		return true
	},
	getObjectCache: vi.fn(async (key: string) => cache.pointers.get(key) ?? null),
	setObjectCache: async (key: string, value: { version: string }) => {
		cache.pointers.set(key, value)
		return true
	}
}))
// The market snapshot store adapter: each test controls which market generation it serves.
vi.mock('../server/tableData.server', () => ({
	getTokensMarketSnapshot: async () => ({
		version: state.version,
		generatedAt: state.generatedAt,
		markets: { last_updated: '', tokens: [] },
		currentMetricsById: {},
		tokenIndexById: new Map(),
		tokens: state.order.map((id, index) => ({
			id,
			name: id,
			symbol: id,
			market_cap: 100 - index,
			current_price: state.price
		}))
	})
}))
// Shared token rights come from the rights dataset snapshot store.
vi.mock('~/containers/TokenRights/server/dataset.server', () => ({ fetchTokenRightsEntries: async () => [] }))

import { clearResultCache } from '~/server/api/resultCache'
import { getObjectCache, setImmutableCache } from '~/utils/cache-client'
import { createMetadataCacheFromArtifacts, METADATA_CI_STUBS } from '~/utils/metadata/artifactContract'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { installMetadataSeeder } from '~/utils/test/metadataCache'
import { TOKENS_SOURCE_CACHE_TTL_MS } from '../cache.server'
import { getTokensPageSnapshot } from '../queries.server'
import { tokensDataset } from '../server/api'

const metadata = createMetadataCacheFromArtifacts({
	...METADATA_CI_STUBS,
	tokenDirectory: { a: { name: 'a', symbol: 'A', route: '/token/a', token_nk: 'coingecko:a', protocolId: 'a' } }
})
const http = installFixtureFetch()
const metadataSeeder = installMetadataSeeder()

let testNumber = 0
beforeEach(() => {
	vi.stubEnv('NODE_ENV', 'development')
	vi.stubEnv('API_KEY', '')
	metadataSeeder.seed(metadata)
	http.serve({
		// Fees, revenue and holders revenue: one request each per enrichment.
		'/v2/metrics/fees': () => {
			state.enrichmentCalls++
			if (!state.feesAvailable) return new Response(null, { status: 503 })
			return { protocols: [{ defillamaId: 'a', total24h: state.fee }] }
		},
		'/emissions': []
	})
	state.version = `test-${++testNumber}`
	state.generatedAt = 1_800_000_000_000 + testNumber * 1000
	state.order = ['a', 'b', 'c', 'd']
	state.price = 1
	// Every test, and every clearResultCache() inside one, starts a cold runtime: an empty
	// in-process result cache over the same Redis.
	clearResultCache()
	state.enrichmentCalls = 0
	state.publish = true
	state.feesAvailable = true
	state.fee = 10
	vi.mocked(setImmutableCache).mockClear()
	vi.mocked(getObjectCache).mockClear()
	cache.expiresAt.clear()
	cache.blobs.clear()
	cache.pointers.clear()
})
afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllEnvs()
})

describe('Tokens CSV snapshots', () => {
	test('reuses prepared rows across cold runtimes for search and clearing search', async () => {
		state.order = ['dogwifhat', 'bitcoin', 'wif-second']
		await getTokensPageSnapshot()
		expect(state.enrichmentCalls).toBe(3)
		clearResultCache()
		const search = await getTokensPageSnapshot({ search: ' WIF ' })
		expect(search.data.rows.map((row) => row.id)).toEqual(['dogwifhat', 'wif-second'])
		const cleared = await getTokensPageSnapshot()
		expect(cleared.data.total).toBe(3)
		expect(state.enrichmentCalls).toBe(3)
	})

	test('rebuilds shared rows in a new window on a cold runtime', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		await getTokensPageSnapshot()
		clearResultCache()
		state.fee = 25
		vi.setSystemTime(Date.now() + TOKENS_SOURCE_CACHE_TTL_MS + 1)
		const refreshed = await getTokensPageSnapshot({ search: 'a' })
		expect(refreshed.data.rows[0]?.fees24h).toBe(25)
		expect(state.enrichmentCalls).toBe(6)
	})

	test('adopts a concurrent publication after enrichment without publishing again', async () => {
		await getTokensPageSnapshot()
		clearResultCache()
		state.fee = 25
		// The first read misses; the published winner becomes visible on the post-build read.
		vi.mocked(getObjectCache).mockResolvedValueOnce(null)
		const result = await getTokensPageSnapshot({ search: 'a' })
		expect(result.data.rows[0]?.fees24h).toBe(10)
		expect(state.enrichmentCalls).toBe(6)
		expect(vi.mocked(setImmutableCache).mock.calls.map(([, ttl]) => ttl)).toEqual([10 * 60])
	})

	test('keeps browsing available when shared cache writes fail', async () => {
		state.publish = false
		const result = await getTokensPageSnapshot({ search: 'a' })
		expect(result.data.rows.map((row) => row.id)).toEqual(['a'])
		expect(cache.pointers.size).toBe(0)
	})

	test('preserves membership, ranking and values across pages while ordinary browsing refreshes', async () => {
		const first = await getTokensPageSnapshot({ snapshot: 'latest', pageSize: '2' })
		const snapshot = first.data.snapshotVersion
		if (!snapshot) throw new Error('Expected saved export version')
		expect(first.data.rows.map((row) => row.id)).toEqual(['a', 'b'])
		state.version += '-updated'
		state.order = ['a', 'c', 'b', 'd']
		state.price = 9
		const fresh = await getTokensPageSnapshot({ pageSize: '2' })
		expect(fresh.data.rows.map((row) => row.id)).toEqual(['a', 'c'])
		expect(fresh.data.rows[0]?.price).toBe(9)
		const second = await getTokensPageSnapshot({ snapshot, page: '2', pageSize: '2' })
		expect(second.data.rows.map((row) => row.id)).toEqual(['c', 'd'])
		expect(second.data.rows.map((row) => row.price)).toEqual([1, 1])
		expect(second.data.snapshotVersion).toBe(snapshot)
	})
	test('stores one blob for browsing and exports and preserves the export lease on later source writes', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2027-01-01T10:00:00Z'))
		await getTokensPageSnapshot()
		expect(cache.blobs.size).toBe(1)
		const [key] = cache.blobs.keys()
		if (!key) throw new Error('Expected source blob')
		expect(cache.expiresAt.get(key)).toBe(Date.now() + 10 * 60_000)

		vi.setSystemTime(Date.now() + 4 * 60_000)
		const exported = await getTokensPageSnapshot({ snapshot: 'latest' })
		const snapshot = exported.data.snapshotVersion!
		const exportExpiresAt = cache.expiresAt.get(key)!
		expect(exportExpiresAt).toBe(Date.now() + 31 * 60_000)
		expect(cache.blobs.size).toBe(1)

		// An export inside the publication-cache minute still gets at least 30 minutes.
		vi.setSystemTime(Date.now() + 59_000)
		await getTokensPageSnapshot({ snapshot: 'latest' })
		expect(exportExpiresAt - Date.now()).toBeGreaterThanOrEqual(30 * 60_000)
		expect(vi.mocked(setImmutableCache).mock.calls.map(([, ttl]) => ttl)).toEqual([10 * 60, 31 * 60])

		vi.setSystemTime(Date.now() + 1000)
		clearResultCache()
		await getTokensPageSnapshot()
		expect(vi.mocked(setImmutableCache).mock.calls.map(([, ttl]) => ttl)).toEqual([10 * 60, 31 * 60, 10 * 60])
		expect(cache.blobs.size).toBe(1)
		expect(cache.expiresAt.get(key)).toBe(exportExpiresAt)

		vi.setSystemTime(exportExpiresAt - 1)
		expect((await getTokensPageSnapshot({ snapshot })).data.rows).toEqual(exported.data.rows)
	})

	test('changes the export identity when enrichment or availability changes with identical market inputs', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		const first = await getTokensPageSnapshot({ snapshot: 'latest' })
		expect(first.data.rows[0]?.fees24h).toBe(10)
		state.fee = 20
		vi.setSystemTime(Date.now() + TOKENS_SOURCE_CACHE_TTL_MS + 1)
		const changed = await getTokensPageSnapshot({ snapshot: 'latest' })
		expect(changed.data.rows[0]?.fees24h).toBe(20)
		expect(changed.data.snapshotVersion).not.toBe(first.data.snapshotVersion)
		state.feesAvailable = false
		vi.setSystemTime(Date.now() + TOKENS_SOURCE_CACHE_TTL_MS + 1)
		const unavailable = await getTokensPageSnapshot({ snapshot: 'latest' })
		expect(unavailable.data.unavailableSources).toContain('fees')
		expect(unavailable.data.snapshotVersion).not.toBe(changed.data.snapshotVersion)
	})
	test('includes refreshed route metadata in the identity even when rankings are unchanged', async () => {
		const record = metadata.tokenDirectory.a
		if (!record) throw new Error('Missing token metadata fixture')
		const first = await getTokensPageSnapshot({ snapshot: 'latest' })
		expect(first.data.rows[0]?.href).toBe('/token/a')
		try {
			record.route = '/token/a-updated'
			metadata.tokenFilterMetadata.generatedAt++
			const changed = await getTokensPageSnapshot({ snapshot: 'latest' })
			expect(changed.data.rows[0]?.href).toBe('/token/a-updated')
			expect(changed.data.snapshotVersion).not.toBe(first.data.snapshotVersion)
		} finally {
			record.route = '/token/a'
			metadata.tokenFilterMetadata.generatedAt++
		}
	})
	test('fails explicitly when a pinned version is gone', async () => {
		await expect(getTokensPageSnapshot({ snapshot: 'missing-1234567890123' })).rejects.toThrow(
			'snapshot is unavailable'
		)
	})
	test('does not start an export if retaining the existing source blob fails', async () => {
		state.price = 8
		await getTokensPageSnapshot()
		state.publish = false
		await expect(getTokensPageSnapshot({ snapshot: 'latest' })).rejects.toThrow('snapshot is unavailable')
	})
	test('does not call missing or unreadable storage expired, and keeps failures out of response caches', async () => {
		const request = { method: 'GET', url: '/api/public/tokens', headers: {} }
		const missing = '00000000000000000000'
		const unreadable = '11111111111111111111'
		const key = `tokens-export:v15:all:${unreadable}`
		cache.blobs.set(key, { Key: key, Body: Buffer.from('not gzip'), ContentType: 'application/json+gzip' })
		for (const snapshot of [missing, unreadable]) {
			const response = await tokensDataset.handle({ ...request, query: { snapshot } })
			expect(response).toMatchObject({ status: 503, headers: { 'Cache-Control': 'private, no-store' } })
			expect(response).toMatchObject({
				body: { error: 'Tokens export snapshot is unavailable. Please retry the export.' }
			})
		}
		expect((await tokensDataset.handle({ ...request, query: { snapshot: '../invalid' } })).status).toBe(400)
		expect((await tokensDataset.handle({ ...request, query: { snapshot: ['latest', 'other'] } })).status).toBe(400)
	})
})
