// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { ExchangePromotionModel } from '../models'
import { ProfilePromotions } from '../ProfilePromotions'

function promotion(patch: Partial<ExchangePromotionModel> = {}): ExchangePromotionModel {
	return {
		label: '20% off',
		title: 'Trading offer',
		subtitle: 'Offer details',
		url: 'https://example.com/campaign',
		termsUrl: 'https://example.com/terms',
		startsAt: null,
		endsAt: '2026-07-31',
		priority: 1,
		sourceUrl: 'https://example.com/source',
		...patch
	}
}

describe('profile promotion disclosures', () => {
	test('renders distinct campaign, terms, and source links', () => {
		const html = renderToStaticMarkup(<ProfilePromotions promotions={[promotion()]} asOfDate="2026-07-15" />)

		const document = new DOMParser().parseFromString(html, 'text/html')
		expect([...document.querySelectorAll('a')].map((link) => link.href).toSorted()).toEqual([
			'https://example.com/campaign',
			'https://example.com/source',
			'https://example.com/terms'
		])
	})

	test('renders one campaign action when all disclosures use the same URL', () => {
		const url = 'https://example.com/offer'
		const html = renderToStaticMarkup(
			<ProfilePromotions promotions={[promotion({ url, termsUrl: url, sourceUrl: url })]} asOfDate="2026-07-15" />
		)

		const document = new DOMParser().parseFromString(html, 'text/html')
		expect([...document.querySelectorAll('a')].map((link) => link.href).toSorted()).toEqual([url])
	})
})
