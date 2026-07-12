import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { acquireYieldsSnapshotMock, getTokenBorrowRoutesDataMock, snapshot } = vi.hoisted(() => ({
	acquireYieldsSnapshotMock: vi.fn(),
	getTokenBorrowRoutesDataMock: vi.fn(),
	snapshot: { handle: {} }
}))

vi.mock('~/containers/Yields/server/snapshot.reader.server', () => ({
	acquireYieldsSnapshot: acquireYieldsSnapshotMock,
	getTokenBorrowRoutes: getTokenBorrowRoutesDataMock
}))

import handler from '~/pages/api/public/yields/token-borrow-routes'

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '0')
	acquireYieldsSnapshotMock.mockResolvedValue(snapshot)
	getTokenBorrowRoutesDataMock.mockResolvedValue({
		borrowAsCollateral: [{ symbol: 'ETH' }],
		borrowAsDebt: [{ borrow: { symbol: 'ETH' } }]
	})
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('yields-token-borrow-routes api route', () => {
	it('delegates to the shared borrow routes loader and sets cache headers', async () => {
		const req = {
			method: 'GET',
			query: { token: 'ETH' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(acquireYieldsSnapshotMock).toHaveBeenCalledWith('background')
		expect(getTokenBorrowRoutesDataMock).toHaveBeenCalledWith(snapshot, 'ETH')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({
			borrowAsCollateral: [{ symbol: 'ETH' }],
			borrowAsDebt: [{ borrow: { symbol: 'ETH' } }]
		})
	})

	it('does not send public cache headers when the loader fails', async () => {
		getTokenBorrowRoutesDataMock.mockRejectedValueOnce(new Error('borrow routes failed'))
		const req = {
			method: 'GET',
			query: { token: 'ETH' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(getTokenBorrowRoutesDataMock).toHaveBeenCalledWith(snapshot, 'ETH')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
		expect(res.setHeader).not.toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
		expect(res.status).toHaveBeenCalledWith(502)
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch token borrow routes data' })
	})
})
