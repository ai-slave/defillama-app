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

		expect(html).toContain('href="https://example.com/campaign"')
		expect(html).toContain('>View offer<')
		expect(html).toContain('href="https://example.com/terms"')
		expect(html).toContain('>Terms<')
		expect(html).toContain('href="https://example.com/source"')
		expect(html).toContain('>Source<')
	})

	test('renders one campaign action when all disclosures use the same URL', () => {
		const url = 'https://example.com/offer'
		const html = renderToStaticMarkup(
			<ProfilePromotions promotions={[promotion({ url, termsUrl: url, sourceUrl: url })]} asOfDate="2026-07-15" />
		)

		expect(html.split(`href="${url}"`)).toHaveLength(2)
		expect(html).not.toContain('>Terms<')
		expect(html).not.toContain('>Source<')
	})
})
