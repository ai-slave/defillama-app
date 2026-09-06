import type { NextApiHandler, NextApiRequest } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'
import { binanceCexMetadataCache } from './metadataFixture'

const { fetchWithPoolingOnServerMock, recordRouteRuntimeErrorMock, validateSubscriptionMock } = vi.hoisted(() => ({
	fetchWithPoolingOnServerMock: vi.fn(),
	recordRouteRuntimeErrorMock: vi.fn(),
	validateSubscriptionMock: vi.fn()
}))

vi.mock('~/constants', () => ({
	SERVER_URL: 'https://api.example.com'
}))

vi.mock('~/utils/apiAuth', () => ({
	validateSubscription: validateSubscriptionMock
}))

vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: fetchWithPoolingOnServerMock
}))

vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: recordRouteRuntimeErrorMock,
	withApiRouteTelemetry: (_route: string, handler: NextApiHandler) => handler
}))

vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: binanceCexMetadataCache
}))

import inflowsHandler from '~/pages/api/private/cex/inflows'
import batchHandler from '~/pages/api/private/cex/inflows/batch'

beforeEach(() => {
	vi.clearAllMocks()
	validateSubscriptionMock.mockResolvedValue({ valid: true, isTrial: false })
	fetchWithPoolingOnServerMock.mockResolvedValue(new Response(JSON.stringify({ outflows: 1 })))
})

describe('/api/private/cex/inflows', () => {
	test('returns 405 with private no-store for non-GET requests', async () => {
		const req = {
			method: 'POST',
			headers: {},
			query: { cexProtocolSlug: 'binance-cex', start: '1', end: '3602' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET'])
		expect(res.status).toHaveBeenCalledWith(405)
		expect(res.json).toHaveBeenCalledWith({ error: 'Method Not Allowed' })
		expect(validateSubscriptionMock).not.toHaveBeenCalled()
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('returns auth failures before checking missing query params', async () => {
		validateSubscriptionMock.mockResolvedValue({
			valid: false,
			status: 401,
			error: 'Authentication required'
		})
		const req = {
			method: 'GET',
			headers: {},
			query: {}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith(undefined)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(401)
		expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('returns existing missing parameter errors after successful auth', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Missing required parameters: cexProtocolSlug, start, end' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('returns existing numeric parameter errors after successful auth', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: 'bad', end: '2' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'start and end must be valid numbers' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('rejects a single inflow interval of exactly one hour', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1', end: '3601' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'end must be more than one hour after start' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('rejects repeated tokensToExclude query parameters', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1', end: '3602', tokensToExclude: ['BNB', 'BUSD'] }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'tokensToExclude must be a comma-separated string' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('authenticates before revealing unknown CEX slugs', async () => {
		validateSubscriptionMock.mockResolvedValue({
			valid: false,
			status: 403,
			error: 'Active subscription required'
		})
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer bad' },
			query: { cexProtocolSlug: 'unknown', start: '1', end: '3602' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer bad')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ error: 'Active subscription required' })
	})

	test('does not fetch inflows for unknown CEX slugs after successful auth', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'unknown', start: '1', end: '3602' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'CEX not found' })
	})

	test('returns CEX inflows with private no-store after successful auth', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1000', end: '5000', tokensToExclude: 'BNB' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith(
			'https://api.example.com/inflows/binance-cex/1000?end=5000&tokensToExclude=BNB'
		)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ outflows: 1 })
	})

	test('passes through upstream error status with private no-store', async () => {
		fetchWithPoolingOnServerMock.mockResolvedValue(new Response(null, { status: 502 }))
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1000', end: '5000' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith(
			'https://api.example.com/inflows/binance-cex/1000?end=5000&tokensToExclude='
		)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(502)
		expect(res.json).toHaveBeenCalledWith({ error: 'Upstream API returned 502' })
	})

	test('returns the route-specific 500 body when auth validation throws', async () => {
		const error = new Error('Auth service unavailable')
		validateSubscriptionMock.mockRejectedValue(error)
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer bad' },
			query: { cexProtocolSlug: 'binance-cex', start: '1', end: '3602' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(recordRouteRuntimeErrorMock).toHaveBeenCalledWith(error, 'apiRoute')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('returns the route-specific 500 body when fetching inflows throws', async () => {
		const error = new Error('Upstream unavailable')
		fetchWithPoolingOnServerMock.mockRejectedValue(error)
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1', end: '3602' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(recordRouteRuntimeErrorMock).toHaveBeenCalledWith(error, 'apiRoute')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
	})
})

describe('/api/private/cex/inflows/batch', () => {
	test('returns 405 with private no-store for non-POST requests', async () => {
		const req = {
			method: 'GET',
			headers: {},
			body: { cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST'])
		expect(res.status).toHaveBeenCalledWith(405)
		expect(res.json).toHaveBeenCalledWith({ error: 'Method Not Allowed' })
		expect(validateSubscriptionMock).not.toHaveBeenCalled()
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('returns auth failures before checking invalid bodies', async () => {
		validateSubscriptionMock.mockResolvedValue({
			valid: false,
			status: 401,
			error: 'Authentication required'
		})
		const req = {
			method: 'POST',
			headers: {},
			body: { cexs: [], start: 'bad', end: 2 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith(undefined)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(401)
		expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('returns existing numeric parameter errors after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }], start: 'bad', end: 2 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'start and end must be valid numbers' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('rejects a non-object request body after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: null
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Request body must be an object' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('rejects a batch inflow interval of exactly one hour', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: {
				cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }],
				start: 1,
				end: 3601
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'end must be more than one hour after start' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('returns existing empty CEX array errors after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'cexs must be a non-empty array' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('returns existing CEX slug shape errors after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 123, tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'cexs must include protocol slugs and token exclusions' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('requires exact string-array token exclusions', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: {
				cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: 'BNB' }],
				start: 1,
				end: 3602
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'tokensToExclude must be string arrays' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('rejects more than 100 batch entries', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: {
				cexs: Array.from({ length: 101 }, () => ({ cexProtocolSlug: 'binance-cex', tokensToExclude: [] })),
				start: 1,
				end: 3602
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.status).toHaveBeenCalledWith(413)
		expect(res.json).toHaveBeenCalledWith({ error: 'cexs must contain at most 100 entries' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('rejects aliases that resolve to the same CEX protocol', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: {
				cexs: [
					{ cexProtocolSlug: 'binance', tokensToExclude: [] },
					{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }
				],
				start: 1,
				end: 3602
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error: 'Duplicate CEX: binance-cex' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('authenticates before revealing unknown CEX slugs', async () => {
		validateSubscriptionMock.mockResolvedValue({
			valid: false,
			status: 403,
			error: 'Active subscription required'
		})
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer bad' },
			body: { cexs: [{ cexProtocolSlug: 'unknown', tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer bad')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ error: 'Active subscription required' })
	})

	test('does not fetch batch inflows for unknown CEX slugs after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 'unknown', tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'CEX not found' })
	})

	test('returns batch CEX inflows with private no-store after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: {
				cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: ['BNB', 'BUSD'] }],
				start: 1000,
				end: 5000
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer ok')
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith('https://api.example.com/inflows/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				protocols: [{ protocol: 'binance-cex', tokensToExclude: ['BNB', 'BUSD'] }],
				startTimestamp: 1000,
				endTimestamp: 5000
			})
		})
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ outflows: 1 })
	})

	test('passes through batch upstream error status with private no-store', async () => {
		fetchWithPoolingOnServerMock.mockResolvedValue(new Response(null, { status: 502 }))
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }], start: 1000, end: 5000 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith('https://api.example.com/inflows/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				protocols: [{ protocol: 'binance-cex', tokensToExclude: [] }],
				startTimestamp: 1000,
				endTimestamp: 5000
			})
		})
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(502)
		expect(res.json).toHaveBeenCalledWith({ error: 'Upstream API returned 502' })
	})

	test('returns the batch route-specific 500 body when auth validation throws', async () => {
		const error = new Error('Auth service unavailable')
		validateSubscriptionMock.mockRejectedValue(error)
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer bad' },
			body: { cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(recordRouteRuntimeErrorMock).toHaveBeenCalledWith(error, 'apiRoute')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
		expect(fetchWithPoolingOnServerMock).not.toHaveBeenCalled()
	})

	test('returns the batch route-specific 500 body when fetching inflows throws', async () => {
		const error = new Error('Upstream unavailable')
		fetchWithPoolingOnServerMock.mockRejectedValue(error)
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(recordRouteRuntimeErrorMock).toHaveBeenCalledWith(error, 'apiRoute')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' })
	})
})
