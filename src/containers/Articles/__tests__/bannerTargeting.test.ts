import { describe, expect, test } from 'vitest'
import { collapseBannerCountrySelection, expandBannerCountrySelection } from '~/containers/Articles/bannerCountryGroups'
import { candidatesNeedVisitorCountry, selectBannerForCountry } from '~/containers/Articles/bannerTargeting'
import type { Banner, BannerKind } from '~/containers/Articles/types'
import { EU_COUNTRY_CODES } from '~/utils/countries'

function banner(overrides: Partial<Banner> = {}): Banner {
	return {
		id: 'banner-id',
		type: 'text',
		scope: 'landing',
		section: null,
		articleId: null,
		text: 'Banner',
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
		createdAt: '2026-08-18T00:00:00.000Z',
		updatedAt: '2026-08-18T00:00:00.000Z',
		...overrides
	}
}

describe('banner regional targeting', () => {
	test('expands and restores the EU CMS shortcut without losing extra countries', () => {
		const expanded = expandBannerCountrySelection(['eu'], ['US', 'FI'])
		expect(new Set(expanded)).toEqual(new Set([...EU_COUNTRY_CODES, 'US']))
		expect(collapseBannerCountrySelection(expanded)).toEqual({ groups: ['eu'], countries: ['US'] })
	})

	test('keeps banners global when no target countries are configured', () => {
		const global = banner()
		expect(candidatesNeedVisitorCountry([global])).toBe(false)
		expect(selectBannerForCountry([global], null, false)).toBe(global)
	})

	test('waits for visitor country before showing a restricted banner or its fallback', () => {
		const restricted = banner({ id: 'restricted', targetCountries: ['FI'] })
		const fallback = banner({ id: 'fallback' })
		expect(candidatesNeedVisitorCountry([restricted, fallback])).toBe(true)
		expect(selectBannerForCountry([restricted, fallback], null, false)).toBeNull()
	})

	test('matches any selected country and otherwise uses the next eligible banner', () => {
		const restricted = banner({ id: 'restricted', targetCountries: ['FI', 'DE'] })
		const fallback = banner({ id: 'fallback' })
		expect(selectBannerForCountry([restricted, fallback], 'fi', true)).toBe(restricted)
		expect(selectBannerForCountry([restricted, fallback], 'US', true)).toBe(fallback)
	})

	test('fails closed for unknown visitors while preserving a global fallback', () => {
		const restricted = banner({ id: 'restricted', targetCountries: ['FI'] })
		const fallback = banner({ id: 'fallback' })
		expect(selectBannerForCountry([restricted], null, true)).toBeNull()
		expect(selectBannerForCountry([restricted], 'XX', true)).toBeNull()
		expect(selectBannerForCountry([restricted], 'T1', true)).toBeNull()
		expect(selectBannerForCountry([restricted, fallback], null, true)).toBe(fallback)
	})

	test('applies the same targeting semantics to every banner kind', () => {
		const kinds: Array<BannerKind> = ['text', 'image', 'image-horizontal', 'promo', 'image-square']
		for (const type of kinds) {
			const targeted = banner({ type, targetCountries: ['FI'] })
			expect(selectBannerForCountry([targeted], 'US', true)).toBeNull()
			expect(selectBannerForCountry([targeted], 'FI', true)).toBe(targeted)
		}
	})
})
