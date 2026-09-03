import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	getAllArticlesBanner,
	getArticleBanner,
	getArticleBySlug,
	getLandingBanner,
	getResearchLanding,
	getSectionBanner,
	getTrustedBySection,
	listArticles,
	listArticlesByTag,
	listArticlesByTopic
} from '~/containers/Articles/api'
import { ReportsCarousel } from '~/containers/Articles/landing/ReportsCarousel'
import { getResearchNewsletterItems } from '~/containers/Articles/newsletterFeed.server'
import type { ArticleDocument, BannerLookupResult, TrustedByLookupResult } from '~/containers/Articles/types'
import ArticlesPage, { getServerSideProps as getResearchServerSideProps } from '~/pages/research'
import SectionLandingPage, { getServerSideProps as getSectionLandingServerSideProps } from '~/pages/research/[section]'
import SectionArticlePage, { getServerSideProps as getArticleServerSideProps } from '~/pages/research/[section]/[slug]'
import TopicLandingPage, { getServerSideProps as getTopicLandingServerSideProps } from '~/pages/research/topics/[topic]'

const routerMock = vi.hoisted(() => vi.fn())

vi.mock('next/router', () => ({
	useRouter: () => routerMock()
}))

vi.mock('~/containers/Articles/api', () => ({
	ArticleApiError: class ArticleApiError extends Error {
		status: number
		constructor(message: string, status: number) {
			super(message)
			this.status = status
		}
	},
	getAllArticlesBanner: vi.fn(),
	getArticleBanner: vi.fn(),
	getArticleBySlug: vi.fn(),
	getLandingBanner: vi.fn(),
	getResearchLanding: vi.fn(),
	getSectionBanner: vi.fn(),
	getTrustedBySection: vi.fn(),
	listArticlePaths: vi.fn(),
	listArticles: vi.fn(),
	listArticlesByTag: vi.fn(),
	listArticlesByTopic: vi.fn()
}))

vi.mock('~/containers/Articles/newsletterFeed.server', () => ({
	getResearchNewsletterItems: vi.fn()
}))

vi.mock('~/containers/Articles/ArticleProxyAuthProvider', () => ({
	ArticleProxyAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('~/containers/ProDashboard/AppMetadataContext', () => ({
	AppMetadataProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: vi.fn(),
		hasActiveSubscription: false,
		isAuthenticated: false,
		loaders: { userLoading: false },
		user: null
	})
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
	return renderToStaticMarkup(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
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

function articleList(items: ArticleDocument[]) {
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

describe('research SSR data loading', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		routerMock.mockReturnValue({
			isReady: false,
			pathname: '/research',
			query: {},
			replace: vi.fn()
		})
		vi.mocked(listArticles).mockResolvedValue(articleList([article()]))
		vi.mocked(listArticlesByTag).mockResolvedValue({ items: [article()] })
		vi.mocked(listArticlesByTopic).mockResolvedValue(topicArticleList(4))
		vi.mocked(getResearchLanding).mockResolvedValue({
			heroReports: [article()],
			latest: [article()],
			spotlight: [article()],
			interviews: [article()],
			highlight: [article()],
			insights: [article()],
			moreReportsCandidates: [article()],
			spotlightColumnCandidates: [article()],
			collectionsCandidates: [article()]
		})
		vi.mocked(getLandingBanner).mockResolvedValue(emptyBanner)
		vi.mocked(getArticleBanner).mockResolvedValue(emptyBanner)
		vi.mocked(getSectionBanner).mockResolvedValue(emptyBanner)
		vi.mocked(getAllArticlesBanner).mockResolvedValue(emptyBanner)
		vi.mocked(getTrustedBySection).mockResolvedValue(emptyTrustedBy)
		vi.mocked(getResearchNewsletterItems).mockResolvedValue([
			{
				id: 'newsletter-1',
				title: 'Research Notes newsletter',
				description: 'Research Notes',
				href: 'https://defillama-research.beehiiv.com/p/research-notes',
				imageUrl: null,
				publishedAt: '2026-08-27T18:10:12.000Z'
			}
		])
	})

	it('loads landing page props for SSR and renders article content immediately', async () => {
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
		expect(getLandingBanner).toHaveBeenCalledTimes(1)

		const html = renderWithQueryClient(<ArticlesPage {...props} />)
		expect(html).toContain('Canonical Research')
		expect(html).toContain('Research Notes newsletter')
	})

	it('keeps the interviews section when the Beehiiv feed is unavailable', async () => {
		vi.mocked(getResearchNewsletterItems).mockRejectedValueOnce(new Error('Beehiiv unavailable'))

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

	it('server-renders the reports carousel centered before client measurement', () => {
		const html = renderToStaticMarkup(
			<ReportsCarousel
				showButtons={false}
				reports={Array.from({ length: 5 }, (_, index) =>
					article({
						id: `article-${index}`,
						slug: `article-${index}`,
						title: `Article ${index}`
					})
				)}
			/>
		)

		expect(html).toContain('left:50%')
		expect(html).toContain('translateX(calc(-50% + 0px)) scale(1)')
		expect(html).not.toContain('translate(calc(0px + -147px))')
	})

	it('loads section landing props for SSR and renders articles immediately', async () => {
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
		expect(getSectionBanner).toHaveBeenCalledWith('report')

		const html = renderWithQueryClient(<SectionLandingPage {...props} />)
		expect(html).toContain('Canonical Research')
		expect(html).toContain('Report')
	})

	it('returns notFound for invalid section slugs', async () => {
		await expect(
			getSectionLandingServerSideProps({
				params: { section: 'not-a-section' },
				req: { method: 'GET' },
				res: { setHeader: vi.fn() },
				resolvedUrl: '/research/not-a-section'
			} as never)
		).resolves.toMatchObject({ notFound: true })
	})

	it('loads topic landing props for SSR and renders articles immediately', async () => {
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
		expect(listArticlesByTopic).toHaveBeenCalledWith('lending', { sort: 'newest', limit: 60 })

		const html = renderWithQueryClient(<TopicLandingPage {...props} />)
		expect(html).toContain('Canonical Research')
		expect(html).toContain('lending')
	})

	it('returns notFound for invalid topic slugs', async () => {
		await expect(
			getTopicLandingServerSideProps({
				params: { topic: '!!!' },
				req: { method: 'GET' },
				res: { setHeader: vi.fn() },
				resolvedUrl: '/research/topics/!!!'
			} as never)
		).resolves.toMatchObject({ notFound: true })
	})

	it('safely redirects malformed encoded topic slugs to a normalized path', async () => {
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

	it('returns notFound when a topic has fewer than four articles', async () => {
		vi.mocked(listArticlesByTopic).mockResolvedValueOnce(topicArticleList(3))

		await expect(
			getTopicLandingServerSideProps({
				params: { topic: 'lending' },
				req: { method: 'GET' },
				res: { setHeader: vi.fn() },
				resolvedUrl: '/research/topics/lending'
			} as never)
		).resolves.toMatchObject({ notFound: true })
	})

	it('redirects non-canonical topic slugs to the normalized path', async () => {
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

	it('loads sanitized article props for SSR and renders article body immediately', async () => {
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
		vi.mocked(getArticleBySlug).mockResolvedValue(publicArticle)

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
		expect(getArticleBanner).toHaveBeenCalledWith('article-id')

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
	})

	it('does not render legacy draft preview controls on the public article page', () => {
		routerMock.mockReturnValue({
			isReady: true,
			pathname: '/research/[section]/[slug]',
			query: { section: 'report', slug: 'canonical-research' },
			replace: vi.fn()
		})

		const html = renderWithQueryClient(
			<SectionArticlePage initialArticle={article({ status: 'draft' })} initialBanners={{}} />
		)
		expect(html).not.toContain('Draft preview')
	})

	it('keeps the server-rendered article visible when its background refetch fails', () => {
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
		expect(html).not.toContain("Couldn't load research")
	})

	it('returns notFound for missing articles and redirects non-canonical article urls', async () => {
		vi.mocked(getArticleBySlug).mockResolvedValueOnce(null)
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

		vi.mocked(getArticleBySlug).mockResolvedValueOnce(article())
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
