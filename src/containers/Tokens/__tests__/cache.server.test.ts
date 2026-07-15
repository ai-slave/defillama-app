import { afterEach, describe, expect, it, vi } from 'vitest'

const redisValues = vi.hoisted(() => new Map<string, string>())

vi.mock('ioredis', () => ({
	default: class RedisMock {
		on() {}

		async get(key: string) {
			return redisValues.get(key) ?? null
		}

		async set(key: string, value: string, _expiryMode: string, _ttl: number, mode: string) {
			if (mode === 'NX' && redisValues.has(key)) return null
			redisValues.set(key, value)
			return 'OK'
		}
	}
}))

import { getOrCreateSharedTokensSnapshot, getTokensCacheControl, getTokensCacheRevision } from '../cache.server'

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllEnvs()
})

describe('tokens cache revision', () => {
	it('expires every token response at the same five-minute boundary without serving stale data', () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-07-15T10:02:30.000Z'))
		const revision = getTokensCacheRevision()

		expect(getTokensCacheControl(revision)).toBe('public, s-maxage=150, must-revalidate')
		expect(getTokensCacheControl(revision)).not.toContain('stale-while-revalidate')
	})

	it('does not cache an old snapshot into the next revision', () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-07-15T10:04:59.000Z'))
		const previousRevision = getTokensCacheRevision()

		vi.setSystemTime(new Date('2026-07-15T10:05:00.000Z'))

		expect(getTokensCacheRevision()).toBe(previousRevision + 1)
		expect(getTokensCacheControl(previousRevision)).toBe('private, no-store')
		expect(getTokensCacheControl(getTokensCacheRevision())).toBe('public, s-maxage=300, must-revalidate')
	})

	it('makes concurrent runtimes use the first snapshot published for a revision', async () => {
		vi.stubEnv('REDIS_URL', 'redis://tokens-test')
		let releaseSlowSnapshot!: () => void
		let markSlowSnapshotStarted!: () => void
		const slowSnapshotStarted = new Promise<void>((resolve) => {
			markSlowSnapshotStarted = resolve
		})
		const releaseSlowSnapshotPromise = new Promise<void>((resolve) => {
			releaseSlowSnapshot = resolve
		})

		const slowRuntime = getOrCreateSharedTokensSnapshot(123, async () => {
			markSlowSnapshotStarted()
			await releaseSlowSnapshotPromise
			return { source: 'slow' }
		})
		await slowSnapshotStarted

		const fastRuntime = getOrCreateSharedTokensSnapshot(123, async () => ({ source: 'fast' }))
		await expect(fastRuntime).resolves.toEqual({ source: 'fast' })

		releaseSlowSnapshot()
		await expect(slowRuntime).resolves.toEqual({ source: 'fast' })
	})
})
