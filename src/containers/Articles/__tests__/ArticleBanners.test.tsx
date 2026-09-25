import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { selectBannerForCountry } from '../bannerTargeting'
import { landingPromoImageUrl, ResearchPromoBanner } from '../landing/ResearchPromoBanner'
import { ArticleBannerStrip } from '../renderer/ArticleBannerStrip'
import { cardPromoImageUrl, mobilePromoImageUrl } from '../renderer/ArticlePromoBanner'
import { articleBannerCandidates } from '../renderer/bannerExclusion'
import type { Banner, BannerLookupResult } from '../types'

const lookup = (overrides: Partial<BannerLookupResult> = {}): BannerLookupResult => ({
	text: null,
	image: null,
	imageHorizontal: null,
	promo: null,
	imageSquare: null,
	...overrides
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
	imageLandingMobileUrl: null,
	disclosureText: null,
	disclosureUrl: null,
	landingLinkUrl: null,
	articleLinkUrl: null,
	showOnLanding: true,
	excludedArticleIds: [],
	targetCountries: [],
	enabled: true,
	createdByPbUserId: 'user-id',
	createdAt: '2026-05-14T00:00:00.000Z',
	updatedAt: '2026-05-14T00:00:00.000Z',
	...overrides
})

const promo = (overrides: Partial<Banner> = {}): Banner =>
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

// The banner an article placement shows to a visitor whose country is known and untargeted.
function articleBanner(
	kind: 'text' | 'image',
	lookups: Parameters<typeof articleBannerCandidates>[1],
	articleId: string
) {
	return selectBannerForCountry(articleBannerCandidates(kind, lookups, articleId), null, true)?.id ?? null
}

describe('article banner placement', () => {
	const global = { text: banner({ id: 'global' }), image: banner({ id: 'global', type: 'image' }) }
	const section = { text: banner({ id: 'section' }), image: banner({ id: 'section', type: 'image' }) }
	const article = { text: banner({ id: 'article' }), image: banner({ id: 'article', type: 'image' }) }

	test.each(['text', 'image'] as const)('%s banners prefer article, then section, then all articles', (kind) => {
		const allArticles = lookup({ [kind]: global[kind] })
		expect(articleBanner(kind, { article: lookup(), section: lookup(), allArticles }, 'a1')).toBe('global')
		expect(
			articleBanner(kind, { article: lookup(), section: lookup({ [kind]: section[kind] }), allArticles }, 'a1')
		).toBe('section')
		expect(
			articleBanner(
				kind,
				{ article: lookup({ [kind]: article[kind] }), section: lookup({ [kind]: section[kind] }), allArticles },
				'a1'
			)
		).toBe('article')
	})

	test.each(['text', 'image'] as const)('an all-articles %s banner skips excluded articles only', (kind) => {
		const allArticles = lookup({ [kind]: { ...global[kind], excludedArticleIds: ['a1'] } })
		expect(articleBanner(kind, { allArticles }, 'a1')).toBeNull()
		expect(articleBanner(kind, { allArticles }, 'a2')).toBe('global')
	})
})

describe('promo images', () => {
	test('the landing promo uses the wide image on desktop and the landing mobile image on mobile', () => {
		const withLandingMobile = promo({ imageLandingMobileUrl: '/uploads/promo/landing-mobile' })
		expect(landingPromoImageUrl(withLandingMobile, false)).toBe('/uploads/promo/wide')
		expect(landingPromoImageUrl(withLandingMobile, true)).toBe('/uploads/promo/landing-mobile')
		expect(landingPromoImageUrl(promo(), true)).toBe('/uploads/promo/mobile')
	})

	test('the landing promo hides without an image for the viewport, or when kept off the landing page', () => {
		expect(landingPromoImageUrl(promo({ imageWideUrl: null }), false)).toBeUndefined()
		expect(landingPromoImageUrl(promo({ imageMobileUrl: null }), true)).toBeUndefined()
		expect(landingPromoImageUrl(promo({ showOnLanding: false }), false)).toBeUndefined()
		expect(landingPromoImageUrl(promo({ enabled: false }), false)).toBeUndefined()
	})

	test('article promos ignore the landing mobile image and fall back from mobile to card', () => {
		expect(mobilePromoImageUrl(promo({ imageLandingMobileUrl: '/uploads/promo/landing-mobile' }))).toBe(
			'/uploads/promo/mobile'
		)
		expect(mobilePromoImageUrl(promo({ imageMobileUrl: null }))).toBe('/uploads/promo/card')
		expect(mobilePromoImageUrl(promo({ imageMobileUrl: null, imageCardUrl: null }))).toBeUndefined()
		expect(cardPromoImageUrl(promo({ imageCardUrl: null }))).toBeUndefined()
	})
})

// Server render with lookups already cached, as the page's prefetched data would be.
function render(lookups: Record<string, BannerLookupResult>, node: ReactNode) {
	const client = new QueryClient()
	for (const key in lookups) client.setQueryData(['research', 'banner', ...key.split('/')], lookups[key])
	return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

describe('server-rendered banners', () => {
	test('editing a text banner changes its dismissal key so dismissed visitors see the new version', () => {
		const strip = (updatedAt: string) =>
			render(
				{ landing: lookup({ text: banner({ id: 'landing-text', text: 'Landing strip', updatedAt }) }) },
				<ArticleBannerStrip scope="landing" />
			)
		expect(strip('2026-05-14T00:00:00.000Z')).toContain('research-banner-landing-text--2026-05-14t00-00-00-000z')
		expect(strip('2026-08-14T12:34:56.000Z')).toContain('research-banner-landing-text--2026-08-14t12-34-56-000z')
	})

	test('the landing promo links to its landing url and shows its disclosure link', () => {
		const html = render(
			{
				landing: lookup({
					promo: promo({
						landingLinkUrl: 'https://example.com/landing',
						disclosureUrl: 'https://example.com/disclosure',
						disclosureText: 'Ad disclosure'
					})
				})
			},
			<ResearchPromoBanner />
		)
		expect(html).toContain('src="/uploads/promo/wide"')
		expect(html).toContain('href="https://example.com/landing"')
		expect(html).toContain('href="https://example.com/disclosure"')
		expect(html).toContain('Ad disclosure')
	})

	test('a country-restricted promo is not server-rendered before the visitor country resolves', () => {
		const html = (targetCountries: Array<string>) =>
			render({ landing: lookup({ promo: promo({ targetCountries }) }) }, <ResearchPromoBanner />)
		expect(html([])).toContain('href="https://example.com/promo"')
		expect(html(['FI'])).toBe('')
	})
})
