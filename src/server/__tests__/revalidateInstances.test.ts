import type { NextApiRequest } from 'next'
import { describe, expect, test, vi } from 'vitest'
import { revalidateInstancesHandler } from '~/pages/api/private/revalidate-instances'
import { normalizeCachePaths } from '~/server/revalidateInstances'
import { createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

function request(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
	return {
		body: { paths: ['/research'] },
		headers: { 'x-revalidate-secret': 'shhh' },
		method: 'POST',
		query: {},
		...overrides
	} as NextApiRequest
}

describe('revalidate instance helpers', () => {
	test('normalizes any root-relative path and rejects absolute/protocol-relative urls', () => {
		expect(
			normalizeCachePaths([
				'/research',
				'/protocol/aave?tab=tvl',
				'/pro/123#section',
				'relative/path',
				'//evil.example',
				'https://evil.example/x',
				42
			])
		).toEqual(['/research', '/protocol/aave', '/pro/123'])
	})
})

describe('/api/private/revalidate-instances', () => {
	test('authenticates dry-run requests without revalidating paths', async () => {
		vi.stubEnv('REVALIDATE_SECRET', 'shhh')
		const res = createMockNextApiResponse()

		await revalidateInstancesHandler(request({ body: { dryRun: true, paths: ['/research'] } }), res)

		expect(res.revalidate).not.toHaveBeenCalled()
		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({ revalidateErrors: [], revalidated: [] })
		vi.unstubAllEnvs()
	})

	test('returns 500 when any path revalidation fails', async () => {
		vi.stubEnv('REVALIDATE_SECRET', 'shhh')
		const res = createMockNextApiResponse()
		res.revalidate.mockRejectedValueOnce(new Error('missing page'))

		await revalidateInstancesHandler(request(), res)

		expect(res.revalidate).toHaveBeenCalledWith('/research')
		expect(res.status).toHaveBeenCalledWith(500)
		expect(res.json).toHaveBeenCalledWith({
			revalidateErrors: [{ path: '/research', reason: 'missing page' }],
			revalidated: []
		})
		vi.unstubAllEnvs()
	})
})
