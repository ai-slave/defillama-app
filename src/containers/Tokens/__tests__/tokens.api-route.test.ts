import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { getTokensPageSnapshotMock, getTokensCacheControlMock } = vi.hoisted(() => ({
	getTokensPageSnapshotMock: vi.fn(),
	getTokensCacheControlMock: vi.fn(() => 'public, s-maxage=123, must-revalidate')
}))

vi.mock('~/containers/Tokens/queries.server', () => ({
	getTokensPageSnapshot: getTokensPageSnapshotMock
}))

vi.mock('~/containers/Tokens/cache.server', () => ({
	getTokensCacheControl: getTokensCacheControlMock
}))

import handler from '~/pages/api/public/tokens'

const tokensPageResponse = { ok: true }

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '0')
	getTokensPageSnapshotMock.mockResolvedValue({ generatedAt: 42, data: tokensPageResponse })
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
})
