import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const cacheMocks = vi.hoisted(() => ({
	getCache: vi.fn(),
	setCache: vi.fn(),
	setImmutableCache: vi.fn(),
	getObjectCache: vi.fn(),
	setObjectCache: vi.fn()
}))
const telemetryMocks = vi.hoisted(() => ({ recordRuntimeError: vi.fn() }))

vi.mock('~/utils/cache-client', () => cacheMocks)
vi.mock('~/utils/telemetry', () => telemetryMocks)

import { contentHashVersion, createRedisBlobStore, isContentHashVersion } from '../redisBlobStore.server'

const gzipAsync = promisify(gzip)

type Payload = { chain: string; snapshot: string; rows: Array<string> }

const store = createRedisBlobStore<Payload>({
	prefix: 'test-table:v1',
	versionTtlSeconds: 14_400,
	pointerTtlSeconds: 3300,
	lastGoodTtlSeconds: 86_400,
	getIdentity: (payload) => ({ key: payload.chain, version: payload.snapshot })
})

const payload: Payload = { chain: 'ethereum', snapshot: 'aK3f9Qm2xLpR7Bn0Wc-T', rows: ['a'] }

async function blobFor(value: unknown) {
	return {
		Key: 'unused',
		Body: await gzipAsync(Buffer.from(JSON.stringify(value))),
		ContentType: 'application/json+gzip'
	}
}

beforeEach(() => {
	vi.resetAllMocks()
})

describe('createRedisBlobStore publish', () => {
	test('writes blob first, then :latest, then :last-good', async () => {
		const order: Array<string> = []
		cacheMocks.setCache.mockImplementation(async ({ Key }: { Key: string }) => (order.push(Key), true))
		cacheMocks.setObjectCache.mockImplementation(async (key: string) => (order.push(key), true))

		expect(await store.publish(payload)).toBe(true)
		expect(order).toEqual([
			'test-table:v1:ethereum:aK3f9Qm2xLpR7Bn0Wc-T',
			'test-table:v1:ethereum:latest',
			'test-table:v1:ethereum:last-good'
		])
		expect(cacheMocks.setCache).toHaveBeenCalledWith(expect.anything(), 14_400)
		expect(cacheMocks.setObjectCache).toHaveBeenNthCalledWith(
			1,
			'test-table:v1:ethereum:latest',
			{ version: payload.snapshot },
			3300
		)
		expect(cacheMocks.setObjectCache).toHaveBeenNthCalledWith(
			2,
			'test-table:v1:ethereum:last-good',
			{ version: payload.snapshot },
			86_400
		)
	})

	test('touches no pointer when the blob write fails, and records the failure', async () => {
		cacheMocks.setCache.mockResolvedValue(false)

		expect(await store.publish(payload)).toBe(false)
		expect(cacheMocks.setObjectCache).not.toHaveBeenCalled()
		expect(telemetryMocks.recordRuntimeError).toHaveBeenCalledTimes(1)
	})

	test('stops after a failed :latest write so :last-good is never rolled forward past it', async () => {
		cacheMocks.setCache.mockResolvedValue(true)
		cacheMocks.setObjectCache.mockResolvedValueOnce(false)

		expect(await store.publish(payload)).toBe(false)
		expect(cacheMocks.setObjectCache).toHaveBeenCalledTimes(1)
		expect(telemetryMocks.recordRuntimeError).toHaveBeenCalledTimes(1)
	})
})

describe('createRedisBlobStore retention', () => {
	test('retains the version with the requested minimum TTL without advancing pointers', async () => {
		cacheMocks.setImmutableCache.mockResolvedValue(true)
		expect(await store.retainVersion(payload, 1800)).toBe(true)
		expect(cacheMocks.setImmutableCache).toHaveBeenCalledWith(
			expect.objectContaining({ Key: `test-table:v1:ethereum:${payload.snapshot}` }),
			1800
		)
		expect(cacheMocks.setCache).not.toHaveBeenCalled()
		expect(cacheMocks.setObjectCache).not.toHaveBeenCalled()
	})

	test('reports a failed retention', async () => {
		cacheMocks.setImmutableCache.mockResolvedValue(false)
		expect(await store.retainVersion(payload, 1800)).toBe(false)
		expect(telemetryMocks.recordRuntimeError).toHaveBeenCalledTimes(1)
	})
})

describe('createRedisBlobStore reads', () => {
	test('reads a version and verifies the payload claims the identity it was filed under', async () => {
		cacheMocks.getCache.mockResolvedValueOnce(await blobFor(payload))
		expect(await store.readVersion('ethereum', payload.snapshot)).toEqual(payload)

		cacheMocks.getCache.mockResolvedValueOnce(await blobFor({ ...payload, chain: 'base' }))
		expect(await store.readVersion('ethereum', payload.snapshot)).toBeNull()

		cacheMocks.getCache.mockResolvedValueOnce({ Key: 'k', Body: Buffer.from('not gzip'), ContentType: 'x' })
		expect(await store.readVersion('ethereum', payload.snapshot)).toBeNull()
	})

	test('resolves readCurrent through :latest and readLastGood through :last-good', async () => {
		cacheMocks.getObjectCache.mockResolvedValueOnce({ version: payload.snapshot })
		cacheMocks.getCache.mockResolvedValueOnce(await blobFor(payload))
		expect(await store.readCurrent('ethereum')).toEqual(payload)
		expect(cacheMocks.getObjectCache).toHaveBeenCalledWith('test-table:v1:ethereum:latest')

		cacheMocks.getObjectCache.mockResolvedValueOnce({ version: payload.snapshot })
		cacheMocks.getCache.mockResolvedValueOnce(await blobFor(payload))
		expect(await store.readLastGood('ethereum')).toEqual(payload)
		expect(cacheMocks.getObjectCache).toHaveBeenLastCalledWith('test-table:v1:ethereum:last-good')
	})

	test('treats an expired pointer as a miss', async () => {
		cacheMocks.getObjectCache.mockResolvedValue(null)
		expect(await store.readCurrent('ethereum')).toBeNull()
		expect(cacheMocks.getCache).not.toHaveBeenCalled()
	})
})

describe('createRedisBlobStore monotonic pointers', () => {
	const datedStore = createRedisBlobStore<Payload & { builtAt: number }>({
		prefix: 'test-table:v1',
		versionTtlSeconds: 14_400,
		pointerTtlSeconds: 3300,
		lastGoodTtlSeconds: 86_400,
		getIdentity: (value) => ({ key: value.chain, version: value.snapshot }),
		getPublishedAt: (value) => value.builtAt
	})

	test('never moves the pointer back to an older build', async () => {
		cacheMocks.setCache.mockResolvedValue(true)
		cacheMocks.setObjectCache.mockResolvedValue(true)
		cacheMocks.getObjectCache.mockResolvedValue({ version: 'newer-version-000000n', publishedAt: 2000 })

		expect(await datedStore.publish({ ...payload, builtAt: 1000 })).toBe(true)
		// blob still stored (readable by version), pointers untouched
		expect(cacheMocks.setCache).toHaveBeenCalledTimes(1)
		expect(cacheMocks.setObjectCache).not.toHaveBeenCalled()
	})

	test('advances the pointer for a newer build and stamps publishedAt', async () => {
		cacheMocks.setCache.mockResolvedValue(true)
		cacheMocks.setObjectCache.mockResolvedValue(true)
		cacheMocks.getObjectCache.mockResolvedValue({ version: 'older-version-000000o', publishedAt: 500 })

		expect(await datedStore.publish({ ...payload, builtAt: 1000 })).toBe(true)
		expect(cacheMocks.setObjectCache).toHaveBeenCalledWith(
			'test-table:v1:ethereum:latest',
			{ version: payload.snapshot, publishedAt: 1000 },
			3300
		)
	})
})

describe('contentHashVersion', () => {
	test('is deterministic, 20 chars, url-safe, and validated by isContentHashVersion', () => {
		const version = contentHashVersion(JSON.stringify([{ id: 'aave' }]))
		expect(version).toHaveLength(20)
		expect(isContentHashVersion(version)).toBe(true)
		expect(contentHashVersion(JSON.stringify([{ id: 'aave' }]))).toBe(version)
		expect(contentHashVersion('other')).not.toBe(version)
		expect(isContentHashVersion('short')).toBe(false)
		expect(isContentHashVersion('has spaces in it....')).toBe(false)
	})
})
