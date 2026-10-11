import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { installFixtureFetch, fixtureStatus } from '~/utils/testing/fixtureFetch'
const http = installFixtureFetch()
import type { ArticleDocument, BannerLookupResult, TrustedByLookupResult } from '~/containers/Articles/types'
import ArticlesPage, { getServerSideProps as getResearchServerSideProps } from '~/pages/research'
import SectionLandingPage, { getServerSideProps as getSectionLandingServerSideProps } from '~/pages/research/[section]'
import SectionArticlePage, { getServerSideProps as getArticleServerSideProps } from '~/pages/research/[section]/[slug]'
import TopicLandingPage, { getServerSideProps as getTopicLandingServerSideProps } from '~/pages/research/topics/[topic]'

const routerMock = vi.hoisted(() => vi.fn())

vi.mock('next/router', () => ({
	useRouter: () => routerMock()
}))

vi.mock('~/layout', () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>
}))

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false
			}
		}
	})
}

function renderWithQueryClient(element: ReactElement, queryClient = createQueryClient()) {
	return renderToStaticMarkup(
		<QueryClientProvider client={queryClient}>
			<AuthProvider>{element}</AuthProvider>
		</QueryClientProvider>
	)
}

function article(overrides: Partial<ArticleDocument> = {}): ArticleDocument {
	return {
		id: 'article-id',
		contentVersion: 1,
		rendererVersion: 1,
		editorSchemaVersion: 1,
		title: 'Canonical Research',
		subtitle: 'Server-side subtitle',
		slug: 'canonical-research',
		status: 'published',
		seoTitle: 'Canonical Research SEO',
		seoDescription: 'Research rendered on the server.',
		excerpt: 'Research excerpt',
		coverImage: null,
		carouselImage: null,
		sponsorLogo: null,
		reportDescription: null,
		reportPdf: null,
		contentJson: {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [{ type: 'text', text: 'Server rendered body' }]
				}
			]
		},
		plainText: 'Server rendered body',
		entities: [],
		charts: [],
		citations: [],
		embeds: [],
		tags: ['research'],
		section: 'report',
		displayDate: '2026-05-15T00:00:00.000Z',
		brandByline: true,
		featuredRank: null,
		featuredUntil: null,
		createdAt: '2026-05-15T00:00:00.000Z',
		updatedAt: '2026-05-15T00:00:00.000Z',
		publishedAt: '2026-05-15T00:00:00.000Z',
		firstPublishedAt: '2026-05-15T00:00:00.000Z',
		lastPublishedAt: '2026-05-15T00:00:00.000Z',
		authorProfile: {
			id: 'profile-id',
			pbUserId: 'author-id',
			slug: 'author',
			displayName: 'Research Author',
			bio: null,
			avatarUrl: null,
			socials: {},
			createdAt: '2026-05-15T00:00:00.000Z',
			updatedAt: '2026-05-15T00:00:00.000Z'
		},
		coAuthors: [],
		interviewees: null,
		pending: null,
		pendingUpdatedAt: null,
		pendingActorPbUserId: null,
		editorialTags: [],
		...overrides
	}
}

function articleList(items: Array<ArticleDocument>) {
	return {
		items,
		page: 1,
		perPage: items.length,
		totalItems: items.length,
		totalPages: 1
	}
}

function topicArticleList(count: number) {
	return articleList(
		Array.from({ length: count }, (_, index) =>
			article({ tags: ['lending'], id: `topic-article-${index}`, slug: `topic-article-${index}` })
		)
	)
}

const emptyBanner: BannerLookupResult = {
	text: null,
	image: null,
	imageHorizontal: null,
	promo: null,
	imageSquare: null
}

const emptyTrustedBy: TrustedByLookupResult = {
	logos: [],
	mentions: []
}

let feedId = 0
afterEach(() => vi.unstubAllEnvs())

describe('research SSR data loading', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		routerMock.mockReturnValue({
			isReady: false,
			pathname: '/research',
			query: {},
			replace: vi.fn()
		})
		vi.stubEnv('BEEHIIV_RESEARCH_RSS_URL', `https://rss.beehiiv.com/test-${++feedId}.xml`)
		http.serve({
			'/articles': (url: URL) => (url.searchParams.has('tags') ? topicArticleList(4) : articleList([article()])),
			'/articles/by-tag/research': { items: [article()] },
			'/articles/landing': {
				heroReports: [article()],
				latest: [article()],
				spotlight: [article()],
				interviews: [article()],
				highlight: [article()],
				insights: [article()],
				moreReportsCandidates: [article()],
				spotlightColumnCandidates: [article()],
				collectionsCandidates: [article()]
			},
			'/banners/lookup/landing': emptyBanner,
			'/banners/lookup/article/article-id': emptyBanner,
			'/banners/lookup/section/report': emptyBanner,
			'/banners/lookup/all-articles': emptyBanner,
			'/research/trusted-by/lookup': emptyTrustedBy,
			'https://rss.beehiiv.com/': () =>
				new Response(
					'<rss><channel><item><title>Research Notes newsletter</title><link>https://defillama-research.beehiiv.com/p/research-notes</link><pubDate>Thu, 27 Aug 2026 18:10:12 GMT</pubDate></item></channel></rss>'
				)
		})
	})

	test('loads landing page props for SSR and renders article content immediately', async () => {
		const setHeader = vi.fn()
		const result = await getResearchServerSideProps({
			req: { method: 'GET' },
			res: { setHeader },
			resolvedUrl: '/research'
		} as never)

		expect(setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'))
		if (!('props' in result)) throw new Error('expected props')
		const props = await Promise.resolve(result.props)
		expect(props.landingData.heroReports[0]?.title).toBe('Canonical Research')
		expect(props.newsletterItems[0]?.title).toBe('Research Notes newsletter')

		const html = renderWithQueryClient(<ArticlesPage {...props} />)
		expect(html).toContain('Canonical Research')
		expect(html).toContain('Research Notes newsletter')
	})

	test('keeps the interviews section when the Beehiiv feed is unavailable', async () => {
		http.serve({ 'https://rss.beehiiv.com/': fixtureStatus(503) })

		const result = await getResearchServerSideProps({
			req: { method: 'GET' },
			res: { setHeader: vi.fn() },
			resolvedUrl: '/research'
		} as never)

		if (!('props' in result)) throw new Error('expected props')
		const props = await Promise.resolve(result.props)
		expect(props.newsletterItems).toEqual([])

		const html = renderWithQueryClient(<ArticlesPage {...props} />)
		expect(html).toContain('Interviews')
		expect(html).not.toContain('Research Notes Newsletters')
	})

	test('loads section landing props for SSR and renders articles immediately', async () => {
		const setHeader = vi.fn()
		const result = await getSectionLandingServerSideProps({
			params: { section: 'report' },
			req: { method: 'GET' },
			res: { setHeader },
			resolvedUrl: '/research/report'
		} as never)

		expect(setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'))
		if (!('props' in result)) throw new Error('expected props')
		const props = await Promise.resolve(result.props)
		expect(props.section).toBe('report')
		expect(props.initialArticles.items[0]?.title).toBe('Canonical Research')

		const html = renderWithQueryClient(<SectionLandingPage {...props} />)
		expect(html).toContain('Canonical Research')
		expect(html).toContain('Report')
	})

	test('returns notFound for invalid section slugs', async () => {
		await expect(
			getSectionLandingServerSideProps({
				params: { section: 'not-a-section' },
				req: { method: 'GET' },
				res: { setHeader: vi.fn() },
				resolvedUrl: '/research/not-a-section'
			} as never)
		).resolves.toMatchObject({ notFound: true })
	})

	test('loads topic landing props for SSR and renders articles immediately', async () => {
		const setHeader = vi.fn()
		const result = await getTopicLandingServerSideProps({
			params: { topic: 'lending' },
			req: { method: 'GET' },
			res: { setHeader },
			resolvedUrl: '/research/topics/lending'
		} as never)

		expect(setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'))
		if (!('props' in result)) throw new Error('expected props')
		const props = await Promise.resolve(result.props)
		expect(props.topic).toBe('lending')
		expect(props.initialArticles.items[0]?.title).toBe('Canonical Research')

		const html = renderWithQueryClient(<TopicLandingPage {...props} />)
		expect(html).toContain('Canonical Research')
		expect(html).toContain('lending')
	})

	test('returns notFound for invalid topic slugs', async () => {
		await expect(
			getTopicLandingServerSideProps({
				params: { topic: '!!!' },
				req: { method: 'GET' },
				res: { setHeader: vi.fn() },
				resolvedUrl: '/research/topics/!!!'
			} as never)
		).resolves.toMatchObject({ notFound: true })
	})

	test('safely redirects malformed encoded topic slugs to a normalized path', async () => {
		await expect(
			getTopicLandingServerSideProps({
				params: { topic: '%E0%A4%A' },
				req: { method: 'GET' },
				res: { setHeader: vi.fn() },
				resolvedUrl: '/research/topics/%E0%A4%A'
			} as never)
		).resolves.toMatchObject({
			redirect: {
				destination: '/research/topics/e0-a4-a',
				permanent: true
			}
		})
	})

	test('returns notFound when a topic has fewer than four articles', async () => {
		http.serve({ '/articles': topicArticleList(3) })

		await expect(
			getTopicLandingServerSideProps({
				params: { topic: 'lending' },
				req: { method: 'GET' },
				res: { setHeader: vi.fn() },
				resolvedUrl: '/research/topics/lending'
			} as never)
		).resolves.toMatchObject({ notFound: true })
	})

	test('redirects non-canonical topic slugs to the normalized path', async () => {
		await expect(
			getTopicLandingServerSideProps({
				params: { topic: 'Lending' },
				req: { method: 'GET' },
				res: { setHeader: vi.fn() },
				resolvedUrl: '/research/topics/Lending'
			} as never)
		).resolves.toMatchObject({
			redirect: {
				destination: '/research/topics/lending',
				permanent: true
			}
		})
	})

	test('loads sanitized article props for SSR and renders article body immediately', async () => {
		const publicArticle = article({
			author: 'Internal Admin',
			coAuthors: [
				{
					id: 'coauthor-profile-id',
					pbUserId: 'coauthor-pb-id',
					slug: 'internal-admin',
					displayName: 'Internal Admin',
					bio: null,
					avatarUrl: null,
					socials: {},
					createdAt: '2026-05-15T00:00:00.000Z',
					updatedAt: '2026-05-15T00:00:00.000Z'
				}
			]
		})
		http.serve({ '/articles/canonical-research': { article: publicArticle } })

		const setHeader = vi.fn()
		const result = await getArticleServerSideProps({
			params: { section: 'report', slug: 'canonical-research' },
			req: { method: 'GET' },
			resolvedUrl: '/research/report/canonical-research',
			res: { setHeader }
		} as never)

		expect(setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'))
		if (!('props' in result)) throw new Error('expected props')
		const props = await result.props
		expect(props.initialArticle.title).toBe('Canonical Research')
		expect(props.initialArticle.author).toBe('DefiLlama Research')
		expect(props.initialArticle).not.toHaveProperty('authorProfile')
		expect(props.initialArticle.coAuthors).toEqual([
			{
				slug: 'internal-admin',
				displayName: 'Internal Admin',
				bio: null,
				avatarUrl: null,
				socials: {},
				createdAt: '2026-05-15T00:00:00.000Z',
				updatedAt: '2026-05-15T00:00:00.000Z'
			}
		])
		expect(props.initialArticle.coAuthors?.[0]).not.toHaveProperty('id')
		expect(props.initialArticle.coAuthors?.[0]).not.toHaveProperty('pbUserId')

		routerMock.mockReturnValue({
			isReady: true,
			pathname: '/research/[section]/[slug]',
			query: { section: 'report', slug: 'canonical-research' },
			replace: vi.fn()
		})
		const html = renderWithQueryClient(<SectionArticlePage {...props} />)
		expect(html).toContain('Canonical Research')
		expect(html).toContain('Server rendered body')
		expect(html).toContain('Internal Admin')
		expect(html).toContain('aria-label="Search DefiLlama Research and Newsletters"')
	})

	test('keeps the server-rendered article visible when its background refetch fails', () => {
		const queryClient = createQueryClient()
		const queryKey = ['research', 'article', 'canonical-research']
		queryClient.setQueryData(queryKey, article())
		const cachedQuery = queryClient.getQueryCache().find({ queryKey })
		if (!cachedQuery) throw new Error('expected cached article query')
		cachedQuery.setState({
			error: new Error('Background refetch failed'),
			status: 'error'
		})

		const html = renderWithQueryClient(
			<SectionArticlePage initialArticle={article()} initialBanners={{}} />,
			queryClient
		)
		expect(html).toContain('Canonical Research')
		expect(html).toContain('Server rendered body')
		expect(html).not.toContain('role="alert"')
	})

	test('keeps the server-rendered landing page visible when its background refetch fails', async () => {
		const result = await getResearchServerSideProps({
			req: { method: 'GET' },
			res: { setHeader: vi.fn() },
			resolvedUrl: '/research'
		} as never)
		if (!('props' in result)) throw new Error('expected props')
		const props = await Promise.resolve(result.props)
		const queryClient = createQueryClient()
		queryClient.setQueryData(['research-landing'], {
			landingData: props.landingData,
			landingBanner: props.landingBanner,
			trustedBy: props.trustedBy
		})
		queryClient
			.getQueryCache()
			.find({ queryKey: ['research-landing'] })!
			.setState({ error: new Error('Background refetch failed'), status: 'error' })

		const html = renderWithQueryClient(<ArticlesPage {...props} />, queryClient)
		expect(html).toContain('Canonical Research')
		expect(html).not.toContain('role="alert"')
	})

	test('returns notFound for missing articles and redirects non-canonical article urls', async () => {
		http.serve({ '/articles/missing': fixtureStatus(404) })
		const notFoundSetHeader = vi.fn()
		await expect(
			getArticleServerSideProps({
				params: { section: 'report', slug: 'missing' },
				req: { method: 'GET' },
				resolvedUrl: '/research/report/missing',
				res: { setHeader: notFoundSetHeader }
			} as never)
		).resolves.toMatchObject({ notFound: true })
		expect(notFoundSetHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')

		http.serve({ '/articles/old-research': { article: article() } })
		const redirectSetHeader = vi.fn()
		await expect(
			getArticleServerSideProps({
				params: { section: 'report', slug: 'old-research' },
				req: { method: 'GET' },
				resolvedUrl: '/research/report/old-research',
				res: { setHeader: redirectSetHeader }
			} as never)
		).resolves.toMatchObject({
			redirect: {
				destination: '/research/report/canonical-research',
				permanent: false
			}
		})
		expect(redirectSetHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
	})
})
