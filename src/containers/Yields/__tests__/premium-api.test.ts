import type { NextApiHandler, NextApiRequest } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const mocks = vi.hoisted(() => ({
	acquire: vi.fn(),
	fetchPoolDetail: vi.fn(),
	getEarnPage: vi.fn(),
	validateSubscription: vi.fn()
}))

vi.mock('../server/dataset.server', () => ({ acquireYieldsSnapshot: mocks.acquire }))
vi.mock('../data/earn.server', () => ({ getEarnPage: mocks.getEarnPage }))
vi.mock('../poolDetail/fetch', () => ({
	fetchPoolDetail: mocks.fetchPoolDetail,
	isNotFoundError: () => false
}))
vi.mock('~/utils/apiAuth', () => ({ validateSubscription: mocks.validateSubscription }))
vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError: vi.fn(),
	withApiRouteTelemetry: (_route: string, handler: NextApiHandler) => handler
}))

import earnPremiumHandler from '~/pages/api/private/yields/earn-premium'
import poolStabilityHandler from '~/pages/api/private/yields/pool/[pool]/stability'

beforeEach(() => {
	vi.clearAllMocks()
	mocks.validateSubscription.mockResolvedValue({ valid: true, isTrial: false })
})

describe('Yields premium API', () => {
	it('returns unredacted earn stability to a subscribed request', async () => {
		const snapshot = { readJson: vi.fn() }
		const page = { rows: [{ id: 'pool-1', stabilityScore: 0.88 }], total: 1, page: 1, pageSize: 50 }
		mocks.acquire.mockResolvedValue(snapshot)
		mocks.getEarnPage.mockResolvedValue(page)
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { sortBy: 'stabilityScore' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await earnPremiumHandler(req, res)

		expect(mocks.getEarnPage).toHaveBeenCalledWith(snapshot, req.query)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.json).toHaveBeenCalledWith(page)
	})

	it('does not load premium earn data when subscription validation fails', async () => {
		mocks.validateSubscription.mockResolvedValue({ valid: false, status: 403, error: 'Active subscription required' })
		const req = { method: 'GET', headers: {}, query: {} } as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await earnPremiumHandler(req, res)

		expect(mocks.acquire).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(403)
	})

	it('returns pool stability only through the subscribed route', async () => {
		mocks.fetchPoolDetail.mockResolvedValue({ stability_30d: { base_reward_intrinsic: 0.9 } })
		const req = {
			method: 'GET',
			headers: { authorization: 'Bearer ok' },
			query: { pool: 'pool-1' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await poolStabilityHandler(req, res)

		expect(res.json).toHaveBeenCalledWith({ stability: { score: 0.9, rating: 'stable' } })
	})
})
