import { describe, expect, test } from 'vitest'
import { mapMasterRamps } from '../master.mappers'
import type { MasterExchangeRegionCatalogResponse, MasterRampsResponse } from '../master.types'
import type { RampCatalogModel, RampVariantModel } from '../models'
import { buildRampRows, DEFAULT_RAMP_CURRENCY, rampCurrencyOptions, resolveRampVariant } from '../rampPresentation'

const REGION_CATALOG = {
	version: '2026-07-18',
	countries: ['DE', 'GB', 'US'],
	country_regions: { DE: 'eea', GB: 'gb', US: 'us' },
	regions: {
		eea: { label: 'EU / EEA', continent: 'Europe', countries: ['DE'] },
		gb: { label: 'United Kingdom', continent: 'Europe', countries: ['GB'] },
		us: { label: 'United States', continent: 'North America', countries: ['US'] }
	},
	last_updated: '2026-08-31T00:00:00.000Z'
} as unknown as MasterExchangeRegionCatalogResponse

function leg(fiat: number | null, transfer: number | null) {
	const parts = [fiat, 1, 0.1, transfer]
	const total = parts.every((part) => part != null) ? parts.reduce((sum, part) => sum! + part!, 0)! : null
	return {
		fiat_fee_usd: fiat,
		trade_fee_usd: 1,
		slippage_usd: 0.1,
		transfer_fee_usd: transfer,
		total_usd: total,
		total_pct: total == null ? null : total / 1000
	}
}

function variant(patch: Record<string, unknown> = {}) {
	return {
		status: 'available',
		segments: ['spot'],
		note: null,
		source: null,
		country_overrides: {},
		fiat_currencies: ['EUR', 'GBP'],
		rails: { on_ramp: [], off_ramp: [] },
		crypto_rails: {
			deposit: [],
			withdraw: [
				{
					asset: 'BTC',
					network: 'Bitcoin',
					direction: 'withdraw',
					fee: '0.000015 BTC',
					min: '',
					note: 'Derived from the venue’s authored BTC withdrawal fee.',
					src: { label: 'src', url: 'https://example.com/fees' },
					time: ''
				}
			]
		},
		kyc: { required: true, short: 'ID', summary: 'Government ID' },
		regulator: 'BaFin',
		mica_licensed: true,
		ramp: {
			sizes: [1000],
			currencies: ['EUR', 'GBP'],
			trade: {
				'1000': {
					pair: 'btc/usdt',
					trade_fee_usd: 1,
					slippage_buy_usd: 0.1,
					slippage_sell_usd: 0.1,
					btc_withdrawal_usd: 2,
					btc_network_usd: 0.2
				}
			},
			cost: {
				EUR: {
					'1000': { pair: 'btc/eur', on_ramp: leg(0, 2), off_ramp: leg(1, 0.2), on_rail: 'SEPA', off_rail: 'SEPA' }
				},
				GBP: {
					'1000': {
						pair: 'btc/gbp',
						on_ramp: leg(0.5, 2),
						off_ramp: leg(null, 0.2),
						on_rail: 'Faster Payments',
						off_rail: null
					}
				}
			},
			assumptions: {
				taker_fee: 0.001,
				btc_withdrawal_fee_btc: 0.00002,
				btc_network_fee_btc: 0.000002,
				btc_price_usd: 100_000,
				half_spread_pct: 0.0001
			}
		},
		...patch
	}
}

function response(patch: Partial<MasterRampsResponse> = {}): MasterRampsResponse {
	return {
		sizes: [1000],
		btc_network_fee_btc: 0.000002,
		last_updated: '2026-08-31T00:00:00.000Z',
		exchanges: [
			{
				slug: 'venue',
				display_name: 'Venue',
				type: 'cex',
				directory_visibility: 'listed',
				profile_mode: 'markets',
				scope: { kind: 'global' },
				parent_entity: null,
				related_entities: [],
				liquidity: { spot: { mode: 'own' }, linear_perp: null, inverse_perp: null },
				links: {
					profile: '/exchange/venue',
					website: { url: 'https://venue.example', kind: 'official' },
					defillama: null
				},
				variants: {
					global: variant(),
					us: variant({ status: 'unavailable', segments: [], fiat_currencies: null, rails: null })
				}
			}
		],
		...patch
	} as unknown as MasterRampsResponse
}

function catalog(patch: Partial<MasterRampsResponse> = {}): RampCatalogModel {
	return mapMasterRamps(response(patch))
}

describe('mapMasterRamps', () => {
	test('maps legs, rails and assumptions into the model shape', () => {
		const model = catalog()
		const eur = model.venues[0].variants.global?.cost.EUR?.['1000']
		expect(eur?.currency).toBe('EUR')
		expect(eur?.onRamp).toMatchObject({ fiatFeeUsd: 0, tradeFeeUsd: 1, transferFeeUsd: 2, totalUsd: 3.1 })
		expect(model.venues[0].variants.global?.trade['1000']?.pair).toBe('btc/usdt')
		expect(model.venues[0].variants.global?.assumptions.takerFee).toBe(0.001)
		expect(model.venues[0].variants.global?.cryptoRails?.withdraw[0]).toMatchObject({
			asset: 'BTC',
			network: 'Bitcoin',
			fee: '0.000015 BTC'
		})
	})
})

describe('resolveRampVariant', () => {
	const venue = () => catalog().venues[0]

	test('prefers the exact region record and reports the fallback otherwise', () => {
		const german = resolveRampVariant(venue(), 'DE', REGION_CATALOG)
		expect(german?.usedFallback).toBe(true) // no eea record authored → global applies
		const american = resolveRampVariant(venue(), 'US', REGION_CATALOG)
		expect(american?.usedFallback).toBe(false)
		expect(american?.status).toBe('unavailable')
	})

	test('lets a country carve-out override the region status', () => {
		const restricted = mapMasterRamps(
			response({
				exchanges: [
					{
						...response().exchanges[0],
						variants: { global: variant({ country_overrides: { GB: { status: 'restricted', note: 'FCA gated' } } }) }
					}
				]
			} as Partial<MasterRampsResponse>)
		).venues[0]
		expect(resolveRampVariant(restricted, 'GB', REGION_CATALOG)).toMatchObject({
			status: 'restricted',
			note: 'FCA gated'
		})
		expect(resolveRampVariant(restricted, 'DE', REGION_CATALOG)?.status).toBe('available')
	})
})

describe('buildRampRows', () => {
	const base = { country: null, regionCatalog: REGION_CATALOG, size: 1000 }

	test('prices the selected currency and totals the round trip', () => {
		const [row] = buildRampRows(catalog(), { ...base, currency: 'EUR' })
		expect(row.cost?.currency).toBe('EUR')
		expect(row.roundTripUsd).toBeCloseTo(3.1 + 2.3, 6)
		expect(row.roundTripFraction).toBeCloseTo(0.0054, 6)
		// execution only: taker + buy-side slippage, no rail and no transfer
		expect(row.tradeCostUsd).toBeCloseTo(1.1, 6)
	})

	test('shows no cost for a currency the venue has no rail in', () => {
		// Not the cheapest other currency: a EUR number under a CHF selection made two
		// venues incomparable at a glance.
		const [row] = buildRampRows(catalog(), { ...base, currency: 'CHF' })
		expect(row.cost).toBeNull()
		expect(row.roundTripUsd).toBeNull()
	})

	test('keeps a half-priced currency rather than crossing to a complete one', () => {
		// GBP has a deposit rail but no withdrawal rail. The GBP legs are what the reader
		// asked for, so the on-ramp still prices and only the round trip stays blank.
		const [row] = buildRampRows(catalog(), { ...base, currency: 'GBP' })
		expect(row.cost?.currency).toBe('GBP')
		expect(row.cost?.onRamp.totalUsd).toBeCloseTo(3.6, 6)
		expect(row.roundTripUsd).toBeNull()
	})

	test('keeps the requested currency when nothing prices the whole trip', () => {
		const gbpOnly = mapMasterRamps(
			response({
				exchanges: [
					{
						...response().exchanges[0],
						variants: {
							global: variant({
								ramp: {
									...variant().ramp,
									currencies: ['GBP'],
									cost: {
										GBP: {
											'1000': {
												pair: 'btc/gbp',
												on_ramp: leg(0.5, 2),
												off_ramp: leg(null, 0.2),
												on_rail: 'Faster Payments',
												off_rail: null
											}
										}
									}
								}
							})
						}
					}
				]
			} as Partial<MasterRampsResponse>)
		)
		const [row] = buildRampRows(gbpOnly, { ...base, currency: 'GBP' })
		expect(row.cost?.currency).toBe('GBP')
		expect(row.roundTripUsd).toBeNull()
		expect(row.cost?.onRamp.totalUsd).toBeCloseTo(3.6, 6)
	})

	test('keeps a country-blocked venue visible but last', () => {
		const rows = buildRampRows(
			mapMasterRamps(
				response({
					exchanges: [response().exchanges[0], { ...response().exchanges[0], slug: 'other', display_name: 'Other' }]
				} as Partial<MasterRampsResponse>)
			),
			{ ...base, country: 'US', currency: 'USD' }
		)
		expect(rows).toHaveLength(2)
		expect(rows.every((row) => row.status === 'unavailable')).toBe(true)
	})
})

describe('brand grouping', () => {
	const base = { country: null, regionCatalog: REGION_CATALOG, currency: 'EUR', size: 1000 }

	// A regional entity publishes a `global` record that says "not available outside my
	// region" AND carries the same cost block. Resolving to it made every regional venue
	// read as unavailable until a country was picked, and the brand collapse then deleted
	// the ones whose parent was also listed.
	const regional = (slug: string, parent: string | null, region: string) => ({
		...response().exchanges[0],
		slug,
		display_name: slug,
		scope: { kind: 'regional', regions: [region] },
		parent_entity: parent
			? { slug: parent, name: parent, scope: { kind: 'global' }, profile_url: `/exchange/${parent}` }
			: null,
		links: { ...response().exchanges[0].links, profile: `/exchange/${slug}` },
		variants: {
			global: variant({ status: 'unavailable' }),
			[region]: variant({ status: 'available' })
		}
	})

	const brand = (slug: string) => ({
		...response().exchanges[0],
		slug,
		display_name: slug,
		links: { ...response().exchanges[0].links, profile: `/exchange/${slug}` }
	})

	test('resolves a regional venue to its own region, not its unavailable global twin', () => {
		const venue = catalog({ exchanges: [regional('bitvavo', null, 'eea')] } as Partial<MasterRampsResponse>).venues[0]
		expect(resolveRampVariant(venue, null, REGION_CATALOG)?.status).toBe('available')
		const [row] = buildRampRows(
			catalog({ exchanges: [regional('bitvavo', null, 'eea')] } as Partial<MasterRampsResponse>),
			base
		)
		expect(row.status).toBe('available')
	})

	test('lists a regional entity and its parent as separate rows', () => {
		const rows = buildRampRows(
			catalog({
				exchanges: [brand('binance'), regional('binance-us', 'binance', 'us')]
			} as Partial<MasterRampsResponse>),
			base
		)
		expect(rows.map((row) => row.exchange).sort()).toEqual(['binance', 'binance-us'])
	})

	test('lists an orphaned child whose parent is not on the table', () => {
		const rows = buildRampRows(
			catalog({ exchanges: [regional('binance-us', 'binance', 'us')] } as Partial<MasterRampsResponse>),
			base
		)
		expect(rows.map((row) => row.exchange)).toEqual(['binance-us'])
	})
})

describe('REAL ordering', () => {
	const base = { country: null, regionCatalog: REGION_CATALOG, currency: 'EUR', size: 1000 }

	// One venue priced cheaper than a better-scored one: the cheap quote must not lead,
	// since a venue can price a trip it cannot be trusted to deliver.
	const scored = (slug: string, score: number | null, fiatFee: number) => ({
		...response().exchanges[0],
		slug,
		display_name: slug,
		links: { ...response().exchanges[0].links, profile: `/exchange/${slug}` },
		rank: score == null ? null : { score, rank: 1, tier: 'A', segments: {}, components: {} },
		variants: {
			global: variant({
				ramp: {
					...variant().ramp,
					cost: { EUR: { '1000': { currency: 'EUR', on_ramp: leg(fiatFee, 2), off_ramp: leg(fiatFee, 2) } } }
				}
			})
		}
	})

	test('leads with the best REAL score and falls back to cost for the rest', () => {
		const rows = buildRampRows(
			catalog({
				exchanges: [scored('cheap', 40, 0), scored('best', 90, 9), scored('mid', 70, 3)]
			} as Partial<MasterRampsResponse>),
			base
		)
		expect(rows.map((row) => row.exchange)).toEqual(['best', 'mid', 'cheap'])
	})

	test('sinks unscored venues under every scored one, however cheap', () => {
		const rows = buildRampRows(
			catalog({ exchanges: [scored('unscored', null, 0), scored('scored', 10, 9)] } as Partial<MasterRampsResponse>),
			base
		)
		expect(rows.map((row) => row.exchange)).toEqual(['scored', 'unscored'])
	})

	test('keeps cheapest-first when nothing is scored', () => {
		const rows = buildRampRows(
			catalog({ exchanges: [scored('pricey', null, 9), scored('cheap', null, 0)] } as Partial<MasterRampsResponse>),
			base
		)
		expect(rows.map((row) => row.exchange)).toEqual(['cheap', 'pricey'])
	})
})

describe('currency selection', () => {
	test('offers only currencies with a priced rail', () => {
		const rows = buildRampRows(catalog(), { country: null, regionCatalog: REGION_CATALOG, currency: null, size: 1000 })
		expect(rampCurrencyOptions(rows, 1000)).toEqual(['EUR', 'GBP'])
	})

	test('omits currencies priced only at another order size', () => {
		const rows = buildRampRows(catalog(), { country: null, regionCatalog: REGION_CATALOG, currency: null, size: 1000 })
		expect(rampCurrencyOptions(rows, 10_000)).toEqual([])
	})

	test('leaves the cost blank under the USD default when a venue has no USD rail', () => {
		const [row] = buildRampRows(catalog(), {
			country: null,
			regionCatalog: REGION_CATALOG,
			currency: DEFAULT_RAMP_CURRENCY,
			size: 1000
		})
		expect(row.cost).toBeNull()
		// The venue still shows: its rails and accepted currencies answer 'could I use it?'
		expect(row.variant.fiatCurrencies).toEqual(['EUR', 'GBP'])
	})
})

describe('variant model', () => {
	test('normalizes a null fiat currency list to an empty one', () => {
		const us = catalog().venues[0].variants.us as RampVariantModel
		expect(us.fiatCurrencies).toEqual([])
		expect(us.rails).toBeNull()
	})

	test('leaves crypto rails null when the venue publishes no route', () => {
		const noRoutes = mapMasterRamps(
			response({
				exchanges: [
					{
						...response().exchanges[0],
						variants: { global: variant({ crypto_rails: null }) }
					}
				]
			} as Partial<MasterRampsResponse>)
		).venues[0]
		expect(noRoutes.variants.global?.cryptoRails).toBeNull()
	})
})

describe('no country selected', () => {
	// Coinbase's shape: the global record carries no fiat facts, the regional ones do.
	const regionalOnly = () =>
		mapMasterRamps(
			response({
				exchanges: [
					{
						...response().exchanges[0],
						variants: {
							global: variant({ status: 'unavailable', rails: null, fiat_currencies: null }),
							eea: variant()
						}
					}
				]
			} as Partial<MasterRampsResponse>)
		).venues[0]

	test('shows the record that has rails, not the empty global one', () => {
		const resolved = resolveRampVariant(regionalOnly(), null, REGION_CATALOG)
		expect(resolved?.variant.region).toBe('eea')
		expect(resolved?.status).toBe('available')
		expect(resolved?.usedFallback).toBe(false)
	})

	test('still resolves the global record once a country is chosen', () => {
		const resolved = resolveRampVariant(regionalOnly(), 'US', REGION_CATALOG)
		expect(resolved?.variant.region).toBe('global')
		expect(resolved?.status).toBe('unavailable')
		expect(resolved?.usedFallback).toBe(true)
	})
})

describe('brand entities', () => {
	// Bitstamp's shape: a global entity plus an EEA child that carries its own MiCA record.
	const brandPair = (patch: Record<string, unknown> = {}) =>
		mapMasterRamps(
			response({
				exchanges: [
					response().exchanges[0],
					{
						...response().exchanges[0],
						slug: 'venue-eu',
						display_name: 'Venue EU',
						scope: { kind: 'regional', regions: ['eea'] },
						parent_entity: { slug: 'venue', name: 'Venue', scope: { kind: 'global' }, profile_url: '/exchange/venue' },
						variants: {
							global: variant({ status: 'unavailable', rails: null }),
							eea: variant()
						},
						...patch
					}
				]
			} as Partial<MasterRampsResponse>)
		)

	test('drops a regional entity outside the regions it serves', () => {
		const rows = buildRampRows(brandPair(), {
			country: 'US',
			regionCatalog: REGION_CATALOG,
			currency: 'EUR',
			size: 1000
		})
		expect(rows.map((row) => row.exchange)).toEqual(['venue'])
	})

	// Both price the trip in Germany, on their own rails: the reader came for both numbers,
	// so neither entity is folded into the other.
	test('keeps both entities where both are in scope', () => {
		const rows = buildRampRows(brandPair(), {
			country: 'DE',
			regionCatalog: REGION_CATALOG,
			currency: 'EUR',
			size: 1000
		})
		expect(rows.map((row) => row.exchange).sort()).toEqual(['venue', 'venue-eu'])
	})

	test('lists an orphaned child whose parent is not listed', () => {
		const orphan = mapMasterRamps(
			response({
				exchanges: [
					{
						...response().exchanges[0],
						slug: 'venue-eu',
						display_name: 'Venue EU',
						parent_entity: {
							slug: 'absent',
							name: 'Absent',
							scope: { kind: 'global' },
							profile_url: '/exchange/absent'
						}
					}
				]
			} as Partial<MasterRampsResponse>)
		)
		const rows = buildRampRows(orphan, { country: null, regionCatalog: REGION_CATALOG, currency: 'EUR', size: 1000 })
		expect(rows.map((row) => row.exchange)).toEqual(['venue-eu'])
	})
})

describe('variant choice with no country', () => {
	// Kraken's shape: rails in many regions, none global, and the alphabetically-first
	// region prices a currency nobody selected.
	const manyRegions = () =>
		mapMasterRamps(
			response({
				exchanges: [
					{
						...response().exchanges[0],
						variants: {
							ar: variant({
								fiat_currencies: ['ARS'],
								ramp: {
									...variant().ramp,
									currencies: ['ARS'],
									cost: {
										ARS: {
											'1000': {
												pair: 'btc/ars',
												on_ramp: leg(0, 2),
												off_ramp: leg(1, 0.2),
												on_rail: 'Bank Transfer',
												off_rail: 'Bank Transfer'
											}
										}
									}
								}
							}),
							eea: variant()
						}
					}
				]
			} as Partial<MasterRampsResponse>)
		).venues[0]

	test('picks the record that prices the selected currency, not the first region', () => {
		const resolved = resolveRampVariant(manyRegions(), null, REGION_CATALOG, { currency: 'EUR', size: 1000 })
		expect(resolved?.variant.region).toBe('eea')
	})

	test('still falls back to a record with rails when the currency prices nowhere', () => {
		const resolved = resolveRampVariant(manyRegions(), null, REGION_CATALOG, { currency: 'JPY', size: 1000 })
		expect(resolved?.variant.rails).not.toBeNull()
	})
})
