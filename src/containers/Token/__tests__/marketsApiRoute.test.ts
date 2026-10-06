import type { NextApiRequest } from 'next'
import { describe, expect, test } from 'vitest'
import { MARKETS_SERVER_URL } from '~/constants'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { createMockNextApiResponse } from '~/utils/testing/nextApiMocks'
import { installTelemetrySink } from '~/utils/testing/telemetry'
const http = installTelemetrySink()

import handler from '~/pages/api/public/markets/[token]'

describe('/api/public/markets/[token]', () => {
	test('serves a repeated token request from cache', async () => {
		http.serve({ [MARKETS_SERVER_URL]: { token: 'bitcoin', markets: [] } })
		const req = {
			method: 'GET',
			query: { token: 'Bitcoin' },
			url: '/api/public/markets/Bitcoin'
		} as unknown as NextApiRequest
		const firstRes = createMockNextApiResponse()
		const secondRes = createMockNextApiResponse()

		await handler(req, firstRes)
		await handler(req, secondRes)

		expect(http.urls().filter((url) => url.startsWith(MARKETS_SERVER_URL))).toHaveLength(1)
		expect(firstRes.status).toHaveBeenCalledWith(200)
		expect(firstRes.send).toHaveBeenCalledWith(JSON.stringify({ token: 'bitcoin', markets: [] }))
		expect(secondRes.send).toHaveBeenCalledWith(JSON.stringify({ token: 'bitcoin', markets: [] }))
	})

	test('keeps upstream 404s as token not found responses', async () => {
		http.serve({ [MARKETS_SERVER_URL]: fixtureStatus(404) })
		const req = {
			method: 'GET',
			query: { token: 'missing' },
			url: '/api/public/markets/missing'
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(
			(await http.events()).filter((event) => event.type === 'runtime_error' && event.phase === 'apiRoute')
		).toHaveLength(0)
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'Token not found' })
	})

	test.each(['categories', 'exchanges'])('does not treat the retired %s API path as a token', async (token) => {
		const req = {
			method: 'GET',
			query: { token },
			url: `/api/public/markets/${token}`
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(http.urls().filter((url) => url.startsWith(MARKETS_SERVER_URL))).toHaveLength(0)
		expect(res.status).toHaveBeenCalledWith(404)
		expect(res.json).toHaveBeenCalledWith({ error: 'Token not found' })
	})

	test('does not cache token market failures', async () => {
		http.serve({ [MARKETS_SERVER_URL]: fixtureStatus(400, { error: 'temporary upstream failure' }) })
		const req = {
			method: 'GET',
			query: { token: 'retry-cache-test' },
			url: '/api/public/markets/retry-cache-test'
		} as unknown as NextApiRequest

		const failureRes = createMockNextApiResponse()
		await handler(req, failureRes)
		expect(failureRes.status).toHaveBeenCalledWith(502)
		http.serve({ [MARKETS_SERVER_URL]: { token: 'retry-cache-test', markets: [] } })
		const retryRes = createMockNextApiResponse()
		await handler(req, retryRes)

		expect(http.urls().filter((url) => url.startsWith(MARKETS_SERVER_URL))).toHaveLength(2)
		expect(retryRes.status).toHaveBeenCalledWith(200)
		expect(retryRes.send).toHaveBeenCalledWith(JSON.stringify({ token: 'retry-cache-test', markets: [] }))
	})
})
