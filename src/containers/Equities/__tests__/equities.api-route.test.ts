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

test('serves the earnings calendar route with joined company metadata', async () => {
	http.serve({
		[`${EQUITIES_SERVER_URL}/earnings-calendar`]: [
			{
				ticker: 'AAPL',
				date_status: 'estimated',
				report_date: '2026-10-27',
				report_time: 'amc',
				max_drift_days: 7,
				fiscal_year: 2026,
				fiscal_period: 'Q3',
				event_key: '2026-Q3',
				cik: '320193',
				accession_number: '0000320193-26-000123'
			}
		],
		[`${EQUITIES_SERVER_URL}/companies`]: [company({ ticker: 'AAPL', name: 'Apple Inc.' })]
	})
	const { default: handler } = await import('~/pages/api/public/equities/earnings-calendar')
	const res = createMockNextApiResponse()
	await handler(createMockNextApiRequest({ method: 'GET' }), res)
	expect(res.statusCode).toBe(200)
	expect(res.json.mock.calls.at(-1)?.[0]).toMatchObject({
		rows: [{ ticker: 'AAPL', report_date: '2026-10-27' }],
		companies: [{ ticker: 'AAPL', name: 'Apple Inc.' }],
		stale: false,
		todayET: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
	})
})
