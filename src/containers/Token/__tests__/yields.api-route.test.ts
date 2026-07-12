import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { acquireYieldsSnapshotMock, getTokenYieldsRowsMock, snapshot } = vi.hoisted(() => ({
	acquireYieldsSnapshotMock: vi.fn(),
	getTokenYieldsRowsMock: vi.fn(),
	snapshot: { handle: {} }
}))

vi.mock('~/containers/Yields/server/snapshot.reader.server', () => ({
	acquireYieldsSnapshot: acquireYieldsSnapshotMock,
	getTokenYieldsRows: getTokenYieldsRowsMock
}))

import handler from '~/pages/api/public/yields'

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '0')
	acquireYieldsSnapshotMock.mockResolvedValue(snapshot)
	getTokenYieldsRowsMock.mockResolvedValue([{ pool: 'ETH-USDC' }])
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('yields api route', () => {
	it('delegates to the shared token yields loader', async () => {
		const req = {
			method: 'GET',
			query: { token: 'ETH', chains: 'Ethereum' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(acquireYieldsSnapshotMock).toHaveBeenCalledWith('background')
		expect(getTokenYieldsRowsMock).toHaveBeenCalledWith(snapshot, 'ETH', 'Ethereum')
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([{ pool: 'ETH-USDC' }])
	})
})
