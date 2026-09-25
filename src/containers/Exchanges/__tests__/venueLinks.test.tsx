import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { ExchangeProfileModel } from '../models'
import { ProfileIdentity } from '../ProfileIdentity'
import { selectVenueDestination } from '../venueLinks'

function profile(
	referralUrl: string | null,
	website: string | null,
	twitterUrl: string | null = null,
	slug = 'venue'
): ExchangeProfileModel {
	return {
		slug,
		name: 'Venue',
		kind: 'cex',
		profileMode: 'markets',
		defillamaUrl: null,
		defillamaCexSlug: null,
		execution: null,
		quality: null,
		nativeToken: null,
		hacks: [],
		raises: [],
		reserves: null,
		segments: {},
		metadata: { referralUrl, website, twitterUrl, promotions: [], kpis: [], groups: [] }
	}
}

describe('exchange venue links', () => {
	test('selects one referral-first destination at the model boundary', () => {
		expect(selectVenueDestination('venue', 'https://ref.example', 'https://website.example')).toEqual({
			url: 'https://ref.example',
			kind: 'referral'
		})
		expect(selectVenueDestination('venue', null, 'https://website.example')).toEqual({
			url: 'https://website.example',
			kind: 'website'
		})
		expect(selectVenueDestination('venue', null, null)).toBeNull()
	})

	test('uses a frontend override only for its exact public entity slug', () => {
		const overrides = { 'bybit-eu': 'https://override.example/eu' }
		expect(
			selectVenueDestination('bybit-eu', 'https://backend.example/ref', 'https://www.bybit.eu', overrides)
		).toEqual({
			url: 'https://override.example/eu',
			kind: 'referral'
		})
		// Sibling slugs never inherit an override; the backend referral wins.
		expect(selectVenueDestination('bybit', 'https://backend.example/ref', 'https://www.bybit.com', overrides)).toEqual({
			url: 'https://backend.example/ref',
			kind: 'referral'
		})
	})

	test('renders only the selected referral URL when both destinations exist', () => {
		const html = renderToStaticMarkup(
			<ProfileIdentity profile={profile('https://ref.example', 'https://website.example')} />
		)

		expect(html).toContain('href="https://ref.example"')
		expect(html).toContain('data-umami-event-url="https://ref.example"')
		expect(html).not.toContain('https://website.example')
	})

	test('renders the website fallback and omits the action when neither destination exists', () => {
		const websiteHtml = renderToStaticMarkup(<ProfileIdentity profile={profile(null, 'https://website.example')} />)
		const missingHtml = renderToStaticMarkup(<ProfileIdentity profile={profile(null, null)} />)

		expect(websiteHtml).toContain('href="https://website.example"')
		expect(missingHtml).not.toContain('aria-label="Open Venue website"')
	})

	test('renders the primary Twitter action beside the website action', () => {
		const html = renderToStaticMarkup(
			<ProfileIdentity profile={profile(null, 'https://website.example', 'https://x.com/venue')} />
		)

		expect(html).toContain('href="https://website.example"')
		expect(html).toContain('href="https://x.com/venue"')
		expect(html).toContain('aria-label="Open Venue on X"')
		expect(html).toContain('data-umami-event="exchange-twitter-click"')
	})
})
