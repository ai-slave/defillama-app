import type { NextApiRequest } from 'next'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ArticleDocument } from '~/containers/Articles/types'
import { researchPublishHandler } from '~/pages/api/private/research/articles/[id]/publish'
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

async function expectSkippedResearchPurge(logger: ReturnType<typeof vi.spyOn>) {
	await vi.waitFor(() => {
		expect(logger).toHaveBeenCalledWith('CF_ZONE or CF_PURGE_CACHE_AUTH is not set, skipping research cache purge')
	})
}

describe('/api/private/research/articles/[id]/publish', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	test('publishes through the backend, then purges public research urls', async () => {
		vi.stubEnv('CF_ZONE', 'zone')
		vi.stubEnv('CF_PURGE_CACHE_AUTH', 'token')

		const before = article({ section: 'report', slug: 'old-story' })
		const after = article({ section: 'spotlight', slug: 'new-story' })
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: before }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: after }), { status: 200 }))
			.mockResolvedValueOnce(new Response('{}', { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchPublishHandler(request({ headers: { authorization: 'Bearer user-token' } }), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({
			article: after,
			cache: {
				purgePaths: [
					'/research',
					'/research/feed.xml',
					'/research/report/old-story',
					'/research/report',
					'/research/spotlight/new-story',
					'/research/spotlight'
				],
				status: 'scheduled'
			}
		})
	})

	test('publishes in production even when the cache purge is not configured', async () => {
		const logger = vi.spyOn(console, 'log').mockImplementation(() => undefined)
		vi.stubEnv('NODE_ENV', 'production')
		const before = article()
		const after = article()
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: before }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: after }), { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchPublishHandler(request({ headers: { authorization: 'Bearer user-token' } }), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.json).toHaveBeenCalledWith({
			article: after,
			cache: {
				purgePaths: ['/research', '/research/feed.xml', '/research/report/old-story', '/research/report'],
				status: 'scheduled'
			}
		})
		await expectSkippedResearchPurge(logger)
	})

	test('keeps the publish successful when the background purge fails', async () => {
		vi.stubEnv('CF_ZONE', 'zone')
		vi.stubEnv('CF_PURGE_CACHE_AUTH', 'token')
		const logger = vi.spyOn(console, 'log').mockImplementation(() => undefined)
		const before = article()
		const after = article()
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: before }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: after }), { status: 200 }))
			.mockRejectedValueOnce(new Error('cloudflare is down'))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchPublishHandler(request({ headers: { authorization: 'Bearer user-token' } }), res)

		expect(res.status).toHaveBeenCalledExactlyOnceWith(200)
		expect(res.json).toHaveBeenCalledExactlyOnceWith({
			article: after,
			cache: {
				purgePaths: ['/research', '/research/feed.xml', '/research/report/old-story', '/research/report'],
				status: 'scheduled'
			}
		})
		// Let the rejected purge settle inside the test so an unhandled rejection fails it.
		await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(3))
		logger.mockRestore()
	})

	test('passes backend publish failures through without touching caches', async () => {
		const before = article()
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: before }), { status: 200 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: 'Forbidden' }), {
					headers: { 'Content-Type': 'application/json' },
					status: 403
				})
			)
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchPublishHandler(request({ headers: { authorization: 'Bearer user-token' } }), res)

		expect(fetchImpl).toHaveBeenCalledTimes(2)
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' })
	})
})
