import { beforeEach, describe, expect, it, vi } from 'vitest'

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
	it('acquires one background-refreshable snapshot for the request', async () => {
		const snapshot = { readJson: vi.fn() }
		const response = {
			rows: [{ id: 'pool-1', stabilityScore: 88, stabilityRating: 'stable', stabilityAvg30d: 5.2 }],
			total: 1,
			page: 2,
			pageSize: 10
		}
		mocks.acquire.mockResolvedValue(snapshot)
		mocks.getEarnPage.mockResolvedValue(response)

		await expect(yieldsEarnDataset.handle(request)).resolves.toMatchObject({
			status: 200,
			body: {
				...response,
				rows: [{ id: 'pool-1', stabilityScore: null, stabilityRating: null, stabilityAvg30d: null }]
			}
		})
		expect(mocks.acquire).toHaveBeenCalledOnce()
		expect(mocks.acquire).toHaveBeenCalledWith('background')
		expect(mocks.getEarnPage).toHaveBeenCalledWith(snapshot, request.query)
	})

	it('does not allow the public route to sort by the premium stability score', async () => {
		const snapshot = { readJson: vi.fn() }
		mocks.acquire.mockResolvedValue(snapshot)
		mocks.getEarnPage.mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 10 })
		const stabilityRequest = {
			...request,
			query: { sortBy: 'stabilityScore', sortDesc: 'false' }
		}

		await yieldsEarnDataset.handle(stabilityRequest)

		expect(mocks.getEarnPage).toHaveBeenCalledWith(snapshot, {
			sortBy: undefined,
			sortDesc: undefined
		})
	})

	it('returns an upstream error when no valid snapshot can be acquired', async () => {
		mocks.acquire.mockRejectedValue(new Error('refresh failed'))

		await expect(yieldsEarnDataset.handle(request)).resolves.toMatchObject({ status: 502 })
		expect(mocks.getEarnPage).not.toHaveBeenCalled()
		expect(mocks.recordError).toHaveBeenCalledOnce()
	})
})
