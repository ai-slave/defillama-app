import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ExchangeProfile, resolveProfileSegment } from '../ExchangeProfile'
import type { ExchangeProfileModel, ExchangeSegment } from '../models'

function profile(slug: string, segments: ExchangeSegment[]): ExchangeProfileModel {
	return {
		slug,
		name: slug,
		kind: 'cex',
		profileMode: 'markets',
		defillamaUrl: null,
		defillamaCexSlug: null,
		reserves: null,
		segments: Object.fromEntries(
			segments.map((segment) => [
				segment,
				{
					segment,
					marketCount: 0,
					volume24h: null,
					volumePrevious24h: null,
					openInterestUsd: null,
					openInterestPreviousUsd: null,
					depth2Usd: null,
					capabilities: { openInterest: false, funding: false, depth: false },
					pairs: []
				}
			])
		),
		metadata: {
			website: null,
			referralUrl: null,
			promotions: [],
			kpis: [],
			groups: []
		}
	}
}

describe('profile navigation segment resolution', () => {
	it('replaces a stale segment selection when navigation reuses the dynamic route', () => {
		const previousSelection = resolveProfileSegment(profile('perps', ['linear_perp']), null)
		const nextSelection = resolveProfileSegment(profile('spot', ['spot']), previousSelection)

		expect(previousSelection).toBe('linear_perp')
		expect(nextSelection).toBe('spot')
	})
})

describe('metadata-only profile presentation', () => {
	it('renders entity metadata without mounting history or markets UI', () => {
		const metadataOnly = profile('coinbase-eu', [])
		metadataOnly.name = 'Coinbase EU'
		metadataOnly.profileMode = 'metadata-only'
		metadataOnly.metadata = {
			website: 'https://coinbase.example',
			referralUrl: null,
			promotions: [
				{
					label: 'Offer',
					title: 'Coinbase EU promotion',
					subtitle: null,
					url: 'https://coinbase.example/offer',
					termsUrl: null,
					startsAt: null,
					endsAt: null,
					priority: null,
					sourceUrl: 'https://coinbase.example/source'
				}
			],
			kpis: [],
			groups: [
				{
					key: 'regulation',
					title: 'Regulation',
					fields: [{ key: 'status', label: 'Status', type: 'text' as const, value: 'Available', comparable: true }]
				}
			]
		}

		const html = renderToStaticMarkup(
			createElement(ExchangeProfile, {
				profile: metadataOnly,
				asOfDate: '2026-07-15',
				loadSeries: () => {
					throw new Error('metadata-only profile requested history')
				}
			})
		)

		expect(html).toContain('Coinbase EU promotion')
		expect(html).toContain('Regulation')
		expect(html).not.toContain('History')
		expect(html).not.toContain('No market segments')
	})
})
