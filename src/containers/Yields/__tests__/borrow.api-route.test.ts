import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { acquireYieldsSnapshotMock, getBorrowPageRowsMock, snapshot } = vi.hoisted(() => ({
	acquireYieldsSnapshotMock: vi.fn(),
	getBorrowPageRowsMock: vi.fn(),
	snapshot: { handle: {} }
}))

vi.mock('~/containers/Yields/server/snapshot.reader.server', () => ({
	acquireYieldsSnapshot: acquireYieldsSnapshotMock,
	getBorrowPageRows: getBorrowPageRowsMock
}))

import handler from '~/pages/api/public/yields/borrow'

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '0')
	acquireYieldsSnapshotMock.mockResolvedValue(snapshot)
	getBorrowPageRowsMock.mockResolvedValue({
		rows: [{ pool: 'eth-collateral' }],
		total: 1
	})
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('borrow api route', () => {
	it('serves filtered simple borrow rows with CDN cache headers', async () => {
		const req = {
			method: 'GET',
			url: '/api/public/yields/borrow?collateral=ETH&borrow=USDC',
			query: { collateral: 'ETH', borrow: 'USDC' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(acquireYieldsSnapshotMock).toHaveBeenCalledWith('background')
		expect(getBorrowPageRowsMock).toHaveBeenCalledWith(snapshot, { collateral: 'ETH', borrow: 'USDC' })
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({
			rows: [{ pool: 'eth-collateral' }],
			total: 1
		})
	})
})
