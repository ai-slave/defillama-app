import { afterEach, describe, expect, test, vi } from 'vitest'
import {
	ArticleApiError,
	getSponsoredResearchReports,
	getLandingBanner,
	getTrustedBySection,
	linkResearchSponsorReport,
	listArticles,
	listArticlesByTopic,
	publishArticle,
	revalidateResearchLanding,
	setEditorialTag,
	unlinkResearchSponsorReport
} from '../api'

const createFetchMock = (response: Response) => vi.fn(async (_url: string, _options?: RequestInit) => response.clone())

describe('articles api client', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	test('builds discovery query parameters', async () => {
		const fetchFn = createFetchMock(
			new Response(JSON.stringify({ items: [], page: 1, perPage: 20, totalItems: 0, totalPages: 1 }))
		)

		await listArticles({ query: 'stablecoins', tags: ['lending'], sort: 'newest', section: 'report' }, fetchFn)

		const url = new URL(fetchFn.mock.calls[0][0])
		expect(url.pathname).toBe('/articles')
		expect(url.searchParams.get('query')).toBe('stablecoins')
		expect(url.searchParams.get('tags')).toBe('lending')
		expect(url.searchParams.get('sort')).toBe('newest')
		expect(url.searchParams.get('section')).toBe('report')
	})

	test('lists articles by topic via listArticles tags param', async () => {
		const fetchFn = createFetchMock(
			new Response(JSON.stringify({ items: [], page: 1, perPage: 60, totalItems: 0, totalPages: 1 }))
		)

		await listArticlesByTopic('lending', { limit: 60, sort: 'newest' }, fetchFn)

		const url = new URL(fetchFn.mock.calls[0][0])
		expect(url.pathname).toBe('/articles')
		expect(url.searchParams.get('tags')).toBe('lending')
		expect(url.searchParams.get('sort')).toBe('newest')
		expect(url.searchParams.get('limit')).toBe('60')
	})

	test('posts editorial tag with optional order', async () => {
		const fetchFn = createFetchMock(
			new Response(JSON.stringify({ articleId: 'article-id', tag: 'spotlight', order: 2 }))
		)

		await setEditorialTag('article-id', 'spotlight', fetchFn, { order: 2 })

		const [url, options] = fetchFn.mock.calls[0]
		expect(new URL(url).pathname).toBe('/articles/article-id/editorial-tags/spotlight')
		expect(options?.method).toBe('POST')
		expect(JSON.parse(String(options?.body))).toEqual({ order: 2 })
	})

	test('routes publish through the local research API proxy', async () => {
		const fetchFn = createFetchMock(new Response(JSON.stringify({ article: { id: 'article-id' } })))

		await publishArticle('article-id', fetchFn)

		const [url, options] = fetchFn.mock.calls[0]
		expect(url).toBe('/api/private/research/articles/article-id/publish')
		expect(options?.method).toBe('POST')
		expect(JSON.parse(options?.body as string)).toEqual({})
	})

	test('sends goLiveAt when scheduling publish', async () => {
		const fetchFn = createFetchMock(new Response(JSON.stringify({ article: { id: 'article-id' } })))

		await publishArticle('article-id', fetchFn, { goLiveAt: '2026-06-01T09:00:00.000Z' })

		const [, options] = fetchFn.mock.calls[0]
		expect(options?.method).toBe('POST')
		expect(JSON.parse(options?.body as string)).toEqual({ goLiveAt: '2026-06-01T09:00:00.000Z' })
	})

	test('sends goLiveAt null when publishing immediately after schedule', async () => {
		const fetchFn = createFetchMock(new Response(JSON.stringify({ article: { id: 'article-id' } })))

		await publishArticle('article-id', fetchFn, { goLiveAt: null })

		const [, options] = fetchFn.mock.calls[0]
		expect(options?.method).toBe('POST')
		expect(JSON.parse(options?.body as string)).toEqual({ goLiveAt: null })
	})

	test('requests research landing revalidation with a nonce', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1_779_199_600_000)
		const fetchFn = createFetchMock(
			new Response(
				JSON.stringify({ cloudflare: { status: 'skipped' }, revalidateErrors: [], revalidated: ['/research'] })
			)
		)

		await revalidateResearchLanding(fetchFn)

		const [url, options] = fetchFn.mock.calls[0]
		expect(url).toBe('/api/private/research/revalidate-landing?_n=1779199600000')
		expect(options?.method).toBe('GET')
	})

	test('strips PocketBase creator ids from public banner and trusted-by lookups', async () => {
		const bannerFetch = createFetchMock(
			new Response(
				JSON.stringify({
					text: {
						id: 'banner-id',
						type: 'text',
						createdByPbUserId: 'banner-creator-id'
					},
					image: null,
					imageHorizontal: null,
					promo: null,
					imageSquare: null
				})
			)
		)
		const trustedByFetch = createFetchMock(
			new Response(
				JSON.stringify({
					logos: [{ id: 'logo-id', createdByPbUserId: 'logo-creator-id' }],
					mentions: [{ id: 'mention-id', createdByPbUserId: 'mention-creator-id' }]
				})
			)
		)

		const banner = await getLandingBanner(bannerFetch)
		const trustedBy = await getTrustedBySection(trustedByFetch)

		expect(banner.text).not.toHaveProperty('createdByPbUserId')
		expect(trustedBy.logos[0]).not.toHaveProperty('createdByPbUserId')
		expect(trustedBy.mentions[0]).not.toHaveProperty('createdByPbUserId')
	})

	test('requests sponsored reports by canonical entity identity with a cache nonce', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1_786_635_600_000)
		const fetchFn = createFetchMock(new Response(JSON.stringify({ sponsor: null, reports: [] })))

		await getSponsoredResearchReports('chain', 'starknet', { limit: 3, fetchFn })

		const url = new URL(fetchFn.mock.calls[0][0])
		expect(url.pathname).toBe('/research/sponsors/lookup/chain/starknet')
		expect(url.searchParams.get('limit')).toBe('3')
		expect(url.searchParams.get('_n')).toBe('1786635600000')
	})

	test('links and unlinks a sponsored report through the researcher API', async () => {
		const authorizedFetch = createFetchMock(new Response(JSON.stringify({ linked: true })))

		await linkResearchSponsorReport('sponsor/id', 'article/id', authorizedFetch)
		await unlinkResearchSponsorReport('sponsor/id', 'article/id', authorizedFetch)

		const [linkUrl, linkOptions] = authorizedFetch.mock.calls[0]
		const [unlinkUrl, unlinkOptions] = authorizedFetch.mock.calls[1]
		expect(new URL(linkUrl).pathname).toBe('/research/sponsors/sponsor%2Fid/reports/article%2Fid')
		expect(linkOptions?.method).toBe('PUT')
		expect(new URL(unlinkUrl).pathname).toBe('/research/sponsors/sponsor%2Fid/reports/article%2Fid')
		expect(unlinkOptions?.method).toBe('DELETE')
	})

	test('surfaces server errors', async () => {
		const fetchFn = createFetchMock(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }))

		await expect(listArticles({}, fetchFn)).rejects.toMatchObject({
			name: 'ArticleApiError',
			message: 'Unauthorized',
			status: 401
		})
		await expect(listArticles({}, fetchFn)).rejects.toBeInstanceOf(ArticleApiError)
	})
})
