import { describe, expect, test } from 'vitest'
import { articlePromoLinkUrl, landingPromoLinkUrl } from '~/containers/Articles/promoLinks'
import type { Banner } from '~/containers/Articles/types'

const promo = (overrides: Partial<Banner>): Banner => ({
	id: 'promo-id',
	type: 'promo',
	scope: 'landing',
	section: null,
	articleId: null,
	text: null,
	linkUrl: 'https://example.com/promo',
	linkLabel: null,
	imageUrl: null,
	imageAlt: null,
	imageWideUrl: '/uploads/promo/wide',
	imageCardUrl: '/uploads/promo/card',
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
	createdAt: '2026-05-14T00:00:00.000Z',
	updatedAt: '2026-05-14T00:00:00.000Z',
	...overrides
})

describe('promo link resolution', () => {
	test('falls back to linkUrl when the per-placement urls are missing', () => {
		expect(landingPromoLinkUrl(promo({}))).toBe('https://example.com/promo')
		expect(articlePromoLinkUrl(promo({}))).toBe('https://example.com/promo')
	})

	test('prefers the placement-specific url and trims it', () => {
		const banner = promo({
			landingLinkUrl: '  https://example.com/landing ',
			articleLinkUrl: 'https://example.com/article'
		})
		expect(landingPromoLinkUrl(banner)).toBe('https://example.com/landing')
		expect(articlePromoLinkUrl(banner)).toBe('https://example.com/article')
	})

	test('does not leak one placement url onto the other', () => {
		expect(articlePromoLinkUrl(promo({ landingLinkUrl: 'https://example.com/landing' }))).toBe(
			'https://example.com/promo'
		)
		expect(landingPromoLinkUrl(promo({ articleLinkUrl: 'https://example.com/article' }))).toBe(
			'https://example.com/promo'
		)
	})

	test('treats whitespace-only urls as missing, down to an empty string', () => {
		expect(landingPromoLinkUrl(promo({ landingLinkUrl: '   ' }))).toBe('https://example.com/promo')
		expect(articlePromoLinkUrl(promo({ articleLinkUrl: '' }))).toBe('https://example.com/promo')
		expect(landingPromoLinkUrl(promo({ linkUrl: null }))).toBe('')
		expect(articlePromoLinkUrl(promo({ linkUrl: '  ' }))).toBe('')
	})
})
