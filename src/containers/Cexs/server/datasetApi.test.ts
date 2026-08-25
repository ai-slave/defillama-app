import type { NextApiHandler } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiRequest, createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { fetchCexs, recordRouteRuntimeError } = vi.hoisted(() => ({
	fetchCexs: vi.fn(),
	recordRouteRuntimeError: vi.fn()
}))

vi.mock('~/containers/Cexs/api', () => ({ fetchCexs }))
vi.mock('./analytics', () => ({
	getCexAnalyticsMarketShare: vi.fn(),
	getCexAnalyticsSnapshot: vi.fn(),
	getCexAnalyticsTotals: vi.fn()
}))
vi.mock('~/utils/telemetry', () => ({
	recordRouteRuntimeError,
	withApiRouteTelemetry: (_route: string, handler: NextApiHandler) => handler
}))

import { cexDatasetApiHandler } from './datasetApi'

describe('/api/dynamic/cexs', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('keeps unavailable assets null and measured zero distinct', async () => {
		fetchCexs.mockResolvedValue({
			cexs: [
				{ name: 'Unavailable' },
				{ name: 'Measured zero', currentTvl: 0, cleanAssetsTvl: 0, inflows_24h: 0 },
				{ name: 'Measured assets', currentTvl: 20, cleanAssetsTvl: 10, inflows_24h: 5 }
			],
			cg_volume_cexs: []
		})
		const req = createMockNextApiRequest({ method: 'GET' })
		const res = createMockNextApiResponse()

		await cexDatasetApiHandler(req, res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith([
			expect.objectContaining({ name: 'Measured assets', tvl: 20, cleanTvl: 10, '24hInflows': 5 }),
			expect.objectContaining({ name: 'Measured zero', tvl: 0, cleanTvl: 0, '24hInflows': 0 }),
			expect.objectContaining({ name: 'Unavailable', tvl: null, cleanTvl: null, '24hInflows': null })
		])
	})

	it('returns an error when the whole CEX source fails', async () => {
		const error = new Error('source unavailable')
		fetchCexs.mockRejectedValue(error)
		const req = createMockNextApiRequest({ method: 'GET' })
		const res = createMockNextApiResponse()

		await cexDatasetApiHandler(req, res)

		expect(recordRouteRuntimeError).toHaveBeenCalledWith(error, 'apiRoute')
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch cex data' })
	})
})
