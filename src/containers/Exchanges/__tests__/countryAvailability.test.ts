import { describe, expect, test } from 'vitest'
import { resolveCountryAvailability } from '../countryAvailability'
import type { MasterExchangeRegionCatalogResponse, MasterExchangeRegionManifestResponse } from '../master.types'

const catalog = {
	version: '1',
	countries: ['CA', 'DE', 'NZ', 'US'],
	country_regions: { CA: 'ca', DE: 'eea', NZ: 'oceania', US: 'us' },
	regions: {
		ca: { label: 'Canada', continent: 'North America', countries: ['CA'] },
		eea: { label: 'EU / EEA', continent: 'Europe', countries: ['DE'] },
		oceania: { label: 'Oceania', continent: 'Oceania', countries: ['NZ'] },
		us: { label: 'United States', continent: 'North America', countries: ['US'] }
	},
	last_updated: '2026-07-18T00:00:00Z'
} satisfies MasterExchangeRegionCatalogResponse

const manifest = {
	variants: {
		ca: {
			status: 'unavailable',
			segments: [],
			note: 'Not offered in Canada.',
			source: null,
			country_overrides: { CA: { status: 'restricted' } }
		},
		eea: {
			status: 'available',
			segments: ['spot', 'linear_perp'],
			note: 'EEA terms apply.',
			source: { url: 'https://example.com/eea' },
			country_overrides: {
				DE: {
					status: 'restricted',
					note: 'Derivatives are restricted.',
					source: { url: 'https://example.com/de', asOf: '2026-07-01' }
				}
			}
		},
		us: {
			status: 'available',
			segments: ['spot'],
			note: null,
			source: null,
			country_overrides: { US: { status: 'unavailable', note: 'Not offered.' } }
		},
		global: {
			status: 'leaving',
			segments: ['spot'],
			note: 'Global wind-down.',
			source: { url: 'https://example.com/global' },
			country_overrides: {}
		}
	},
	last_updated: '2026-07-18T00:00:00Z'
} satisfies MasterExchangeRegionManifestResponse

describe('country availability resolver', () => {
	test('uses the exact variant and its effective country override', () => {
		expect(resolveCountryAvailability(catalog, manifest, 'DE')).toEqual({
			country: 'DE',
			region: { key: 'eea', label: 'EU / EEA' },
			availability: 'restricted',
			segments: ['spot', 'linear_perp'],
			note: 'Derivatives are restricted.',
			source: { url: 'https://example.com/de', asOf: '2026-07-01' },
			usedFallback: false,
			// Fixture variants carry no funding block; a cache without one degrades to
			// null so callers fall back to the venue-level figures.
			funding: null
		})
	})

	test('falls back to global for a data-driven region key', () => {
		expect(resolveCountryAvailability(catalog, manifest, 'NZ')).toMatchObject({
			region: { key: 'oceania', label: 'Oceania' },
			availability: 'leaving',
			segments: ['spot'],
			note: 'Global wind-down.',
			source: { url: 'https://example.com/global' },
			usedFallback: true
		})
	})

	test('guarantees unavailable countries expose no segments', () => {
		expect(resolveCountryAvailability(catalog, manifest, 'US')).toMatchObject({
			availability: 'unavailable',
			segments: [],
			note: 'Not offered.'
		})
	})

	test('surfaces the region variant funding, and drops it when unavailable', () => {
		const withFunding = {
			variants: {
				...manifest.variants,
				eea: {
					...manifest.variants.eea,
					funding: {
						has_fiat_onramp: true,
						fiat_currency_count: 1,
						ramp_cost_1k: {
							on_ramp_usd: 12.5,
							off_ramp_usd: 9.25,
							currency: 'eur',
							on_rail: 'SEPA Instant',
							off_rail: 'SEPA'
						}
					}
				}
			}
		} as unknown as MasterExchangeRegionManifestResponse
		expect(resolveCountryAvailability(catalog, withFunding, 'DE').funding).toMatchObject({
			has_fiat_onramp: true,
			ramp_cost_1k: { on_ramp_usd: 12.5, off_ramp_usd: 9.25, on_rail: 'SEPA Instant' }
		})
		// An unavailable country has no rails to report, whatever the variant says.
		expect(resolveCountryAvailability(catalog, withFunding, 'US').funding).toBeNull()
	})

	test('does not let a restricted override reopen an unavailable variant', () => {
		expect(resolveCountryAvailability(catalog, manifest, 'CA')).toMatchObject({
			availability: 'unavailable',
			segments: [],
			note: 'Not offered in Canada.'
		})
	})
})
