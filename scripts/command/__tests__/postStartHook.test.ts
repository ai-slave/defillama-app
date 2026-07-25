import { describe, expect, it, vi } from 'vitest'
import { runPostStartHook } from '../postStartHook'
import { testEnv } from './testEnv'

describe('post-start hook', () => {
	it('skips the trigger when load-balancer auth is missing', async () => {
		const fetchImpl = vi.fn()
		const result = await runPostStartHook({ env: testEnv(), fetchImpl, logger: { log: vi.fn() } })

		expect(result).toEqual({ reason: 'missing LB cache invalidation auth', status: 'skipped' })
		expect(fetchImpl).not.toHaveBeenCalled()
	})

	it('skips the trigger when the build ID is missing', async () => {
		const fetchImpl = vi.fn()
		const result = await runPostStartHook({
			env: testEnv({ LB_CACHE_INVALIDATION_AUTH: 'token' }),
			fetchImpl,
			logger: { log: vi.fn() }
		})

		expect(result).toEqual({ reason: 'missing Next build ID', status: 'skipped' })
		expect(fetchImpl).not.toHaveBeenCalled()
	})

	it('sends one build trigger to the load balancer', async () => {
		const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
		const result = await runPostStartHook({
			env: testEnv({
				LB_CACHE_INVALIDATION_AUTH: 'token',
				LB_CACHE_INVALIDATION_URL: 'https://lb.internal/_wipe-cache',
				NEXT_BUILD_ID: 'build-a'
			}),
			fetchImpl,
			logger: { log: vi.fn() }
		})

		expect(result).toEqual({ status: 'triggered' })
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		const [url, init] = fetchImpl.mock.calls[0]
		expect(url).toBe('https://lb.internal/_wipe-cache')
		expect(init?.method).toBe('POST')
		expect(new Headers(init?.headers).get('X-Build-ID')).toBe('build-a')
		expect(new Headers(init?.headers).get('X-Purge-Token')).toBe('token')
	})
})
