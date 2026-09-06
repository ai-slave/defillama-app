import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { addTelemetryMock, recordRuntimeErrorMock, requireSubscriptionMock, fetchPoolHistoryMock } = vi.hoisted(() => ({
	addTelemetryMock: vi.fn(),
	recordRuntimeErrorMock: vi.fn(),
	requireSubscriptionMock: vi.fn(),
	fetchPoolHistoryMock: vi.fn()
}))

vi.mock('~/server/api/requireSubscription', () => ({ requireSubscription: requireSubscriptionMock }))
vi.mock('~/containers/ProDashboard/queries.server', () => ({
	fetchProtocolsAndChains: vi.fn(),
	fetchSingleChartData: vi.fn(),
	withTimeout: async (promise: Promise<unknown>) => promise
}))
vi.mock('~/containers/Yields/poolDetail/fetch', () => ({
	fetchPoolDetailHistory: fetchPoolHistoryMock,
	fetchBorrowMarketDetailHistory: vi.fn()
}))
vi.mock('~/utils/telemetry', () => ({
	addRouteTelemetryAttributes: addTelemetryMock,
	recordRouteRuntimeError: recordRuntimeErrorMock,
	withApiRouteTelemetry: (_route: string, handler: unknown) => handler
}))

import { dashboardFetchHandler } from './fetchRoute'

function request(query: Record<string, string | Array<string> | undefined>, method = 'GET') {
	return createMockNextApiRequest({ method, query, headers: { authorization: 'Bearer token' } })
}

describe('/api/private/pro-dashboard/fetch', () => {
	beforeEach(() => {
		addTelemetryMock.mockReset()
		recordRuntimeErrorMock.mockReset()
		requireSubscriptionMock.mockReset().mockResolvedValue(true)
		fetchPoolHistoryMock.mockReset()
	})

	test('rejects unsupported methods before checking subscription', async () => {
		const res = createMockNextApiResponse()

		await dashboardFetchHandler(request({}, 'POST'), res)

		expect(res.status).toHaveBeenCalledWith(405)
		expect(requireSubscriptionMock).not.toHaveBeenCalled()
	})

	test.each([
		{ query: {}, error: 'Missing request' },
		{ query: { request: ['{}'] }, error: 'Missing request' },
		{ query: { request: '{' }, error: 'Invalid request JSON' }
	])('returns 400 for malformed input %# without recording an upstream failure', async ({ query, error }) => {
		const res = createMockNextApiResponse()

		await dashboardFetchHandler(request(query), res)

		expect(res.status).toHaveBeenCalledWith(400)
		expect(res.json).toHaveBeenCalledWith({ error })
		expect(recordRuntimeErrorMock).not.toHaveBeenCalled()
	})

	test('dispatches a valid request, preserves private caching, and records response telemetry', async () => {
		const data = { points: [[1, 2]] }
		fetchPoolHistoryMock.mockResolvedValue(data)
		const res = createMockNextApiResponse()
		const serialized = JSON.stringify({ type: 'yields', params: { poolConfigId: 'pool-1' } })

		await dashboardFetchHandler(request({ request: serialized }), res)

		expect(fetchPoolHistoryMock).toHaveBeenCalledWith('pool-1', 'max')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.send).toHaveBeenCalledWith(JSON.stringify({ data }))
		expect(addTelemetryMock).toHaveBeenCalledWith({
			fetch_all_ms: expect.any(Number),
			construct_response_ms: expect.any(Number),
			response_bytes: Buffer.byteLength(JSON.stringify({ data }))
		})
	})

	test('records valid-request dispatch failures against the discriminated request type', async () => {
		fetchPoolHistoryMock.mockRejectedValue(new Error('upstream failed'))
		const res = createMockNextApiResponse()
		const serialized = JSON.stringify({ type: 'yields', params: { poolConfigId: 'pool-1' } })

		await dashboardFetchHandler(request({ request: serialized }), res)

		expect(recordRuntimeErrorMock).toHaveBeenCalledWith(expect.any(Error), 'apiRoute', { type: 'yields' })
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch data' })
	})
})
