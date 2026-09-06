import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
	version: 'initial',
	order: ['a', 'b', 'c', 'd'],
	price: 1,
	publish: true,
	feesAvailable: true,
	fee: 10,
	generatedAt: 1_800_000_000_000,
	writes: 0
}))
const cache = vi.hoisted(() => ({
	blobs: new Map<string, { Key: string; Body: Buffer; ContentType: string }>(),
	pointers: new Map<string, { version: string }>()
}))
vi.mock('~/utils/cache-client', () => ({
	getCache: async (key: string) => cache.blobs.get(key) ?? null,
	setCache: async (value: { Key: string; Body: Buffer; ContentType: string }) => {
		state.writes++
		if (!state.publish) return false
		cache.blobs.set(value.Key, value)
		return true
	},
	getObjectCache: async (key: string) => cache.pointers.get(key) ?? null,
	setObjectCache: async (key: string, value: { version: string }) => {
		cache.pointers.set(key, value)
		return true
	}
}))
vi.mock(import('~/server/datasetSnapshots/redisBlobStore.server'), async (importOriginal) => {
	const actual = await importOriginal()
	return { ...actual, contentHashVersion: vi.fn(actual.contentHashVersion) }
})
const metadata = await vi.hoisted(async () => {
	const { createMetadataCacheFromArtifacts, METADATA_CI_STUBS } = await import('~/utils/metadata/artifactContract')
	return createMetadataCacheFromArtifacts({
		...METADATA_CI_STUBS,
		tokenDirectory: { a: { name: 'a', symbol: 'A', route: '/token/a', token_nk: 'coingecko:a', protocolId: 'a' } }
	})
})
vi.mock('~/utils/metadata', () => ({ default: metadata, refreshMetadataInBackgroundIfStale: vi.fn() }))
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
vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainMetrics: async () => {
		if (!state.feesAvailable) throw new Error('Fees outage')
		return { protocols: [{ defillamaId: 'a', total24h: state.fee }] }
	}
}))
vi.mock('~/containers/TokenRights/server/dataset.server', () => ({ fetchTokenRightsEntries: async () => [] }))
vi.mock('~/containers/Unlocks/queries', () => ({ getAllProtocolEmissions: async () => [] }))

import { contentHashVersion } from '~/server/datasetSnapshots/redisBlobStore.server'
import { TOKENS_SOURCE_CACHE_TTL_MS } from '../cache.server'
import { getTokensPageSnapshot } from '../queries.server'
import { tokensDataset } from '../server/api'

let testNumber = 0
beforeEach(() => {
	state.version = `test-${++testNumber}`
	state.generatedAt = 1_800_000_000_000 + testNumber * 1000
	state.order = ['a', 'b', 'c', 'd']
	state.price = 1
	state.publish = true
	state.feesAvailable = true
	state.fee = 10
	state.writes = 0
	vi.mocked(contentHashVersion).mockClear()
	cache.blobs.clear()
	cache.pointers.clear()
})
afterEach(() => vi.useRealTimers())

describe('Tokens CSV snapshots', () => {
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
	test('hashes and publishes once for repeated exports of one cached dataset', async () => {
		const first = await getTokensPageSnapshot({ snapshot: 'latest' })
		for (let attempt = 0; attempt < 8; attempt++) {
			const repeated = await getTokensPageSnapshot({ snapshot: 'latest' })
			expect(repeated.data.snapshotVersion).toBe(first.data.snapshotVersion)
		}
		expect(contentHashVersion).toHaveBeenCalledTimes(1)
		expect(state.writes).toBe(1)
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
	test('does not start an export if saving its snapshot fails', async () => {
		state.price = 8
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
