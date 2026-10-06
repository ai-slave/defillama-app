import type { NextApiRequest } from 'next'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { researchLandingRevalidateHandler } from '~/pages/api/private/research/revalidate-landing'
import { createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

function request(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
	return {
		body: {},
		headers: {},
		method: 'GET',
		query: {},
		...overrides
	} as NextApiRequest
}

describe('/api/private/research/revalidate-landing', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
	})

	test('requires an auth header', async () => {
		const fetchImpl = vi.fn()
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchLandingRevalidateHandler(request(), res)

		expect(fetchImpl).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(401)
		expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' })
	})

	test('validates the researcher session, then purges /research', async () => {
		vi.stubEnv('CF_ZONE', 'zone')
		vi.stubEnv('CF_PURGE_CACHE_AUTH', 'token')

		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchLandingRevalidateHandler(request({ headers: { authorization: 'Bearer user-token' } }), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({
			purgePaths: ['/research'],
			status: 'scheduled'
		})
	})

	test('passes auth validation failures through without touching caches', async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ error: 'Forbidden' }), {
				headers: { 'Content-Type': 'application/json' },
				status: 403
			})
		)
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchLandingRevalidateHandler(request({ headers: { authorization: 'Bearer user-token' } }), res)

		expect(fetchImpl).toHaveBeenCalledTimes(1)
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' })
	})
})
