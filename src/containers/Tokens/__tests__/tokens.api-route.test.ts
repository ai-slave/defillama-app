import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { getTokensPageSnapshotMock, getTokensChartSnapshotMock, getTokensCacheControlMock } = vi.hoisted(() => ({
	getTokensPageSnapshotMock: vi.fn(),
	getTokensChartSnapshotMock: vi.fn(),
	getTokensCacheControlMock: vi.fn(() => 'public, s-maxage=123, must-revalidate')
}))

vi.mock('~/containers/Tokens/queries.server', () => ({
	getTokensPageSnapshot: getTokensPageSnapshotMock,
	getTokensChartSnapshot: getTokensChartSnapshotMock
}))

vi.mock('~/containers/Tokens/cache.server', () => ({
	getTokensCacheControl: getTokensCacheControlMock
}))

import handler from '~/pages/api/public/tokens'
import marketMapHandler from '~/pages/api/public/tokens/market-map'

const tokensPageResponse = { ok: true }
const tokensChartDataset = { marketCaps: [1] }

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '0')
	getTokensPageSnapshotMock.mockResolvedValue({ generatedAt: 42, data: tokensPageResponse })
	getTokensChartSnapshotMock.mockResolvedValue({ generatedAt: 42, data: tokensChartDataset })
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('tokens api route', () => {
	it('serves paginated token rows with CDN cache headers', async () => {
		const req = {
			method: 'GET',
			url: '/api/public/tokens?page=2&pageSize=50&search=ethena',
			query: { page: '2', pageSize: '50', search: 'ethena' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await handler(req, res)

		expect(getTokensPageSnapshotMock).toHaveBeenCalledWith({ page: '2', pageSize: '50', search: 'ethena' })
		expect(getTokensCacheControlMock).toHaveBeenCalledWith(42)
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=123, must-revalidate')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(tokensPageResponse)
	})

	it('serves the filtered market map dataset from its own route', async () => {
		const req = {
			method: 'GET',
			url: '/api/public/tokens/market-map?categories=governance',
			query: { categories: 'governance' }
		} as unknown as NextApiRequest
		const res = createMockNextApiResponse()

		await marketMapHandler(req, res)

		expect(getTokensChartSnapshotMock).toHaveBeenCalledWith({ categories: 'governance' })
		expect(getTokensPageSnapshotMock).not.toHaveBeenCalled()
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=123, must-revalidate')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(tokensChartDataset)
	})
})
