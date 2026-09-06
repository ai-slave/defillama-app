import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ResearchPromoBanner } from '../landing/ResearchPromoBanner'
import { ArticleBannerStrip } from '../renderer/ArticleBannerStrip'
import { ArticleImageBanner } from '../renderer/ArticleImageBanner'
import { ArticlePromoBannerMobile, ArticlePromoCard } from '../renderer/ArticlePromoBanner'
import type { Banner, BannerLookupResult } from '../types'

const queryState = vi.hoisted(() => ({
	lookups: new Map<string, BannerLookupResult>()
}))

vi.mock('@tanstack/react-query', () => ({
	useQuery: vi.fn(({ queryKey, enabled = true }: { queryKey: Array<unknown>; enabled?: boolean }) => ({
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
	targetCountries: [],
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

	test('falls back from article text to section text to all-articles text', () => {
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

	test('changes the text banner dismissal key only when the banner is edited', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			text: banner({ id: 'landing-text', scope: 'landing', text: 'Landing strip' })
		})

		const originalHtml = renderToStaticMarkup(<ArticleBannerStrip scope="landing" />)
		expect(originalHtml).toContain('announcement-token--research-banner-landing-text--2026-05-14t00-00-00-000z')

		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			text: banner({
				id: 'landing-text',
				scope: 'landing',
				text: 'Updated landing strip',
				updatedAt: '2026-08-14T12:34:56.000Z'
			})
		})

		const updatedHtml = renderToStaticMarkup(<ArticleBannerStrip scope="landing" />)
		expect(updatedHtml).toContain('announcement-token--research-banner-landing-text--2026-08-14t12-34-56-000z')
		expect(updatedHtml).not.toContain('announcement-token--research-banner-landing-text--2026-05-14')
	})

	test('falls back to all-articles image banners when article and section images are absent', () => {
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

	test('hides the all-articles text banner on an excluded article but shows it elsewhere', () => {
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

	test('hides the all-articles image banner on an excluded article but shows it elsewhere', () => {
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

	test('renders the landing promo banner with a disclosure link', () => {
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

	test('uses a custom disclosure label when configured', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			promo: promoBanner({ disclosureUrl: 'https://example.com/disclosure', disclosureText: 'Ad disclosure' })
		})

		expect(renderToStaticMarkup(<ResearchPromoBanner />)).toContain('Ad disclosure')
	})

	test('hides the disclosure link when no disclosure URL is configured', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			promo: promoBanner()
		})

		const html = renderToStaticMarkup(<ResearchPromoBanner />)

		expect(html).toContain('/uploads/promo/wide')
		expect(html).not.toContain('Disclosure')
	})

	test('hides the landing promo banner when no promo is configured or no wide image exists', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), emptyLookup())
		expect(renderToStaticMarkup(<ResearchPromoBanner />)).toBe('')

		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			promo: promoBanner({ imageWideUrl: null })
		})
		expect(renderToStaticMarkup(<ResearchPromoBanner />)).toBe('')
	})

	test('does not server-render a restricted promo before visitor country resolves', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'landing']), {
			...emptyLookup(),
			promo: promoBanner({ targetCountries: ['FI'] })
		})

		expect(renderToStaticMarkup(<ResearchPromoBanner />)).toBe('')
	})

	test('renders the article promo card from the all-articles lookup', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			promo: promoBanner({ disclosureUrl: 'https://example.com/disclosure' })
		})

		const html = renderToStaticMarkup(<ArticlePromoCard articleId="article-id" />)

		expect(html).toContain('/uploads/promo/card')
		expect(html).toContain('https://example.com/promo')
		expect(html).toContain('Disclosure')
	})

	test('hides the article promo card without a card image', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			promo: promoBanner({ imageCardUrl: null })
		})

		expect(renderToStaticMarkup(<ArticlePromoCard articleId="article-id" />)).toBe('')
	})

	test('hides the promo card on an excluded article but shows it elsewhere', () => {
		queryState.lookups.set(JSON.stringify(['research', 'banner', 'all-articles']), {
			...emptyLookup(),
			promo: promoBanner({ excludedArticleIds: ['article-id'] })
		})

		expect(renderToStaticMarkup(<ArticlePromoCard articleId="article-id" />)).toBe('')
		expect(renderToStaticMarkup(<ArticlePromoCard articleId="other-article" />)).toContain('/uploads/promo/card')
		expect(renderToStaticMarkup(<ArticlePromoBannerMobile articleId="article-id" />)).toBe('')
	})

	test('falls back from the mobile promo image to the card image', () => {
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
