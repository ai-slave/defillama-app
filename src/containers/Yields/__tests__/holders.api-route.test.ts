import type { NextApiRequest } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const { fetchWithPoolingOnServerMock } = vi.hoisted(() => ({
	fetchWithPoolingOnServerMock: vi.fn()
}))

vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: fetchWithPoolingOnServerMock
}))

import handler from '~/pages/api/public/yields/holders'

beforeEach(() => {
	vi.clearAllMocks()
	vi.stubEnv('NEXT_STATIC_REVALIDATE_JITTER_SECONDS', '0')
	fetchWithPoolingOnServerMock.mockResolvedValue(
		new Response(
			JSON.stringify({
				holders: [{ address: '0x1', amount: 100 }]
			}),
			{ status: 200 }
		)
	)
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('yield holders api route', () => {
	it('serves serialized holders data with CDN cache headers', async () => {
		const req = {
			method: 'GET',
			url: '/api/public/yields/holders',
			query: {}
		} as unknown as NextApiRequest
		const firstRes = createMockNextApiResponse()
		const secondRes = createMockNextApiResponse()

		await handler(req, firstRes)
		await handler(req, secondRes)

		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledWith('https://yields.llama.fi/holders')
		expect(fetchWithPoolingOnServerMock).toHaveBeenCalledTimes(1)
		expect(firstRes.setHeader).toHaveBeenCalledWith(
			'Cache-Control',
			'public, s-maxage=3600, stale-while-revalidate=600'
		)
		expect(firstRes.status).toHaveBeenCalledWith(200)
		expect(firstRes.send).toHaveBeenCalledWith(
			JSON.stringify({
				holders: [{ address: '0x1', amount: 100 }]
			})
		)
	})
})
