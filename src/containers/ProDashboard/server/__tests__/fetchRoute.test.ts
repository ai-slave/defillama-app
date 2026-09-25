import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { installTelemetrySink } from '~/utils/testing/telemetry'

const { validateSubscription } = vi.hoisted(() => ({ validateSubscription: vi.fn() }))
vi.mock('~/utils/apiAuth', () => ({ validateSubscription }))
vi.mock('~/server/db/llama', () => ({ llamaDb: {} }))

import { dashboardFetchHandler } from '../fetchRoute'

const http = installTelemetrySink()

function request(query: Record<string, string | Array<string> | undefined>, method = 'GET') {
	return createMockNextApiRequest({ method, query, headers: { authorization: 'Bearer token' } })
}

const yieldsRequest = JSON.stringify({ type: 'yields', params: { poolConfigId: 'pool-1' } })

beforeEach(() => {
	validateSubscription.mockReset().mockResolvedValue({ valid: true })
})

describe('/api/private/pro-dashboard/fetch', () => {
	test('rejects unsupported methods before checking the subscription', async () => {
		const res = createMockNextApiResponse()
		await dashboardFetchHandler(request({}, 'POST'), res)
		expect(res.status).toHaveBeenCalledWith(405)
		expect(validateSubscription).not.toHaveBeenCalled()
	})

	test('answers the auth failure without reaching upstream', async () => {
		validateSubscription.mockResolvedValue({ valid: false, status: 403, error: 'Subscription required' })
		const res = createMockNextApiResponse()
		await dashboardFetchHandler(request({ request: yieldsRequest }), res)
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ error: 'Subscription required' })
		expect(http.urls()).toEqual([])
	})

	test.each([
		{ query: {}, error: 'Missing request' },
		{ query: { request: ['{}'] }, error: 'Missing request' },
		{ query: { request: '{' }, error: 'Invalid request JSON' }
	])('returns 400 for malformed input %#', async ({ query, error }) => {
		const res = createMockNextApiResponse()
		await dashboardFetchHandler(request(query), res)
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error })
	})

	test('serves pool history with measured rows merged, privately cached', async () => {
		const reported = { date: '2026-01-01', tvl_usd: 10, apy: null, intrinsic: null, price_per_share: 1 }
		http.serve({
			'/v2/earn/pool-1/history': { data: [reported] },
			'/v2/earn/verified/pool-1/history': { data: [{ date: '2026-01-01', apy: 4, price_per_share: 1.1 }] }
		})
		const res = createMockNextApiResponse()

		await dashboardFetchHandler(request({ request: yieldsRequest }), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300')
		const body = JSON.parse(vi.mocked(res.send).mock.calls[0][0])
		expect(body.data).toEqual([
			{ ...reported, verified: expect.objectContaining({ apy: 4, price_per_share: 1.1, tvl_usd: null }) }
		])
		expect(http.urls().filter((url) => url.includes('range=max'))).toHaveLength(2)
	})

	test('returns 500 and records the failure with the request type when upstream fails', async () => {
		http.serve({ '/v2/earn/pool-1/history': fixtureStatus(500), '/v2/earn/verified/pool-1/history': { data: [] } })
		const res = createMockNextApiResponse()

		await dashboardFetchHandler(request({ request: yieldsRequest }), res)

		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch data' })
		const errors = (await http.events()).filter((event) => event.type === 'runtime_error')
		expect(errors).toEqual([expect.objectContaining({ attributes: expect.objectContaining({ type: 'yields' }) })])
	})
})
