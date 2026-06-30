import { describe, expect, it } from 'vitest'
import type { ExchangeMetadataListEntry } from '../api.types'
import { filterMicaRows, rankMicaRows } from '../MicaFinder'

function row(over: Partial<ExchangeMetadataListEntry>): ExchangeMetadataListEntry {
	return {
		available_regions: [],
		clean_reserves_usd: null,
		defillama_slug: null,
		display_name: 'X',
		eu_status: null,
		exchange: 'x',
		fee_token: null,
		inflows_24h_usd: null,
		kyc_required: null,
		last_verified: null,
		mica_licensed: false,
		mica_member_state: null,
		mica_status: null,
		native_token: null,
		oi_usd: null,
		own_token_pct: null,
		perp_fee: { maker: null, taker: null },
		products: [],
		ref_link: null,
		reserves_source_url: null,
		reserves_usd: null,
		restricted_regions: [],
		secondary: false,
		spot_fee: { maker: null, taker: null },
		volume_24h_usd: null,
		website: null,
		...over
	}
}

const ROWS: ExchangeMetadataListEntry[] = [
	row({ exchange: 'kraken', mica_licensed: true, products: ['spot', 'margin', 'perp', 'futures'] }),
	row({ exchange: 'bitstamp', mica_licensed: true, products: ['spot', 'perp'] }),
	row({ exchange: 'binance', mica_licensed: false, products: ['spot', 'perp', 'options'] })
]

describe('filterMicaRows', () => {
	it('keeps only MiCA-licensed venues when micaOnly is set', () => {
		const out = filterMicaRows(ROWS, { micaOnly: true, products: [] })
		expect(out.map((r) => r.exchange)).toEqual(['kraken', 'bitstamp'])
	})

	it('includes non-MiCA venues when micaOnly is off', () => {
		const out = filterMicaRows(ROWS, { micaOnly: false, products: [] })
		expect(out).toHaveLength(3)
	})

	it('AND-matches every selected product against the segment list', () => {
		// futures ⇒ only kraken among the MiCA-licensed rows offers it
		const out = filterMicaRows(ROWS, { micaOnly: true, products: ['spot', 'futures'] })
		expect(out.map((r) => r.exchange)).toEqual(['kraken'])
	})

	it('matches a single selected product across all MiCA venues', () => {
		const out = filterMicaRows(ROWS, { micaOnly: true, products: ['perp'] })
		expect(out.map((r) => r.exchange)).toEqual(['kraken', 'bitstamp'])
	})
})

describe('rankMicaRows', () => {
	it('ranks majors above secondary venues, then by volume desc (unknown last), then name', () => {
		const rows = [
			row({ display_name: 'BigBroker', secondary: true, volume_24h_usd: 1_000 }),
			row({ display_name: 'SmallMajor', secondary: false, volume_24h_usd: 10 }),
			row({ display_name: 'NullMajor', secondary: false, volume_24h_usd: null }),
			row({ display_name: 'BigMajor', secondary: false, volume_24h_usd: 500 })
		]
		expect(rankMicaRows(rows).map((r) => r.display_name)).toEqual(['BigMajor', 'SmallMajor', 'NullMajor', 'BigBroker'])
	})
})
