import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
	enrichmentCalls: 0,
	order: ['a', 'b', 'c', 'd'],
	price: 1,
	writable: true,
	marketsUp: true,
	feesAvailable: true,
	fee: 10,
	// Runs once inside the next fees request, as another runtime finishing first would.
	duringEnrichment: null as (() => void) | null
}))
// Shared Redis: blobs and pointers both expire on the (fake) clock.
const redis = vi.hoisted(() => ({
	entries: new Map<string, { value: unknown; expiresAt: number }>(),
	read(key: string) {
		const entry = this.entries.get(key)
		return entry && entry.expiresAt > Date.now() ? entry.value : null
	},
	write(key: string, value: unknown, ttlSeconds: number) {
		if (!state.writable) return false
		this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
		return true
	}
}))
vi.mock('~/utils/cache-client', () => ({
	getCache: async (key: string) => redis.read(key),
	setCache: async (value: { Key: string }, ttlSeconds: number) => redis.write(value.Key, value, ttlSeconds),
	// Retaining never shortens a blob's existing lifetime.
	setImmutableCache: async (value: { Key: string }, ttlSeconds: number) => {
		if (!state.writable) return false
		const existing = redis.entries.get(value.Key)?.expiresAt ?? 0
		redis.entries.set(value.Key, { value, expiresAt: Math.max(existing, Date.now() + ttlSeconds * 1000) })
		return true
	},
	getObjectCache: async (key: string) => redis.read(key),
	setObjectCache: async (key: string, value: unknown, ttlSeconds: number) => redis.write(key, value, ttlSeconds)
}))
vi.mock('~/containers/Markets/server/dataset.server', () => ({
	fetchTokenMarketsList: async () => ({ last_updated: '', tokens: [] })
}))
vi.mock('~/containers/TokenRights/server/dataset.server', () => ({ fetchTokenRightsEntries: async () => [] }))

import { clearResultCache } from '~/server/api/resultCache'
import { hydrateMetadataCache, METADATA_CI_STUBS } from '~/utils/metadata/artifactContract'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { TOKENS_SOURCE_CACHE_TTL_MS } from '../cache.server'
import { getTokensPageSnapshot } from '../queries.server'
import { tokensDataset } from '../server/api'

const metadata = hydrateMetadataCache({
	...METADATA_CI_STUBS,
	tokenDirectory: { a: { name: 'a', symbol: 'A', route: '/token/a', token_nk: 'coingecko:a', protocolId: 'a' } }
})
const http = installFixtureFetch()
const metadataSeeder = installMetadataSeeder()
const MINUTE = 60_000

/** A runtime that starts cold: an empty in-process result cache over the same Redis. */
function coldRuntime() {
	clearResultCache()
}
function advance(ms: number) {
	vi.setSystemTime(Date.now() + ms)
}
const sourcePointers = () => [...redis.entries.keys()].filter((key) => key.startsWith('tokens-source:'))

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	// The start of a five-minute window, so each test chooses when the window flips.
	vi.setSystemTime(new Date('2027-01-01T10:00:00Z'))
	vi.stubEnv('NODE_ENV', 'development')
	vi.stubEnv('API_KEY', '')
	metadataSeeder.seed(metadata)
	http.serve({
		'/tokenlist/rankings.json': () =>
			state.marketsUp
				? state.order.map((id, index) => ({
						id,
						name: id,
						symbol: id,
						market_cap: 100 - index,
						current_price: state.price
					}))
				: fixtureStatus(404)(),
		// Fees, revenue and holders revenue: one request each per enrichment.
		'/v2/metrics/fees': () => {
			state.enrichmentCalls++
			state.duringEnrichment?.()
			state.duringEnrichment = null
			if (!state.feesAvailable) return new Response(null, { status: 503 })
			return { protocols: [{ defillamaId: 'a', total24h: state.fee }] }
		},
		'/emissions': []
	})
	coldRuntime()
	redis.entries.clear()
	Object.assign(state, {
		enrichmentCalls: 0,
		order: ['a', 'b', 'c', 'd'],
		price: 1,
		writable: true,
		marketsUp: true,
		feesAvailable: true,
		fee: 10,
		duringEnrichment: null
	})
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
		coldRuntime()
		const search = await getTokensPageSnapshot({ search: ' WIF ' })
		expect(search.data.rows.map((row) => row.id)).toEqual(['dogwifhat', 'wif-second'])
		const cleared = await getTokensPageSnapshot()
		expect(cleared.data.total).toBe(3)
		expect(state.enrichmentCalls).toBe(3)
	})

	test('rebuilds shared rows in a new window on a cold runtime', async () => {
		await getTokensPageSnapshot()
		coldRuntime()
		state.fee = 25
		advance(TOKENS_SOURCE_CACHE_TTL_MS + 1)
		const refreshed = await getTokensPageSnapshot({ search: 'a' })
		expect(refreshed.data.rows[0]?.fees24h).toBe(25)
		expect(state.enrichmentCalls).toBe(6)
	})

	test('adopts a concurrent publication after enrichment, and later runtimes keep reading it', async () => {
		await getTokensPageSnapshot()
		// This runtime misses the rows pointer, and another runtime publishes its rows while this one enriches.
		const [pointer] = sourcePointers()
		const published = redis.entries.get(pointer!)!
		redis.entries.delete(pointer!)
		state.duringEnrichment = () => redis.entries.set(pointer!, published)
		coldRuntime()
		state.fee = 25
		const result = await getTokensPageSnapshot({ search: 'a' })
		expect(result.data.rows[0]?.fees24h).toBe(10)
		expect(state.enrichmentCalls).toBe(6)

		coldRuntime()
		state.fee = 40
		expect((await getTokensPageSnapshot({ search: 'a' })).data.rows[0]?.fees24h).toBe(10)
		expect(state.enrichmentCalls).toBe(6)
	})

	test('keeps browsing available when shared cache writes fail', async () => {
		state.writable = false
		const result = await getTokensPageSnapshot({ search: 'a' })
		expect(result.data.rows.map((row) => row.id)).toEqual(['a'])
	})

	test('preserves membership, ranking and values across pages while browsing moves to a new market generation', async () => {
		const first = await getTokensPageSnapshot({ snapshot: 'latest', pageSize: '2' })
		const snapshot = first.data.snapshotVersion
		if (!snapshot) throw new Error('Expected saved export version')
		expect(first.data.rows.map((row) => row.id)).toEqual(['a', 'b'])
		state.order = ['a', 'c', 'b', 'd']
		state.price = 9
		advance(TOKENS_SOURCE_CACHE_TTL_MS)
		const fresh = await getTokensPageSnapshot({ pageSize: '2' })
		expect(fresh.data.rows.map((row) => row.id)).toEqual(['a', 'c'])
		expect(fresh.data.rows[0]?.price).toBe(9)
		const second = await getTokensPageSnapshot({ snapshot, page: '2', pageSize: '2' })
		expect(second.data.rows.map((row) => row.id)).toEqual(['c', 'd'])
		expect(second.data.rows.map((row) => row.price)).toEqual([1, 1])
		expect(second.data.snapshotVersion).toBe(snapshot)
	})

	test('keeps a pinned export readable for 30 minutes after its last export, even when browsing saves the same rows again', async () => {
		await getTokensPageSnapshot()
		advance(MINUTE)
		const exported = await getTokensPageSnapshot({ snapshot: 'latest' })
		const snapshot = exported.data.snapshotVersion!
		// A second export inside the one-minute publication cache.
		advance(59_000)
		expect((await getTokensPageSnapshot({ snapshot: 'latest' })).data.snapshotVersion).toBe(snapshot)
		const lastExportAt = Date.now()

		// A runtime that misses the rows pointer re-saves the same rows for browsing's shorter lifetime.
		redis.entries.delete(sourcePointers()[0]!)
		coldRuntime()
		await getTokensPageSnapshot()
		expect(state.enrichmentCalls).toBe(6)

		vi.setSystemTime(lastExportAt + 30 * MINUTE)
		coldRuntime()
		expect((await getTokensPageSnapshot({ snapshot })).data.rows).toEqual(exported.data.rows)
	})

	test('changes the export identity when enrichment or availability changes over the same market snapshot', async () => {
		const first = await getTokensPageSnapshot({ snapshot: 'latest' })
		expect(first.data.rows[0]?.fees24h).toBe(10)
		// The market upstream is down, so every later window reuses the last good market snapshot.
		state.marketsUp = false
		state.fee = 20
		advance(TOKENS_SOURCE_CACHE_TTL_MS)
		const changed = await getTokensPageSnapshot({ snapshot: 'latest' })
		expect(changed.data.rows[0]?.fees24h).toBe(20)
		expect(changed.data.snapshotVersion).not.toBe(first.data.snapshotVersion)
		state.feesAvailable = false
		advance(TOKENS_SOURCE_CACHE_TTL_MS)
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
		await getTokensPageSnapshot()
		state.writable = false
		await expect(getTokensPageSnapshot({ snapshot: 'latest' })).rejects.toThrow('snapshot is unavailable')
	})

	test('does not call missing or unreadable storage expired, and keeps failures out of response caches', async () => {
		const request = { method: 'GET', url: '/api/public/tokens', headers: {} }
		const missing = '00000000000000000000'
		const unreadable = '11111111111111111111'
		const key = `tokens-export:v15:all:${unreadable}`
		redis.write(key, { Key: key, Body: Buffer.from('not gzip'), ContentType: 'application/json+gzip' }, 600)
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
