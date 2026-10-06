import type { NextApiRequest } from 'next'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ArticleDocument } from '~/containers/Articles/types'
import { researchUnpublishHandler } from '~/pages/api/private/research/articles/[id]/unpublish'
import { createMockNextApiResponse } from '~/utils/testing/nextApiMocks'

function request(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
	return {
		body: {},
		headers: {},
		method: 'POST',
		query: { id: 'article-id' },
		...overrides
	} as NextApiRequest
}

function article(overrides: Partial<ArticleDocument> = {}): ArticleDocument {
	return {
		id: 'article-id',
		section: 'report',
		slug: 'old-story',
		status: 'published',
		...overrides
	} as ArticleDocument
}

describe('/api/private/research/articles/[id]/unpublish', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	test('unpublishes through the backend, then purges public research urls', async () => {
		vi.stubEnv('CF_ZONE', 'zone')
		vi.stubEnv('CF_PURGE_CACHE_AUTH', 'token')

		const before = article({ section: 'report', slug: 'old-story' })
		const after = article({ section: 'report', slug: 'old-story', status: 'draft' })
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: before }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: after }), { status: 200 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchUnpublishHandler(request({ headers: { authorization: 'Bearer user-token' } }), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({
			article: after,
			cache: {
				purgePaths: ['/research', '/research/feed.xml', '/research/report/old-story', '/research/report'],
				status: 'scheduled'
			}
		})
	})

	test('unpublishes in production even when the cache purge is not configured', async () => {
		const logger = vi.spyOn(console, 'log').mockImplementation(() => undefined)
		vi.stubEnv('NODE_ENV', 'production')
		const before = article()
		const after = article({ status: 'draft' })
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: before }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: after }), { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchUnpublishHandler(request({ headers: { authorization: 'Bearer user-token' } }), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({
			article: after,
			cache: {
				purgePaths: ['/research', '/research/feed.xml', '/research/report/old-story', '/research/report'],
				status: 'scheduled'
			}
		})
		await vi.waitFor(() => {
			expect(logger).toHaveBeenCalledWith('CF_ZONE or CF_PURGE_CACHE_AUTH is not set, skipping research cache purge')
		})
	})
})
