import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	acquire: vi.fn(),
	getEarnPage: vi.fn(),
	recordError: vi.fn()
}))

vi.mock('../server/dataset.server', () => ({ acquireYieldsSnapshot: mocks.acquire }))
vi.mock('../data/earn.server', () => ({ getEarnPage: mocks.getEarnPage }))
vi.mock('~/utils/telemetry', () => ({ recordRouteRuntimeError: mocks.recordError }))

import { yieldsEarnDataset } from '../server/api'

const request = {
	method: 'GET',
	url: '/api/public/yields/earn?page=2',
	query: { page: '2' },
	headers: {}
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe('Yields v2 public API', () => {
	test('acquires one background-refreshable snapshot for the request', async () => {
		const snapshot = { readJson: vi.fn() }
		const response = { rows: [], total: 0, page: 2, pageSize: 10 }
		mocks.acquire.mockResolvedValue(snapshot)
		mocks.getEarnPage.mockResolvedValue(response)

		await expect(yieldsEarnDataset.handle(request)).resolves.toMatchObject({ status: 200, body: response })
		expect(mocks.acquire).toHaveBeenCalledOnce()
		expect(mocks.acquire).toHaveBeenCalledWith('background')
		// No access argument: `getEarnPage` defaults to locked, which is what keeps this shared,
		// CDN-cached document free of measured figures. Subscribers read /api/private/yields/earn-verified.
		expect(mocks.getEarnPage).toHaveBeenCalledWith(snapshot, request.query)
	})

	// The route file is checked by apiRouteCatalog's "keeps auth-sensitive reads out of public
	// routes" rule; this covers the container module behind it, which is where the temptation to
	// vary a public response by subscriber lives.
	test('never inspects the caller, so one cached body is correct for everyone', async () => {
		mocks.acquire.mockResolvedValue({ readJson: vi.fn() })
		mocks.getEarnPage.mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 10 })

		const result = await yieldsEarnDataset.handle({
			...request,
			headers: { authorization: 'Bearer subscriber-token' }
		})

		expect(mocks.getEarnPage).toHaveBeenCalledWith(expect.anything(), request.query)
		expect(result.headers).toBeUndefined()
	})

	test('returns an upstream error when no valid snapshot can be acquired', async () => {
		mocks.acquire.mockRejectedValue(new Error('refresh failed'))

		await expect(yieldsEarnDataset.handle(request)).resolves.toMatchObject({ status: 502 })
		expect(mocks.getEarnPage).not.toHaveBeenCalled()
		expect(mocks.recordError).toHaveBeenCalledOnce()
	})
})
