import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'
import { installTelemetrySink } from '~/utils/test/telemetry'

const { validateSubscriptionMock } = vi.hoisted(() => ({
	validateSubscriptionMock: vi.fn()
}))

vi.mock('~/utils/apiAuth', () => ({
	validateSubscription: validateSubscriptionMock
}))

import tokenUsageHandler from '~/pages/api/private/token-usage/[symbol]'

const telemetry = installTelemetrySink()

beforeEach(() => {
	vi.clearAllMocks()
	validateSubscriptionMock.mockImplementation(async (authorization: string | undefined) =>
		authorization === 'Bearer ok'
			? { valid: true, isTrial: false }
			: { valid: false, status: 401, error: 'Authentication required' }
	)
	telemetry.serve({ '/tokenProtocols/ETH': { protocols: ['aave'] } })
})

describe('/api/private/token-usage/[symbol]', () => {
	test('returns 405 with private no-store for non-GET requests', async () => {
		const req = { method: 'POST', headers: {}, query: { symbol: 'eth' } } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await tokenUsageHandler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET'])
		expect(res.status).toHaveBeenCalledWith(405)
		expect(res.json).toHaveBeenCalledWith({ error: 'Method Not Allowed' })
		expect(telemetry.requests.filter(({ url }) => url.pathname.startsWith('/tokenProtocols/'))).toHaveLength(0)
	})

	test('returns auth failures before checking missing symbol params', async () => {
		validateSubscriptionMock.mockResolvedValue({
			valid: false,
			status: 401,
			error: 'Authentication required'
		})
		const req = { method: 'GET', headers: {}, query: {} } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await tokenUsageHandler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(401)
		expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
		expect(telemetry.requests.filter(({ url }) => url.pathname.startsWith('/tokenProtocols/'))).toHaveLength(0)
	})

	test('returns 400 for missing symbols after successful auth', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: {}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await tokenUsageHandler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Missing symbol parameter' })
		expect(telemetry.requests.filter(({ url }) => url.pathname.startsWith('/tokenProtocols/'))).toHaveLength(0)
	})

	test('resolves lowercase symbols to uppercase upstream data with private no-store', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { symbol: 'eth' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await tokenUsageHandler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ protocols: ['aave'] })
	})

	test('passes through upstream error status and status text', async () => {
		telemetry.serve({ '/tokenProtocols/MISSING': () => new Response(null, { status: 404, statusText: 'Not Found' }) })
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { symbol: 'missing' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await tokenUsageHandler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'Not Found' })
	})

	test('returns the route-specific 500 body when auth validation throws', async () => {
		const error = new Error('Auth service unavailable')
		validateSubscriptionMock.mockRejectedValue(error)
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer bad' },
			query: { symbol: 'eth' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await tokenUsageHandler(req, res)

		expect(await telemetry.events()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'runtime_error', phase: 'apiRoute', error_message: error.message })
			])
		)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch token usage data' })
		expect(telemetry.requests.filter(({ url }) => url.pathname.startsWith('/tokenProtocols/'))).toHaveLength(0)
	})
})
