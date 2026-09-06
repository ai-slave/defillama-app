import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { DirectoryHeader } from '../DirectoryHeader'
import { micaDepthDetail, micaProductLabel } from '../MicaCells'
import { prepareMicaVenues } from '../MicaTable'
import type { MicaVenueModel } from '../models'
import { selectActivePromotion } from '../promotions'
import {
	RESEARCH_SERIES_PALETTE,
	researchChartAriaLabel,
	researchChartDisplayValue,
	researchSeriesColor
} from '../ResearchChart'
import { hasObservedHistory } from '../VenueChart'

function micaVenue(patch: Partial<MicaVenueModel> = {}): MicaVenueModel {
	return {
		exchange: 'spot',
		name: 'Spot Venue',
		profileHref: '/exchange/spot',
		website: 'https://example.com',
		referralUrl: null,
		promotions: [],
		micaStatus: 'active',
		micaLicensed: true,
		micaMemberState: null,
		micaRegulator: null,
		licenseCount: 1,
		products: ['spot'],
		marketCount: 1,
		spotFee: null,
		perpFee: null,
		depth: {
			spotPartialCoverage: false,
			perpPartialCoverage: false,
			spotBid05Usd: null,
			spotAsk05Usd: null,
			spotBid2Usd: null,
			spotAsk2Usd: null,
			perpBid05Usd: null,
			perpAsk05Usd: null,
			perpBid2Usd: null,
			perpAsk2Usd: null
		},
		kyc: { required: true, short: 'ID', summary: 'Government ID' },
		fiatOnramp: false,
		rampCost: null,
		...patch
	}
}

describe('surface model selection', () => {
	test.each([
		['spot', ['spot', 'fiat']],
		['perp', ['linear', 'both']],
		['fiat', ['fiat']]
	] as const)('filters MiCA rows by %s capability', (filter, expected) => {
		const rows = [
			micaVenue(),
			micaVenue({
				exchange: 'inverse',
				name: 'Inverse Venue',
				products: ['inverse_perp']
			}),
			micaVenue({
				exchange: 'futures',
				name: 'Futures Venue',
				products: ['futures']
			}),
			micaVenue({
				exchange: 'linear',
				name: 'Linear Venue',
				products: ['linear_perp']
			}),
			micaVenue({
				exchange: 'both',
				name: 'Both Venue',
				products: ['linear_perp', 'inverse_perp']
			}),
			micaVenue({ exchange: 'fiat', name: 'Fiat Venue', fiatOnramp: true })
		]

		expect(prepareMicaVenues(rows, filter).map((row) => row.exchange)).toEqual(expected)
	})

	test('labels inverse perpetual support without claiming linear perps', () => {
		expect(micaProductLabel(['inverse_perp'])).toBe('COIN perps')
		expect(micaProductLabel(['linear_perp', 'inverse_perp'])).toBe('Perps · COIN perps')
	})

	test('labels every canonical MiCA product in stable wire order', () => {
		expect(micaProductLabel(['spot', 'margin', 'linear_perp', 'inverse_perp', 'futures', 'options'])).toBe(
			'Spot · Margin · Perps · COIN perps · Futures · Options'
		)
	})

	test('selects active promotions by date and priority', () => {
		const venue = micaVenue({
			promotions: [
				{
					label: 'Later',
					title: 'Later campaign',
					subtitle: null,
					url: null,
					termsUrl: null,
					startsAt: '2026-07-15',
					endsAt: '2026-07-20',
					priority: 100,
					sourceUrl: 'https://example.com/later'
				},
				{
					label: 'Standard',
					title: 'Standard campaign',
					subtitle: null,
					url: null,
					termsUrl: null,
					startsAt: null,
					endsAt: null,
					priority: 1,
					sourceUrl: 'https://example.com/standard'
				},
				{
					label: 'Priority',
					title: 'Priority campaign',
					subtitle: null,
					url: null,
					termsUrl: null,
					startsAt: '2026-07-01',
					endsAt: '2026-07-31',
					priority: 2,
					sourceUrl: 'https://example.com/priority'
				}
			]
		})

		expect(selectActivePromotion(venue.promotions, '2026-07-13')?.label).toBe('Priority')
		expect(selectActivePromotion(venue.promotions, '2026-08-01')?.label).toBe('Standard')
	})

	test('summarizes chart endpoints for assistive technology without inventing missing values', () => {
		const label = researchChartAriaLabel({
			metric: 'volume',
			segment: 'spot',
			grouping: 'exchange',
			title: 'Volume',
			description: 'Daily venue volume.',
			days: [1_767_225_600, 1_767_312_000, 1_767_398_400],
			lines: [
				{ id: 'venue', label: 'Venue', values: [10, null, 30] },
				{ id: 'missing', label: 'Missing', values: [null, null, null] }
			],
			valueSymbol: '$',
			builtAt: '2026-01-03T00:00:00Z'
		})

		expect(label).toContain('Venue: from $10')
		expect(label).toContain('to $30')
		expect(label).toContain('Missing: no observations')
	})

	test('formats survival fractions as percentages without changing null or observed zero semantics', () => {
		expect(researchChartDisplayValue(0.625, '%')).toBe(62.5)
		expect(researchChartDisplayValue(0, '%')).toBe(0)
		expect(researchChartDisplayValue(25, '$')).toBe(25)
	})

	test('uses canonical directory totals instead of recreating them from venue groups', () => {
		const html = renderToStaticMarkup(
			DirectoryHeader({
				summary: {
					venueCount: 2,
					trackedVenueCount: 2,
					totalVolume24h: 300,
					spotVolume24h: 100,
					linearPerpVolume24h: 150,
					inversePerpVolume24h: 50,
					linearPerpOpenInterestUsd: null,
					inversePerpOpenInterestUsd: null,
					reservesUsd: null,
					volumeByKind: {
						cex: { spot: 100, linearPerp: 100, inversePerp: 50, total: 250 },
						dex: { spot: 150, linearPerp: 50, inversePerp: 50, total: 250 }
					}
				}
			})
		)

		expect(html).toContain('$300')
		expect(html).not.toContain('$1k')
	})

	test('keeps a zero-only venue history series visible', () => {
		expect(hasObservedHistory([0, 0])).toBe(true)
		expect(hasObservedHistory([null, null])).toBe(false)
		expect(hasObservedHistory(undefined)).toBe(false)
	})

	test('provides eight distinct exchange colors plus a distinct neutral Other color', () => {
		expect(RESEARCH_SERIES_PALETTE).toHaveLength(9)
		expect(new Set(RESEARCH_SERIES_PALETTE).size).toBe(9)
		expect(researchSeriesColor('other', 8)).toBe(RESEARCH_SERIES_PALETTE[8])
	})

	test('keeps observed one-sided zero depth visible in MiCA details', () => {
		expect(micaDepthDetail(0, 9, false)).toBe('$0 bid\n$9 ask')
		expect(micaDepthDetail(9, 0, true)).toBe('$9 bid\n$0 ask\nPartial coverage')
		expect(micaDepthDetail(null, 9, false)).toBeNull()
	})
})
