import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installTelemetrySink } from '~/utils/test/telemetry'

// In-memory Redis stand-in: `entries` is what readers would observe, `failing` makes one key's write fail.
const redis = vi.hoisted(() => {
	const entries = new Map<string, { value: unknown; ttl: number }>()
	const failing = new Set<string>()
	const write = (key: string, value: unknown, ttl: number) => {
		if (failing.has(key)) return false
		entries.set(key, { value, ttl })
		return true
	}
	return {
		entries,
		failing,
		module: {
			getCache: async (key: string) => entries.get(key)?.value ?? null,
			setCache: async (blob: { Key: string }, ttl: number) => write(blob.Key, blob, ttl),
			setImmutableCache: async (blob: { Key: string }, ttl: number) =>
				write(blob.Key, blob, Math.max(ttl, entries.get(blob.Key)?.ttl ?? 0)),
			getObjectCache: async (key: string) => entries.get(key)?.value ?? null,
			setObjectCache: async (key: string, value: unknown, ttl: number) => write(key, value, ttl)
		}
	}
})
vi.mock('~/utils/cache-client', () => redis.module)

import { contentHashVersion, createRedisBlobStore, isContentHashVersion } from '../redisBlobStore.server'

const telemetry = installTelemetrySink()

type Payload = { chain: string; snapshot: string; rows: Array<string>; builtAt?: number }

const config = {
	prefix: 'test-table:v1',
	versionTtlSeconds: 14_400,
	pointerTtlSeconds: 3300,
	lastGoodTtlSeconds: 86_400,
	getIdentity: (payload: Payload) => ({ key: payload.chain, version: payload.snapshot })
}
const store = createRedisBlobStore<Payload>(config)
const datedStore = createRedisBlobStore<Payload>({ ...config, getPublishedAt: (payload) => payload.builtAt! })

const v1: Payload = { chain: 'ethereum', snapshot: 'aK3f9Qm2xLpR7Bn0Wc-T', rows: ['a'] }
const v2: Payload = { chain: 'ethereum', snapshot: 'bK3f9Qm2xLpR7Bn0Wc-T', rows: ['b'] }

async function runtimeErrors() {
	return (await telemetry.events()).filter((event) => event.type === 'runtime_error').length
}

beforeEach(() => {
	redis.entries.clear()
	redis.failing.clear()
})

describe('publish', () => {
	test('makes the payload readable as current and last-good with each key’s TTL', async () => {
		expect(await store.publish(v1)).toBe(true)
		expect(await store.readCurrent('ethereum')).toEqual(v1)
		expect(await store.readLastGood('ethereum')).toEqual(v1)
		expect([...redis.entries].map(([key, entry]) => [key, entry.ttl])).toEqual([
			['test-table:v1:ethereum:aK3f9Qm2xLpR7Bn0Wc-T', 14_400],
			['test-table:v1:ethereum:latest', 3300],
			['test-table:v1:ethereum:last-good', 86_400]
		])
	})

	test('a failed blob write leaves both pointers on the previous version', async () => {
		await store.publish(v1)
		redis.failing.add('test-table:v1:ethereum:bK3f9Qm2xLpR7Bn0Wc-T')

		expect(await store.publish(v2)).toBe(false)
		expect(await store.readCurrent('ethereum')).toEqual(v1)
		expect(await store.readLastGood('ethereum')).toEqual(v1)
		expect(await runtimeErrors()).toBe(1)
	})

	test('a failed :latest write never rolls :last-good forward', async () => {
		await store.publish(v1)
		redis.failing.add('test-table:v1:ethereum:latest')

		expect(await store.publish(v2)).toBe(false)
		expect(await store.readLastGood('ethereum')).toEqual(v1)
		expect(await store.readVersion('ethereum', v2.snapshot)).toEqual(v2)
		expect(await runtimeErrors()).toBe(1)
	})

	test('an older build keeps readers on the newer one but stays readable by version', async () => {
		await datedStore.publish({ ...v2, builtAt: 2000 })

		expect(await datedStore.publish({ ...v1, builtAt: 1000 })).toBe(true)
		expect(await datedStore.readCurrent('ethereum')).toEqual({ ...v2, builtAt: 2000 })
		expect(await datedStore.readVersion('ethereum', v1.snapshot)).toEqual({ ...v1, builtAt: 1000 })
	})

	test('a newer build advances readers, and a build older than it cannot replace it', async () => {
		await datedStore.publish({ ...v1, builtAt: 500 })

		expect(await datedStore.publish({ ...v2, builtAt: 1000 })).toBe(true)
		expect(await datedStore.readCurrent('ethereum')).toEqual({ ...v2, builtAt: 1000 })
		await datedStore.publish({ ...v1, builtAt: 750 })
		expect(await datedStore.readCurrent('ethereum')).toEqual({ ...v2, builtAt: 1000 })
	})
})

describe('retainVersion', () => {
	test('stores the version with at least the requested TTL without moving pointers', async () => {
		await store.publish(v1)

		expect(await store.retainVersion(v2, 1800)).toBe(true)
		expect(await store.readVersion('ethereum', v2.snapshot)).toEqual(v2)
		expect(redis.entries.get(`test-table:v1:ethereum:${v2.snapshot}`)?.ttl).toBe(1800)
		expect(await store.readCurrent('ethereum')).toEqual(v1)
	})

	test('reports a failed retention', async () => {
		redis.failing.add(`test-table:v1:ethereum:${v1.snapshot}`)
		expect(await store.retainVersion(v1, 1800)).toBe(false)
		expect(await runtimeErrors()).toBe(1)
	})
})

describe('reads', () => {
	test('rejects a blob whose payload claims a different identity, and unreadable bytes', async () => {
		await store.publish({ ...v1, chain: 'base' })
		const baseBlob = redis.entries.get(`test-table:v1:base:${v1.snapshot}`)!
		redis.entries.set(`test-table:v1:ethereum:${v1.snapshot}`, baseBlob)
		expect(await store.readVersion('ethereum', v1.snapshot)).toBeNull()

		redis.entries.set(`test-table:v1:ethereum:${v2.snapshot}`, {
			value: { Key: 'k', Body: Buffer.from('not gzip'), ContentType: 'x' },
			ttl: 1
		})
		expect(await store.readVersion('ethereum', v2.snapshot)).toBeNull()
	})

	test('an expired :latest pointer is a miss even when the blob remains', async () => {
		await store.publish(v1)
		redis.entries.delete('test-table:v1:ethereum:latest')
		expect(await store.readCurrent('ethereum')).toBeNull()
		expect(await store.readLastGood('ethereum')).toEqual(v1)
	})
})

test('contentHashVersion is a deterministic 20-char url-safe token that isContentHashVersion accepts', () => {
	const version = contentHashVersion(JSON.stringify([{ id: 'aave' }]))
	expect(version).toMatch(/^[A-Za-z0-9_-]{20}$/)
	expect(isContentHashVersion(version)).toBe(true)
	expect(contentHashVersion(JSON.stringify([{ id: 'aave' }]))).toBe(version)
	expect(contentHashVersion('other')).not.toBe(version)
	expect(isContentHashVersion('short')).toBe(false)
	expect(isContentHashVersion('has spaces in it....')).toBe(false)
})
