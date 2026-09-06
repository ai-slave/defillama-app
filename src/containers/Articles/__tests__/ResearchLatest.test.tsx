import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ResearchLatest } from '../landing/ResearchLatest'
import type { ArticleDocument, Banner, BannerLookupResult } from '../types'

const queryState = vi.hoisted(() => ({
	lookups: new Map<string, BannerLookupResult>()
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: vi.fn(({ queryKey, enabled = true }: { queryKey: Array<unknown>; enabled?: boolean }) => ({
		data: enabled ? queryState.lookups.get(JSON.stringify(queryKey)) : undefined,
		isLoading: false
	}))
}))

const emptyLookup = (): BannerLookupResult => ({
	text: null,
	image: null,
	imageHorizontal: null,
	promo: null,
	imageSquare: null
})

const squareBanner = (overrides: Partial<Banner> = {}): Banner => ({
	id: 'square-id',
	type: 'image-square',
	scope: 'landing',
	section: null,
	articleId: null,
	text: null,
	linkUrl: 'https://example.com/square',
	linkLabel: null,
	imageUrl: '/uploads/square/banner',
	imageAlt: 'Square banner',
	imageWideUrl: null,
	imageCardUrl: null,
	imageMobileUrl: null,
	disclosureText: null,
	disclosureUrl: null,
	showOnLanding: true,
	excludedArticleIds: [],
	targetCountries: [],
	enabled: true,
	createdByPbUserId: 'user-id',
	createdAt: '2026-08-05T00:00:00.000Z',
	updatedAt: '2026-08-05T00:00:00.000Z',
	...overrides
})

function article(index: number): ArticleDocument {
	return {
		id: `article-${index}`,
		contentVersion: 1,
		rendererVersion: 1,
		editorSchemaVersion: 1,
		title: `Latest article ${index}`,
		subtitle: null,
		slug: `latest-article-${index}`,
		status: 'published',
		seoTitle: null,
		seoDescription: null,
		excerpt: null,
		coverImage: { url: `/uploads/cover/${index}`, alt: `Cover ${index}` },
		carouselImage: null,
		sponsorLogo: null,
		reportDescription: null,
		reportPdf: null,
		contentJson: { type: 'doc', content: [] },
		plainText: '',
		entities: [],
		charts: [],
		citations: [],
		embeds: [],
		tags: [],
		section: 'report',
		displayDate: '2026-08-01T00:00:00.000Z',
		brandByline: true,
		featuredRank: null,
		featuredUntil: null,
		createdAt: '2026-08-01T00:00:00.000Z',
		updatedAt: '2026-08-01T00:00:00.000Z',
		publishedAt: '2026-08-01T00:00:00.000Z',
		firstPublishedAt: '2026-08-01T00:00:00.000Z',
		lastPublishedAt: '2026-08-01T00:00:00.000Z',
		authorProfile: null,
		coAuthors: [],
		interviewees: null,
		pending: null,
		pendingUpdatedAt: null,
		pendingActorPbUserId: null,
		editorialTags: []
	} as unknown as ArticleDocument
}

const articles = () => Array.from({ length: 6 }, (_, index) => article(index + 1))

const landingKey = JSON.stringify(['research', 'banner', 'landing'])

describe('ResearchLatest', () => {
	beforeEach(() => {
		queryState.lookups.clear()
	})

	test('renders all six articles in order when no square banner is configured', () => {
		queryState.lookups.set(landingKey, emptyLookup())

		const html = renderToStaticMarkup(<ResearchLatest articles={articles()} />)

		const positions = [1, 2, 3, 4, 5, 6].map((index) => html.indexOf(`/research/report/latest-article-${index}`))
		for (const position of positions) {
			expect(position).toBeGreaterThan(-1)
		}
		expect([...positions].sort((a, b) => a - b)).toEqual(positions)
		expect(html).not.toContain('/uploads/square/banner')
	})

	test('renders the Figma navigation order before the latest articles', () => {
		queryState.lookups.set(landingKey, emptyLookup())

		const html = renderToStaticMarkup(<ResearchLatest articles={articles()} />)
		const anchors = ['#spotlight', '#reports', '#insights', '#interviews', '#collections', '#clients']
		const positions = anchors.map((anchor) => html.indexOf(`href="${anchor}"`))

		expect(positions.every((position) => position >= 0)).toBe(true)
		expect([...positions].sort((a, b) => a - b)).toEqual(positions)
		expect(html).toContain('>Spotlights</a>')
		expect(positions[5]).toBeLessThan(html.indexOf('Latest from DefiLlama Research'))
	})

	test('replaces articles 4-6 with the square banner when configured', () => {
		queryState.lookups.set(landingKey, { ...emptyLookup(), imageSquare: squareBanner() })

		const html = renderToStaticMarkup(<ResearchLatest articles={articles()} />)

		expect(html).toContain('/research/report/latest-article-1')
		expect(html).toContain('/research/report/latest-article-2')
		expect(html).toContain('/research/report/latest-article-3')
		expect(html).not.toContain('/research/report/latest-article-4')
		expect(html).not.toContain('/research/report/latest-article-5')
		expect(html).not.toContain('/research/report/latest-article-6')
		expect(html).toContain('/uploads/square/banner')
		expect(html).toContain('https://example.com/square')
	})

	test('keeps six articles when the square banner has no image or is disabled', () => {
		queryState.lookups.set(landingKey, { ...emptyLookup(), imageSquare: squareBanner({ imageUrl: '  ' }) })

		let html = renderToStaticMarkup(<ResearchLatest articles={articles()} />)
		expect(html).toContain('/research/report/latest-article-6')
		expect(html).not.toContain('https://example.com/square')

		queryState.lookups.set(landingKey, { ...emptyLookup(), imageSquare: squareBanner({ enabled: false }) })

		html = renderToStaticMarkup(<ResearchLatest articles={articles()} />)
		expect(html).toContain('/research/report/latest-article-6')
		expect(html).not.toContain('/uploads/square/banner')
		expect(html).not.toContain('https://example.com/square')
	})

	test('keeps six articles while a restricted square banner has no resolved visitor country', () => {
		queryState.lookups.set(landingKey, {
			...emptyLookup(),
			imageSquare: squareBanner({ targetCountries: ['FI'] })
		})

		const html = renderToStaticMarkup(<ResearchLatest articles={articles()} />)

		expect(html).toContain('/research/report/latest-article-6')
		expect(html).not.toContain('/uploads/square/banner')
	})

	test('renders the square banner without a link when linkUrl is empty', () => {
		queryState.lookups.set(landingKey, { ...emptyLookup(), imageSquare: squareBanner({ linkUrl: null }) })

		const html = renderToStaticMarkup(<ResearchLatest articles={articles()} />)

		expect(html).toContain('/uploads/square/banner')
		expect(html).not.toContain('target="_blank"')
		expect(html).not.toContain('/research/report/latest-article-4')
	})
})
