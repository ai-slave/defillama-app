import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { fetchJsonMock, recordRouteRuntimeErrorMock } = vi.hoisted(() => ({
	fetchJsonMock: vi.fn(),
	recordRouteRuntimeErrorMock: vi.fn()
}))

vi.mock('~/constants', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/constants')>()
	return {
		...actual,
		MARKETS_SERVER_URL: 'https://markets.example.com'
	}
})

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return {
		...actual,
		fetchJson: fetchJsonMock
	}
})

vi.mock('~/utils/telemetry', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/telemetry')>()
	return {
		...actual,
		recordRouteRuntimeError: recordRouteRuntimeErrorMock,
		withApiRouteTelemetry: (_route: string, handler: unknown) => handler
	}
})

import handler from '~/pages/api/public/markets/[token]'

describe('/api/public/markets/[token]', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('caches and serves serialized token markets through the shared JSON route builder', async () => {
		fetchJsonMock.mockResolvedValueOnce({ token: 'bitcoin', markets: [] })
		const req = {
			method: 'GET',
			query: { token: 'Bitcoin' },
			url: '/api/public/markets/Bitcoin'
		} as unknown as NextApiRequest
		const firstRes = createMockNextApiResponse()
		const secondRes = createMockNextApiResponse()

		await handler(req, firstRes)
		await handler(req, secondRes)

		expect(fetchJsonMock).toHaveBeenCalledWith('https://markets.example.com/tokens/by-id/cg-626974636f696e.json', {
			timeout: 30_000
		})
		expect(fetchJsonMock).toHaveBeenCalledTimes(1)
		expect(firstRes.status).toHaveBeenCalledWith(200)
		expect(firstRes.send).toHaveBeenCalledWith(JSON.stringify({ token: 'bitcoin', markets: [] }))
		expect(secondRes.send).toHaveBeenCalledWith(JSON.stringify({ token: 'bitcoin', markets: [] }))
	})

	it('keeps upstream 404s as token not found responses', async () => {
		fetchJsonMock.mockRejectedValueOnce(
			new Error('https://markets.example.com/tokens/by-id/cg-6d697373696e67.json: [404] Not Found')
		)
		const req = {
			method: 'GET',
			query: { token: 'missing' },
			url: '/api/public/markets/missing'
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(recordRouteRuntimeErrorMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'Token not found' })
	})

	it.each(['categories', 'exchanges'])('does not treat the retired %s API path as a token', async (token) => {
		const req = {
			method: 'GET',
			query: { token },
			url: `/api/public/markets/${token}`
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(fetchJsonMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'Token not found' })
	})

	it('does not cache token market failures', async () => {
		fetchJsonMock
			.mockRejectedValueOnce(new Error('temporary upstream failure'))
			.mockResolvedValueOnce({ token: 'retry-cache-test', markets: [] })
		const req = {
			method: 'GET',
			query: { token: 'retry-cache-test' },
			url: '/api/public/markets/retry-cache-test'
		} as unknown as NextApiRequest

		await handler(req, createMockNextApiResponse())
		const retryRes = createMockNextApiResponse()
		await handler(req, retryRes)

		expect(fetchJsonMock).toHaveBeenCalledTimes(2)
		expect(retryRes.status).toHaveBeenCalledWith(200)
		expect(retryRes.send).toHaveBeenCalledWith(JSON.stringify({ token: 'retry-cache-test', markets: [] }))
	})
})
