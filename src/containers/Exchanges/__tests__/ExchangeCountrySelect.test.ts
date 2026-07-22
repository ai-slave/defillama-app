import { describe, expect, it } from 'vitest'
import type { SelectOption } from '~/components/Select/types'
import { orderCountryOptions, resolveExchangeCountry } from '../ExchangeCountrySelect'
import type { MasterExchangeRegionCatalogResponse } from '../master.types'

const option = (key: string, name: string): SelectOption => ({ key, name })

describe('country dropdown ordering', () => {
	it('pins popular countries first in fixed order, then the rest alphabetically, keeping every option', () => {
		const options = [
			option('ZW', 'Zimbabwe'),
			option('DE', 'Germany'),
			option('AL', 'Albania'),
			option('US', 'United States'),
			option('CN', 'China'),
			option('FI', 'Finland'),
			option('GB', 'United Kingdom')
		]

		const ordered = orderCountryOptions(options)

		expect(ordered.map((entry) => entry.key)).toEqual([
			// Popular block in POPULAR_COUNTRIES order (only catalog members appear).
			'US',
			'GB',
			'DE',
			'CN',
			// Remaining countries alphabetically by display label.
			'AL',
			'FI',
			'ZW'
		])
		expect(ordered).toHaveLength(options.length)
	})
})

describe('country URL canonicalization', () => {
	const catalog = {
		version: '1',
		countries: ['DE'],
		country_regions: { DE: 'eea' },
		regions: { eea: { label: 'EU / EEA', continent: 'Europe', countries: ['DE'] } },
		last_updated: '2026-07-18T00:00:00Z'
	} satisfies MasterExchangeRegionCatalogResponse

	it('uppercases a syntactically valid published country', () => {
		expect(resolveExchangeCountry({ country: 'de' }, catalog)).toBe('DE')
	})

	it('turns malformed, unknown, and not-yet-validated values into no selection', () => {
		expect(resolveExchangeCountry({ country: 'germany' }, catalog)).toBeNull()
		expect(resolveExchangeCountry({ country: 'zz' }, catalog)).toBeNull()
		expect(resolveExchangeCountry({ country: 'de' }, null)).toBeNull()
	})
})
