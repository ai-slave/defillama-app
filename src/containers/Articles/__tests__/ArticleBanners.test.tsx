import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResearchPromoBanner } from '../landing/ResearchPromoBanner'
import { ArticleBannerStrip } from '../renderer/ArticleBannerStrip'
import { ArticleImageBanner } from '../renderer/ArticleImageBanner'
import { ArticlePromoBannerMobile, ArticlePromoCard } from '../renderer/ArticlePromoBanner'
import type { Banner, BannerLookupResult } from '../types'

const queryState = vi.hoisted(() => ({
	lookups: new Map<string, BannerLookupResult>()
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: vi.fn(({ queryKey, enabled = true }: { queryKey: unknown[]; enabled?: boolean }) => ({
		data: enabled ? queryState.lookups.get(JSON.stringify(queryKey)) : undefined,
		isLoading: false
	}))
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: vi.fn(),
		isAuthenticated: true,
		loaders: { userLoading: false }
	})
}))

const emptyLookup = (): BannerLookupResult => ({
	text: null,
	image: null,
	imageHorizontal: null,
	promo: null,
	imageSquare: null
})

const banner = (overrides: Partial<Banner>): Banner => ({
	id: 'banner-id',
	type: 'text',
	scope: 'all_articles',
	section: null,
	articleId: null,
	text: null,
	linkUrl: null,
	linkLabel: null,
	imageUrl: null,
	imageAlt: null,
	imageWideUrl: null,
	imageCardUrl: null,
	imageMobileUrl: null,
	disclosureText: null,
	disclosureUrl: null,
	showOnLanding: true,
	excludedArticleIds: [],
	enabled: true,
	createdByPbUserId: 'user-id',
	createdAt: '2026-05-14T00:00:00.000Z',
	updatedAt: '2026-05-14T00:00:00.000Z',
	...overrides
})

const promoBanner = (overrides: Partial<Banner> = {}): Banner =>
	banner({
		id: 'promo-id',
		type: 'promo',
		scope: 'landing',
		linkUrl: 'https://example.com/promo',
		imageWideUrl: '/uploads/promo/wide',
		imageCardUrl: '/uploads/promo/card',
		imageMobileUrl: '/uploads/promo/mobile',
		...overrides
	})

describe('article banners', () => {
	beforeEach(() => {
		queryState.lookups.clear()
	})

	it('falls back from article text to section text to all-articles text', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'article', 'article-id']), emptyLookup())
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'section', 'report']), emptyLookup())
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			text: banner({ id: 'global-text', text: 'Global strip' })
		})

		expect(
			renderToStaticMarkup(<ArticleBannerStrip scope="article" articleId="article-id" section="report" />)
		).toContain('Global strip')

		queryState.lookups.set(JSON.stringify(['research', 'banner', 'section', 'report']), {
			...emptyLookup(),
			text: banner({ id: 'section-text', scope: 'section', text: 'Section strip' })
		})

		const sectionHtml = renderToStaticMarkup(
			<ArticleBannerStrip scope="article" articleId="article-id" section="report" />
		)
		expect(sectionHtml).toContain('Section strip')
		expect(sectionHtml).not.toContain('Global strip')

		queryState.lookups.set(JSON.stringify(['research', 'banner', 'article', 'article-id']), {
			...emptyLookup(),
			text: banner({ id: 'article-text', scope: 'article', text: 'Article strip' })
		})

		const articleHtml = renderToStaticMarkup(
			<ArticleBannerStrip scope="article" articleId="article-id" section="report" />
		)
		expect(articleHtml).toContain('Article strip')
		expect(articleHtml).not.toContain('Section strip')
	})

	it('keys text banner dismissals by banner id and optional API version', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			text: banner({ id: 'landing-text', scope: 'landing', text: 'Landing strip', dismissalVersion: '2026-08' })
		})

		const versionedHtml = renderToStaticMarkup(<ArticleBannerStrip scope="landing" />)
		expect(versionedHtml).toContain('announcement-token--research-banner-landing-text--2026-08')

		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			text: banner({ id: 'fallback-text', scope: 'landing', text: 'Fallback strip' })
		})

		const fallbackHtml = renderToStaticMarkup(<ArticleBannerStrip scope="landing" />)
		expect(fallbackHtml).toContain('announcement-token--research-banner-fallback-text--v1')
	})

	it('falls back to all-articles image banners when article and section images are absent', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'article', 'article-id']), emptyLookup())
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'section', 'report']), emptyLookup())
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			image: banner({
				id: 'global-image',
				type: 'image',
				imageUrl: '/uploads/image/global',
				imageAlt: 'Global image'
			})
		})

		const html = renderToStaticMarkup(<ArticleImageBanner articleId="article-id" section="report" />)

		expect(html).toContain('/uploads/image/global')
		expect(html).toContain('Global image')
	})

	it('hides the all-articles text banner on an excluded article but shows it elsewhere', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'article', 'article-id']), emptyLookup())
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'section', 'report']), emptyLookup())
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			text: banner({ id: 'global-text', text: 'Global strip', excludedArticleIds: ['article-id'] })
		})

		const excludedHtml = renderToStaticMarkup(
			<ArticleBannerStrip scope="article" articleId="article-id" section="report" />
		)
		expect(excludedHtml).not.toContain('Global strip')

		const otherHtml = renderToStaticMarkup(
			<ArticleBannerStrip scope="article" articleId="other-article" section="report" />
		)
		expect(otherHtml).toContain('Global strip')
	})

	it('hides the all-articles image banner on an excluded article but shows it elsewhere', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'article', 'article-id']), emptyLookup())
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'section', 'report']), emptyLookup())
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			image: banner({
				id: 'global-image',
				type: 'image',
				imageUrl: '/uploads/image/global',
				imageAlt: 'Global image',
				excludedArticleIds: ['article-id']
			})
		})

		const excludedHtml = renderToStaticMarkup(<ArticleImageBanner articleId="article-id" section="report" />)
		expect(excludedHtml).not.toContain('/uploads/image/global')

		const otherHtml = renderToStaticMarkup(<ArticleImageBanner articleId="other-article" section="report" />)
		expect(otherHtml).toContain('/uploads/image/global')
	})

	it('renders the landing promo banner with a disclosure link', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			promo: promoBanner({ disclosureUrl: 'https://example.com/disclosure' })
		})

		const html = renderToStaticMarkup(<ResearchPromoBanner />)

		expect(html).toContain('/uploads/promo/wide')
		expect(html).toContain('https://example.com/promo')
		expect(html).toContain('https://example.com/disclosure')
		expect(html).toContain('Disclosure')
	})

	it('uses a custom disclosure label when configured', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			promo: promoBanner({ disclosureUrl: 'https://example.com/disclosure', disclosureText: 'Ad disclosure' })
		})

		expect(renderToStaticMarkup(<ResearchPromoBanner />)).toContain('Ad disclosure')
	})

	it('hides the disclosure link when no disclosure URL is configured', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			promo: promoBanner()
		})

		const html = renderToStaticMarkup(<ResearchPromoBanner />)

		expect(html).toContain('/uploads/promo/wide')
		expect(html).not.toContain('Disclosure')
	})

	it('hides the landing promo banner when no promo is configured or no wide image exists', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), emptyLookup())
		expect(renderToStaticMarkup(<ResearchPromoBanner />)).toBe('')

		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			promo: promoBanner({ imageWideUrl: null })
		})
		expect(renderToStaticMarkup(<ResearchPromoBanner />)).toBe('')
	})

	it('renders the article promo card from the all-articles lookup', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			promo: promoBanner({ disclosureUrl: 'https://example.com/disclosure' })
		})

		const html = renderToStaticMarkup(<ArticlePromoCard articleId="article-id" />)

		expect(html).toContain('/uploads/promo/card')
		expect(html).toContain('https://example.com/promo')
		expect(html).toContain('Disclosure')
	})

	it('hides the article promo card without a card image', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			promo: promoBanner({ imageCardUrl: null })
		})

		expect(renderToStaticMarkup(<ArticlePromoCard articleId="article-id" />)).toBe('')
	})

	it('hides the promo card on an excluded article but shows it elsewhere', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			promo: promoBanner({ excludedArticleIds: ['article-id'] })
		})

		expect(renderToStaticMarkup(<ArticlePromoCard articleId="article-id" />)).toBe('')
		expect(renderToStaticMarkup(<ArticlePromoCard articleId="other-article" />)).toContain('/uploads/promo/card')
		expect(renderToStaticMarkup(<ArticlePromoBannerMobile articleId="article-id" />)).toBe('')
	})

	it('falls back from the mobile promo image to the card image', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			promo: promoBanner()
		})
		expect(renderToStaticMarkup(<ArticlePromoBannerMobile articleId="article-id" />)).toContain('/uploads/promo/mobile')

		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			promo: promoBanner({ imageMobileUrl: null })
		})
		expect(renderToStaticMarkup(<ArticlePromoBannerMobile articleId="article-id" />)).toContain('/uploads/promo/card')

		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			promo: promoBanner({ imageMobileUrl: null, imageCardUrl: null })
		})
		expect(renderToStaticMarkup(<ArticlePromoBannerMobile articleId="article-id" />)).toBe('')
	})
})
