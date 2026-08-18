import { describe, expect, it } from 'vitest'
import { bannerToForm, buildPayload, validateBannerForm } from '~/containers/Articles/admin/bannerFormState'
import type { BannerKind } from '~/containers/Articles/types'
import { EU_COUNTRY_CODES } from '~/utils/countries'

describe('BannerForm regional targeting', () => {
	it('defaults new banners to global display', () => {
		const state = bannerToForm(null)
		expect(state.audienceMode).toBe('global')
		expect(buildPayload({ ...state, text: 'Global banner' }).targetCountries).toEqual([])
	})

	it('requires at least one location in selected mode', () => {
		const state = bannerToForm(null)
		expect(validateBannerForm({ ...state, text: 'Targeted banner', audienceMode: 'selected' }).audience).toBe(
			'Select at least one region or country'
		)
	})

	it('includes targeting in every banner-kind payload', () => {
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
		const kinds: BannerKind[] = ['text', 'image', 'image-horizontal', 'promo', 'image-square']

		for (const kind of kinds) {
			const payload = buildPayload({ ...base, kind, targetGroups: [...base.targetGroups] })
			expect(new Set(payload.targetCountries)).toEqual(new Set([...EU_COUNTRY_CODES, 'US']))
		}
	})
})
