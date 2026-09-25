import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { EQUITIES_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { company } from './companyFixture'
const http = installFixtureFetch()
beforeEach(() => {
	vi.resetModules()
	vi.stubEnv('REDIS_URL', '')
})
afterEach(() => vi.unstubAllEnvs())

test('filters and pages actual upstream companies through the public route', async () => {
	http.serve({
		[`${EQUITIES_SERVER_URL}/companies`]: [
			company({ ticker: 'AAPL', name: 'Apple', marketCap: 300 }),
			company({ ticker: 'OTHER', name: 'Another Company', marketCap: 200 }),
			company({ ticker: 'APLE', name: 'Apple Hospitality', marketCap: 100 })
		]
	})
	const { default: handler } = await import('~/pages/api/public/equities')
	const res = createMockNextApiResponse()
	await handler(createMockNextApiRequest({ method: 'GET', query: { page: '2', pageSize: '1', search: 'apple' } }), res)
	expect(res.statusCode).toBe(200)
	expect(res.json.mock.calls.at(-1)?.[0]).toMatchObject({
		rows: [expect.objectContaining({ ticker: 'APLE', marketCap: 100 })],
		total: 2
	})
})

test('answers 502 when neither the producer nor a saved snapshot is available', async () => {
	// A non-retryable failure keeps the test off the retry backoff; any producer failure takes this path.
	http.serve({ [`${EQUITIES_SERVER_URL}/companies`]: fixtureStatus(404) })
	const { default: handler } = await import('~/pages/api/public/equities')
	const res = createMockNextApiResponse()
	await handler(createMockNextApiRequest({ method: 'GET' }), res)
	expect(res.statusCode).toBe(502)
	expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch equities data' })
})
