import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test } from 'vitest'
import { AUTH_SERVER, POCKETBASE_URL, SERVER_URL } from '~/constants'
import inflowsHandler from '~/pages/api/private/cex/inflows'
import batchHandler from '~/pages/api/private/cex/inflows/batch'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { binanceCexMetadataCache } from './metadataFixture'

const { serve, requests } = installFixtureFetch()
const { seed } = installMetadataSeeder()
beforeEach(() => {
	seed(binanceCexMetadataCache)
	serve({
		[`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'active' } },
		[`${POCKETBASE_URL}/api/collections/users/auth-refresh`]: { record: { flags: {} } },
		[`${SERVER_URL}/inflows/binance-cex/1000?end=5000&tokensToExclude=BNB`]: { outflows: 1 },
		[`${SERVER_URL}/inflows/batch`]: { outflows: 1 }
	})
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

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.setHeader.mock.calls.find(([name]) => name === 'Allow')?.[1]).toEqual(['GET'])
		expect(res.statusCode).toBe(405)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Method Not Allowed' })
	})

	test('returns auth failures before checking missing query params', async () => {
		const req = {
			method: 'GET',
			headers: {},
			query: {}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(401)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Authentication required' })
	})

	test('returns existing missing parameter errors after successful auth', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Missing required parameters: cexProtocolSlug, start, end' })
	})

	test('returns existing numeric parameter errors after successful auth', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: 'bad', end: '2' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'start and end must be valid numbers' })
	})

	test('rejects a single inflow interval of exactly one hour', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1', end: '3601' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'end must be more than one hour after start' })
	})

	test('rejects repeated tokensToExclude query parameters', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1', end: '3602', tokensToExclude: ['BNB', 'BUSD'] }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'tokensToExclude must be a comma-separated string' })
	})

	test('authenticates before revealing unknown CEX slugs', async () => {
		serve({ [`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'inactive' } } })
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer bad' },
			query: { cexProtocolSlug: 'unknown', start: '1', end: '3602' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')

		expect(res.statusCode).toBe(403)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Active subscription required' })
	})

	test('does not fetch inflows for unknown CEX slugs after successful auth', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'unknown', start: '1', end: '3602' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')

		expect(res.statusCode).toBe(404)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'CEX not found' })
	})

	test('returns CEX inflows with private no-store after successful auth', async () => {
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1000', end: '5000', tokensToExclude: 'BNB' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(200)
		expect(res.json.mock.lastCall?.[0]).toEqual({ outflows: 1 })
	})

	test('passes through upstream error status with private no-store', async () => {
		serve({
			[`${SERVER_URL}/inflows/binance-cex/1000?end=5000&tokensToExclude=`]: fixtureStatus(502),
			[`${SERVER_URL}/inflows/batch`]: fixtureStatus(502)
		})
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1000', end: '5000' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(502)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Upstream API returned 502' })
	})

	test('returns the route-specific 500 body when auth validation throws', async () => {
		const error = new Error('Auth service unavailable')
		serve({
			[`${AUTH_SERVER}/subscription/status`]: () => {
				throw error
			}
		})
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer bad' },
			query: { cexProtocolSlug: 'binance-cex', start: '1', end: '3602' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(500)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Internal server error' })
	})

	test('returns the route-specific 500 body when fetching inflows throws', async () => {
		const error = new Error('Upstream unavailable')
		serve({
			[`${SERVER_URL}/inflows/binance-cex/1?end=3602&tokensToExclude=`]: () => {
				throw error
			},
			[`${SERVER_URL}/inflows/batch`]: () => {
				throw error
			}
		})
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { cexProtocolSlug: 'binance-cex', start: '1', end: '3602' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await inflowsHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(500)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Internal server error' })
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

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.setHeader.mock.calls.find(([name]) => name === 'Allow')?.[1]).toEqual(['POST'])
		expect(res.statusCode).toBe(405)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Method Not Allowed' })
	})

	test('returns auth failures before checking invalid bodies', async () => {
		serve({ [`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'inactive' } } })
		const req = {
			method: 'POST',
			headers: {},
			body: { cexs: [], start: 'bad', end: 2 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(401)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Authentication required' })
	})

	test('returns existing numeric parameter errors after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }], start: 'bad', end: 2 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'start and end must be valid numbers' })
	})

	test('rejects a non-object request body after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: null
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Request body must be an object' })
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

		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'end must be more than one hour after start' })
	})

	test('returns existing empty CEX array errors after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'cexs must be a non-empty array' })
	})

	test('returns existing CEX slug shape errors after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 123, tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'cexs must include protocol slugs and token exclusions' })
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

		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'tokensToExclude must be string arrays' })
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

		expect(res.statusCode).toBe(413)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'cexs must contain at most 100 entries' })
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

		expect(res.statusCode).toBe(400)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Duplicate CEX: binance-cex' })
	})

	test('authenticates before revealing unknown CEX slugs', async () => {
		serve({ [`${AUTH_SERVER}/subscription/status`]: { subscription: { status: 'inactive' } } })
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer bad' },
			body: { cexs: [{ cexProtocolSlug: 'unknown', tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')

		expect(res.statusCode).toBe(403)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Active subscription required' })
	})

	test('does not fetch batch inflows for unknown CEX slugs after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 'unknown', tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')

		expect(res.statusCode).toBe(404)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'CEX not found' })
	})

	test('returns batch CEX inflows for an alias slug with private no-store after successful auth', async () => {
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: {
				cexs: [{ cexProtocolSlug: 'binance', tokensToExclude: ['BNB', 'BUSD'] }],
				start: 1000,
				end: 5000
			}
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)
		expect(
			JSON.parse(requests.find((request) => request.url.pathname === '/inflows/batch')!.init!.body as string)
		).toEqual({
			protocols: [{ protocol: 'binance-cex', tokensToExclude: ['BNB', 'BUSD'] }],
			startTimestamp: 1000,
			endTimestamp: 5000
		})

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(200)
		expect(res.json.mock.lastCall?.[0]).toEqual({ outflows: 1 })
	})

	test('passes through batch upstream error status with private no-store', async () => {
		serve({
			[`${SERVER_URL}/inflows/binance-cex/1000?end=5000&tokensToExclude=`]: fixtureStatus(502),
			[`${SERVER_URL}/inflows/batch`]: fixtureStatus(502)
		})
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }], start: 1000, end: 5000 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(502)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Upstream API returned 502' })
	})

	test('returns the batch route-specific 500 body when auth validation throws', async () => {
		const error = new Error('Auth service unavailable')
		serve({
			[`${AUTH_SERVER}/subscription/status`]: () => {
				throw error
			}
		})
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer bad' },
			body: { cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(500)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Internal server error' })
	})

	test('returns the batch route-specific 500 body when fetching inflows throws', async () => {
		const error = new Error('Upstream unavailable')
		serve({
			[`${SERVER_URL}/inflows/binance-cex/1?end=3602&tokensToExclude=`]: () => {
				throw error
			},
			[`${SERVER_URL}/inflows/batch`]: () => {
				throw error
			}
		})
		const req = {
			method: 'POST',
			headers: { authorization: 'Bearer ok' },
			body: { cexs: [{ cexProtocolSlug: 'binance-cex', tokensToExclude: [] }], start: 1, end: 3602 }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await batchHandler(req, res)

		expect(res.setHeader.mock.calls.find(([name]) => name === 'Cache-Control')?.[1]).toBe('private, no-store')
		expect(res.statusCode).toBe(500)
		expect(res.json.mock.lastCall?.[0]).toEqual({ error: 'Internal server error' })
	})
})
