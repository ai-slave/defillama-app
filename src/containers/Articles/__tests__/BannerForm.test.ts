import { describe, expect, test } from 'vitest'
import { bannerToForm, buildPayload, validateBannerForm } from '~/containers/Articles/admin/bannerFormState'
import type { BannerKind } from '~/containers/Articles/types'
import { EU_COUNTRY_CODES } from '~/utils/countries'

describe('BannerForm regional targeting', () => {
	test('defaults new banners to global display', () => {
		const state = bannerToForm(null)
		expect(state.audienceMode).toBe('global')
		expect(buildPayload({ ...state, text: 'Global banner' }).targetCountries).toEqual([])
	})

	test('requires at least one location in selected mode', () => {
		const state = bannerToForm(null)
		expect(validateBannerForm({ ...state, text: 'Targeted banner', audienceMode: 'selected' }).audience).toBe(
			'Select at least one region or country'
		)
	})

	test('includes targeting in every banner-kind payload', () => {
		const base = {
			...bannerToForm(null),
			audienceMode: 'selected' as const,
			targetGroups: ['eu'] as const,
			targetCountries: ['US'],
			text: 'Targeted banner',
			imageUrl: '/uploads/banner',
			imageWideUrl: '/uploads/banner-wide',
			linkUrl: 'https://example.com'
		}
		const kinds: Array<BannerKind> = ['text', 'image', 'image-horizontal', 'promo', 'image-square']

		for (const kind of kinds) {
			const payload = buildPayload({ ...base, kind, targetGroups: [...base.targetGroups] })
			expect(new Set(payload.targetCountries)).toEqual(new Set([...EU_COUNTRY_CODES, 'US']))
		}
	})
})

describe('BannerForm promo placement urls', () => {
	const promoState = () => ({
		...bannerToForm(null),
		kind: 'promo' as const,
		imageWideUrl: '/uploads/banner-wide',
		linkUrl: 'https://example.com'
	})

	test('defaults both placement urls to empty strings', () => {
		const state = bannerToForm(null)
		expect(state.landingLinkUrl).toBe('')
		expect(state.articleLinkUrl).toBe('')
	})

	test('maps null placement urls from an existing banner to empty strings', () => {
		const state = bannerToForm({
			id: 'promo-id',
			type: 'promo',
			scope: 'landing',
			section: null,
			articleId: null,
			text: null,
			linkUrl: 'https://example.com',
			linkLabel: null,
			imageUrl: null,
			imageAlt: null,
			imageWideUrl: '/uploads/banner-wide',
			imageCardUrl: null,
			imageMobileUrl: null,
			disclosureText: null,
			disclosureUrl: null,
			landingLinkUrl: null,
			articleLinkUrl: 'https://example.com/article',
			showOnLanding: true,
			excludedArticleIds: [],
			targetCountries: [],
			enabled: true,
			createdAt: '2026-05-14T00:00:00.000Z',
			updatedAt: '2026-05-14T00:00:00.000Z'
		})
		expect(state.landingLinkUrl).toBe('')
		expect(state.articleLinkUrl).toBe('https://example.com/article')
	})

	test('sends trimmed placement urls for promo banners and null when blank', () => {
		const payload = buildPayload({
			...promoState(),
			landingLinkUrl: '  https://example.com/landing  ',
			articleLinkUrl: '   '
		})
		expect(payload.landingLinkUrl).toBe('https://example.com/landing')
		expect(payload.articleLinkUrl).toBeNull()
	})

	test('nulls placement urls for every non-promo kind', () => {
		const base = {
			...bannerToForm(null),
			text: 'Banner',
			imageUrl: '/uploads/banner',
			linkUrl: 'https://example.com',
			landingLinkUrl: 'https://example.com/landing',
			articleLinkUrl: 'https://example.com/article'
		}
		const kinds: Array<BannerKind> = ['text', 'image', 'image-horizontal', 'image-square']
		for (const kind of kinds) {
			const payload = buildPayload({ ...base, kind })
			expect(payload.landingLinkUrl).toBeNull()
			expect(payload.articleLinkUrl).toBeNull()
		}
	})

	test('validates placement url prefixes only when filled in', () => {
		expect(validateBannerForm({ ...promoState(), landingLinkUrl: 'ftp://example.com' }).landingLinkUrl).toBe(
			'Must start with http://, https://, or /'
		)
		expect(validateBannerForm({ ...promoState(), articleLinkUrl: 'example.com/article' }).articleLinkUrl).toBe(
			'Must start with http://, https://, or /'
		)
		const errors = validateBannerForm({ ...promoState(), landingLinkUrl: '', articleLinkUrl: '/research' })
		expect(errors.landingLinkUrl).toBeUndefined()
		expect(errors.articleLinkUrl).toBeUndefined()
	})
})
