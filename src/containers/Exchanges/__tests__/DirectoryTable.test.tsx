import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { buildDirectoryColumns } from '../directoryColumns'
import type { ExchangeDirectoryRowModel, ExchangeSegmentActivity } from '../models'

function activity(patch: Partial<ExchangeSegmentActivity> = {}): ExchangeSegmentActivity {
	return {
		marketCount: 2,
		coinCount: 2,
		volume24h: 100,
		volumePrevious24h: null,
		openInterestUsd: null,
		openInterestPreviousUsd: null,
		depthBidUsd: null,
		depthAskUsd: null,
		depthPartial: false,
		volumeUpdatedAt: '2026-07-14T12:00:00Z',
		supportsOpenInterest: false,
		supportsDepth: false,
		...patch
	}
}

function row(patch: Partial<ExchangeDirectoryRowModel> = {}): ExchangeDirectoryRowModel {
	return {
		slug: 'venue',
		name: 'Venue',
		kind: 'cex',
		tracked: true,
		totalVolume24h: null,
		profileHref: '/exchange/venue',
		secondaryUrl: null,
		reservesHref: null,
		websiteUrl: null,
		referralUrl: null,
		related: { euEntity: null, globalEntity: null },
		parent: null,
		liquidity: { spot: { mode: 'own' }, linear_perp: null, inverse_perp: null },
		segments: {},
		sparks: {},
		reserves: null,
		fees: null,
		compliance: null,
		profile: null,
		funding: null,
		warnings: [],
		regional: null,
		selectedCountry: null,
		selectedCountryStatus: null,
		normalizedVolume: null,
		quality: null,
		...patch
	}
}

function volumeAccessor(scope: 'spot' | 'linear_perp' | 'inverse_perp') {
	const column = buildDirectoryColumns(scope).find((item) => item.id === 'volume24h')!
	return (venue: ExchangeDirectoryRowModel) => (column as any).accessorFn(venue, 0)
}

describe('exact segment scopes in directory columns', () => {
	it('keeps selected-country status out of the exchange name cell', () => {
		const venue = row({ selectedCountry: 'DE', selectedCountryStatus: 'restricted' })
		const nameColumn = buildDirectoryColumns('spot').find((item) => item.id === 'name')!
		const html = renderToStaticMarkup(
			(nameColumn as any).cell({
				row: {
					original: venue,
					depth: 0,
					subRows: [],
					getIsExpanded: () => false,
					getToggleExpandedHandler: () => undefined
				}
			})
		)

		expect(venue.selectedCountryStatus).toBe('restricted')
		expect(html).not.toContain('Restricted')
	})

	it('never renders a summed perp figure for a venue with both perpetual classes', () => {
		const venue = row({
			segments: {
				linear_perp: activity({ volume24h: 600 }),
				inverse_perp: activity({ volume24h: 25 })
			}
		})

		expect(volumeAccessor('linear_perp')(venue)).toBe(600)
		expect(volumeAccessor('inverse_perp')(venue)).toBe(25)
		expect(volumeAccessor('spot')(venue)).toBeUndefined()
		// 625 (600 + 25) must not be produced by any scope.
		for (const scope of ['spot', 'linear_perp', 'inverse_perp'] as const) {
			expect(volumeAccessor(scope)(venue)).not.toBe(625)
		}
	})
})
