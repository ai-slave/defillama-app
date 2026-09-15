import { describe, expect, test } from 'vitest'
import { ExchangeDirectory, sponsorBannerHref } from '../ExchangeDirectory'
import type { ExchangeDirectoryRowModel } from '../models'

const row = (slug: string, referralUrl: string | null, websiteUrl: string | null) =>
	({ slug, referralUrl, websiteUrl }) as ExchangeDirectoryRowModel

describe('sponsor banner destination', () => {
	test('tags banner clicks for Umami', () => {
		const element = ExchangeDirectory({
			directory: { rows: [row('bybit', 'https://ref.bybit', null)] },
			countryState: { country: null }
		} as Parameters<typeof ExchangeDirectory>[0])
		const banner = element.props.children[1]

		expect(banner.props['data-umami-event']).toBe('bybit-banner-click')
	})

	test('uses the venue row referral so the banner and the table agree', () => {
		expect(
			sponsorBannerHref([row('binance', 'https://ref.binance', null), row('bybit', 'https://ref.bybit', null)])
		).toBe('https://ref.bybit')
	})

	test('falls back to the plain website, then to the hardcoded url', () => {
		expect(sponsorBannerHref([row('bybit', null, 'https://www.bybit.com/en')])).toBe('https://www.bybit.com/en')
		expect(sponsorBannerHref([row('bybit', null, null)])).toBe('https://www.bybit.com')
		expect(sponsorBannerHref([])).toBe('https://www.bybit.com')
	})
})
