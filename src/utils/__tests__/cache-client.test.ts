import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const redisMocks = vi.hoisted(() => ({ eval: vi.fn() }))
vi.mock('ioredis', () => ({
	default: class {
		on() {}
		eval = redisMocks.eval
	}
}))

beforeEach(() => {
	vi.resetModules()
	vi.resetAllMocks()
	vi.stubEnv('NODE_ENV', 'test')
	vi.stubEnv('REDIS_URL', 'redis://localhost:6379')
	vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
	vi.unstubAllEnvs()
	vi.restoreAllMocks()
})

const payload = { Key: 'snapshot:hash', Body: Buffer.from('compressed snapshot'), ContentType: 'application/json+gzip' }

describe('setImmutableCache', () => {
	test('sends the blob and minimum TTL in one atomic Redis operation', async () => {
		const { setImmutableCache } = await import('../cache-client')
		redisMocks.eval.mockResolvedValue(1)
		expect(await setImmutableCache(payload, 1800)).toBe(true)
		expect(redisMocks.eval).toHaveBeenCalledExactlyOnceWith(
			expect.any(String),
			1,
			payload.Key,
			JSON.stringify({ Body: payload.Body.toString('base64'), ContentType: payload.ContentType }),
			1800
		)
	})

	test('reports failure when Redis cannot retain the blob', async () => {
		const { setImmutableCache } = await import('../cache-client')
		redisMocks.eval.mockRejectedValue(new Error('Redis unavailable'))
		expect(await setImmutableCache(payload, 1800)).toBe(false)
	})

	test('reports failure without Redis configured', async () => {
		vi.stubEnv('REDIS_URL', '')
		const { setImmutableCache } = await import('../cache-client')
		expect(await setImmutableCache(payload, 1800)).toBe(false)
		expect(redisMocks.eval).not.toHaveBeenCalled()
	})
})
