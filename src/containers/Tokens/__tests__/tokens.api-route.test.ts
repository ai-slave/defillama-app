import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { getTokensPageDataMock } = vi.hoisted(() => ({
	getTokensPageDataMock: vi.fn()
}))

vi.mock('~/containers/Tokens/queries', () => ({
	getTokensPageData: getTokensPageDataMock
}))

import handler from '~/pages/api/public/tokens'

const tokensPageResponse = { ok: true }

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '0')
	getTokensPageDataMock.mockResolvedValue(tokensPageResponse)
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

		expect(getTokensPageDataMock).toHaveBeenCalledWith({ page: '2', pageSize: '50', search: 'ethena' })
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith(tokensPageResponse)
	})
})
