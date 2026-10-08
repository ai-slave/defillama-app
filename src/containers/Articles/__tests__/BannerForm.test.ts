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
			'Choose at least one region or country.'
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

describe('BannerForm promo landing mobile image', () => {
	const promoState = () => ({ ...bannerToForm(null), kind: 'promo' as const, linkUrl: 'https://example.com' })

	test('sends the landing mobile image for promo banners and nulls it for image-square', () => {
		const promo = buildPayload({ ...promoState(), imageLandingMobileUrl: ' /uploads/landing-mobile ' })
		expect(promo.imageLandingMobileUrl).toBe('/uploads/landing-mobile')
		expect(buildPayload({ ...promoState(), imageLandingMobileUrl: '' }).imageLandingMobileUrl).toBeNull()
		const square = buildPayload({
			...promoState(),
			kind: 'image-square',
			imageUrl: '/uploads/square',
			imageLandingMobileUrl: '/uploads/landing-mobile'
		})
		expect(square.imageLandingMobileUrl).toBeNull()
	})

	test('counts the landing mobile image as a promo image', () => {
		expect(validateBannerForm(promoState()).imageUrl).toBe('Upload at least one image.')
		expect(
			validateBannerForm({ ...promoState(), imageLandingMobileUrl: '/uploads/landing-mobile' }).imageUrl
		).toBeUndefined()
	})
})

describe('BannerForm promo placement urls', () => {
	const promoState = () => ({
		...bannerToForm(null),
		kind: 'promo' as const,
		imageWideUrl: '/uploads/banner-wide',
		linkUrl: 'https://example.com'
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

	test('validates placement url prefixes only when filled in', () => {
		expect(validateBannerForm({ ...promoState(), landingLinkUrl: 'ftp://example.com' }).landingLinkUrl).toBe(
			'Enter a valid URL starting with http://, https:// or /.'
		)
		expect(validateBannerForm({ ...promoState(), articleLinkUrl: 'example.com/article' }).articleLinkUrl).toBe(
			'Enter a valid URL starting with http://, https:// or /.'
		)
		const errors = validateBannerForm({ ...promoState(), landingLinkUrl: '', articleLinkUrl: '/research' })
		expect(errors.landingLinkUrl).toBeUndefined()
		expect(errors.articleLinkUrl).toBeUndefined()
	})
})
