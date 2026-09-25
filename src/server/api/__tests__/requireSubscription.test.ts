import { beforeEach, describe, expect, test } from 'vitest'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { requireSubscription } from '../requireSubscription'

const http = installFixtureFetch()
beforeEach(() => {
	http.serve({
		'/subscription/status': { subscription: { status: 'active' } },
		'/api/collections/users/auth-refresh': { record: { flags: { is_trial: false } } }
	})
})

describe('requireSubscription', () => {
	test.each([false, true])('returns active access with trial=%s without writing a response', async (isTrial) => {
		http.serve({ '/api/collections/users/auth-refresh': { record: { flags: { is_trial: isTrial } } } })
		const res = createMockNextApiResponse()
		await expect(requireSubscription('Bearer ok', res)).resolves.toEqual({ valid: true, isTrial })
		expect(res.status).not.toHaveBeenCalled()
		expect(res.json).not.toHaveBeenCalled()
	})
	test('sends the inactive subscription response and returns null', async () => {
		http.serve({ '/subscription/status': { subscription: { status: 'expired' } } })
		const res = createMockNextApiResponse()
		await expect(requireSubscription('Bearer expired', res)).resolves.toBeNull()
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ error: 'Active subscription required' })
	})
	test('rejects missing authorization without contacting the auth service', async () => {
		const res = createMockNextApiResponse()
		await expect(requireSubscription(undefined, res)).resolves.toBeNull()
		expect(res.status).toHaveBeenCalledWith(401)
		expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
		expect(http.requests).toHaveLength(0)
	})
	test('lets an auth service outage reach the caller without sending an access denial', async () => {
		const error = new Error('Auth service unavailable')
		http.serve({
			'/subscription/status': () => {
				throw error
			}
		})
		const res = createMockNextApiResponse()
		await expect(requireSubscription('Bearer ok', res)).rejects.toBe(error)
		expect(res.status).not.toHaveBeenCalled()
		expect(res.json).not.toHaveBeenCalled()
	})
})
