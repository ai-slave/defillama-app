import type { NextApiRequest } from 'next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArticleDocument } from '~/containers/Articles/types'
import { researchPublishHandler } from '~/pages/api/private/research/articles/[id]/publish'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

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

describe('/api/private/research/articles/[id]/publish', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
	})

	it('publishes through the backend, then revalidates and purges public research urls', async () => {
		vi.stubEnv('CF_ZONE', 'zone')
		vi.stubEnv('CF_PURGE_CACHE_AUTH', 'token')
		vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://defillama.test')

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

		expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/articles/article-id/edit')
		expect(fetchImpl.mock.calls[0][1]).toEqual({ headers: { Authorization: 'Bearer user-token' } })
		expect(new URL(fetchImpl.mock.calls[1][0]).pathname).toBe('/articles/article-id/publish')
		expect(fetchImpl.mock.calls[1][1]).toEqual({
			body: '{}',
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			method: 'POST'
		})
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
				revalidatePaths: ['/research', '/research/report', '/research/spotlight'],
				status: 'scheduled'
			}
		})

		await vi.waitFor(() => {
			expect(fetchImpl).toHaveBeenLastCalledWith('https://api.cloudflare.com/client/v4/zones/zone/purge_cache', {
				body: JSON.stringify({
					files: [
						'https://defillama.test/research',
						'https://defillama.test/research/feed.xml',
						'https://defillama.test/research/report/old-story',
						'https://defillama.test/research/report',
						'https://defillama.test/research/spotlight/new-story',
						'https://defillama.test/research/spotlight'
					]
				}),
				headers: {
					Authorization: 'Bearer token',
					'Content-Type': 'application/json'
				},
				method: 'POST'
			})
		})
		expect(res.revalidate).toHaveBeenCalledWith('/research')
		expect(res.revalidate).toHaveBeenCalledWith('/research/report')
		expect(res.revalidate).toHaveBeenCalledWith('/research/spotlight')
		expect(res.revalidate).not.toHaveBeenCalledWith('/research/report/old-story')
		expect(res.revalidate).not.toHaveBeenCalledWith('/research/spotlight/new-story')
	})

	it('forwards goLiveAt from query into the backend publish POST body', async () => {
		const before = article()
		const after = article({ status: 'draft', goLiveAt: '2026-06-01T09:00:00.000Z' })
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: before }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: after }), { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchPublishHandler(
			request({
				body: { goLiveAt: '2026-06-01T09:00:00.000Z' },
				headers: { authorization: 'Bearer user-token' }
			}),
			res
		)

		expect(fetchImpl.mock.calls[1][1]).toEqual({
			body: JSON.stringify({ goLiveAt: '2026-06-01T09:00:00.000Z' }),
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			method: 'POST'
		})
	})

	it('forwards goLiveAt=null from query when publishing immediately', async () => {
		const before = article({ status: 'draft', goLiveAt: '2026-06-01T09:00:00.000Z' })
		const after = article({ status: 'published', goLiveAt: null })
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: before }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: after }), { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()

		await researchPublishHandler(
			request({
				body: { goLiveAt: null },
				headers: { authorization: 'Bearer user-token' }
			}),
			res
		)

		expect(fetchImpl.mock.calls[1][1]).toEqual({
			body: JSON.stringify({ goLiveAt: null }),
			headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' },
			method: 'POST'
		})
	})

	it('publishes in production even when cross-instance revalidation is not configured', async () => {
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
				revalidatePaths: ['/research', '/research/report'],
				status: 'scheduled'
			}
		})
	})

	it('keeps the publish successful when background cache work fails', async () => {
		const logger = vi.spyOn(console, 'log').mockImplementation(() => undefined)
		const before = article()
		const after = article()
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: before }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ article: after }), { status: 200 }))
		vi.stubGlobal('fetch', fetchImpl)
		const res = createMockNextApiResponse()
		res.revalidate.mockRejectedValue(new Error('not an ISR route'))

		await researchPublishHandler(request({ headers: { authorization: 'Bearer user-token' } }), res)

		expect(res.status).toHaveBeenCalledWith(200)
		expect(res.status).not.toHaveBeenCalledWith(500)
		await vi.waitFor(() => {
			expect(logger).toHaveBeenCalledWith('Research cache: revalidating /research failed: not an ISR route')
		})
		logger.mockRestore()
	})

	it('passes backend publish failures through without touching caches', async () => {
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

		expect(res.revalidate).not.toHaveBeenCalled()
		expect(fetchImpl).toHaveBeenCalledTimes(2)
		expect(res.status).toHaveBeenCalledWith(403)
		expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' })
	})
})
