import { describe, expect, it } from 'vitest'
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
	it('uses the exact variant and its effective country override', () => {
		expect(resolveCountryAvailability(catalog, manifest, 'DE')).toEqual({
			country: 'DE',
			region: { key: 'eea', label: 'EU / EEA' },
			availability: 'restricted',
			segments: ['spot', 'linear_perp'],
			note: 'Derivatives are restricted.',
			source: { url: 'https://example.com/de', asOf: '2026-07-01' },
			usedFallback: false
		})
	})

	it('falls back to global for a data-driven region key', () => {
		expect(resolveCountryAvailability(catalog, manifest, 'NZ')).toMatchObject({
			region: { key: 'oceania', label: 'Oceania' },
			availability: 'leaving',
			segments: ['spot'],
			note: 'Global wind-down.',
			source: { url: 'https://example.com/global' },
			usedFallback: true
		})
	})

	it('guarantees unavailable countries expose no segments', () => {
		expect(resolveCountryAvailability(catalog, manifest, 'US')).toMatchObject({
			availability: 'unavailable',
			segments: [],
			note: 'Not offered.'
		})
	})

	it('does not let a restricted override reopen an unavailable variant', () => {
		expect(resolveCountryAvailability(catalog, manifest, 'CA')).toMatchObject({
			availability: 'unavailable',
			segments: [],
			note: 'Not offered in Canada.'
		})
	})
})
