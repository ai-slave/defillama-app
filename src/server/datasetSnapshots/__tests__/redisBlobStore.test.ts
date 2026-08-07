import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cacheMocks = vi.hoisted(() => ({
	getCache: vi.fn(),
	setCache: vi.fn(),
	getObjectCache: vi.fn(),
	setObjectCache: vi.fn()
}))
const telemetryMocks = vi.hoisted(() => ({ recordRuntimeError: vi.fn() }))

vi.mock('~/utils/cache-client', () => cacheMocks)
vi.mock('~/utils/telemetry', () => telemetryMocks)

import { contentHashVersion, createRedisBlobStore, isContentHashVersion } from '../redisBlobStore.server'

const gzipAsync = promisify(gzip)

type Payload = { chain: string; snapshot: string; rows: string[] }

const store = createRedisBlobStore<Payload>({
	prefix: 'test-table:v1',
	versionTtlSeconds: 14_400,
	pointerTtlSeconds: 3_300,
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
	it('writes blob first, then :latest, then :last-good', async () => {
		const order: string[] = []
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
			3_300
		)
		expect(cacheMocks.setObjectCache).toHaveBeenNthCalledWith(
			2,
			'test-table:v1:ethereum:last-good',
			{ version: payload.snapshot },
			86_400
		)
	})

	it('touches no pointer when the blob write fails, and records the failure', async () => {
		cacheMocks.setCache.mockResolvedValue(false)

		expect(await store.publish(payload)).toBe(false)
		expect(cacheMocks.setObjectCache).not.toHaveBeenCalled()
		expect(telemetryMocks.recordRuntimeError).toHaveBeenCalledTimes(1)
	})

	it('stops after a failed :latest write so :last-good is never rolled forward past it', async () => {
		cacheMocks.setCache.mockResolvedValue(true)
		cacheMocks.setObjectCache.mockResolvedValueOnce(false)

		expect(await store.publish(payload)).toBe(false)
		expect(cacheMocks.setObjectCache).toHaveBeenCalledTimes(1)
		expect(telemetryMocks.recordRuntimeError).toHaveBeenCalledTimes(1)
	})
})

describe('createRedisBlobStore reads', () => {
	it('reads a version and verifies the payload claims the identity it was filed under', async () => {
		cacheMocks.getCache.mockResolvedValueOnce(await blobFor(payload))
		expect(await store.readVersion('ethereum', payload.snapshot)).toEqual(payload)

		cacheMocks.getCache.mockResolvedValueOnce(await blobFor({ ...payload, chain: 'base' }))
		expect(await store.readVersion('ethereum', payload.snapshot)).toBeNull()

		cacheMocks.getCache.mockResolvedValueOnce({ Key: 'k', Body: Buffer.from('not gzip'), ContentType: 'x' })
		expect(await store.readVersion('ethereum', payload.snapshot)).toBeNull()
	})

	it('resolves readCurrent through :latest and readLastGood through :last-good', async () => {
		cacheMocks.getObjectCache.mockResolvedValueOnce({ version: payload.snapshot })
		cacheMocks.getCache.mockResolvedValueOnce(await blobFor(payload))
		expect(await store.readCurrent('ethereum')).toEqual(payload)
		expect(cacheMocks.getObjectCache).toHaveBeenCalledWith('test-table:v1:ethereum:latest')

		cacheMocks.getObjectCache.mockResolvedValueOnce({ version: payload.snapshot })
		cacheMocks.getCache.mockResolvedValueOnce(await blobFor(payload))
		expect(await store.readLastGood('ethereum')).toEqual(payload)
		expect(cacheMocks.getObjectCache).toHaveBeenLastCalledWith('test-table:v1:ethereum:last-good')
	})

	it('treats an expired pointer as a miss', async () => {
		cacheMocks.getObjectCache.mockResolvedValue(null)
		expect(await store.readCurrent('ethereum')).toBeNull()
		expect(cacheMocks.getCache).not.toHaveBeenCalled()
	})
})

describe('contentHashVersion', () => {
	it('is deterministic, 20 chars, url-safe, and validated by isContentHashVersion', () => {
		const version = contentHashVersion(JSON.stringify([{ id: 'aave' }]))
		expect(version).toHaveLength(20)
		expect(isContentHashVersion(version)).toBe(true)
		expect(contentHashVersion(JSON.stringify([{ id: 'aave' }]))).toBe(version)
		expect(contentHashVersion('other')).not.toBe(version)
		expect(isContentHashVersion('short')).toBe(false)
		expect(isContentHashVersion('has spaces in it....')).toBe(false)
	})
})
