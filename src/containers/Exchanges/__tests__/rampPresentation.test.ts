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
		expect(row.costIsFallback).toBe(false)
		expect(row.roundTripUsd).toBeCloseTo(3.1 + 2.3, 6)
		expect(row.roundTripFraction).toBeCloseTo(0.0054, 6)
		// execution only: taker + buy-side slippage, no rail and no transfer
		expect(row.tradeCostUsd).toBeCloseTo(1.1, 6)
	})

	test('falls back to the cheapest priced currency and flags it', () => {
		const [row] = buildRampRows(catalog(), { ...base, currency: 'CHF' })
		expect(row.costIsFallback).toBe(true)
		expect(row.cost?.currency).toBe('EUR') // €0 deposit beats the £0.50 one
	})

	test('falls back off a half-priced currency to one that prices the whole trip', () => {
		// GBP has a deposit rail but no withdrawal rail, so its round trip is unknown
		// while EUR's is complete — the EUR answer wins, labelled as a fallback.
		const [row] = buildRampRows(catalog(), { ...base, currency: 'GBP' })
		expect(row.cost?.currency).toBe('EUR')
		expect(row.costIsFallback).toBe(true)
		expect(row.roundTripUsd).toBeCloseTo(5.4, 6)
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
		expect(row.costIsFallback).toBe(false)
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

describe('currency selection', () => {
	test('offers only currencies with a priced rail', () => {
		const rows = buildRampRows(catalog(), { country: null, regionCatalog: REGION_CATALOG, currency: null, size: 1000 })
		expect(rampCurrencyOptions(rows, 1000)).toEqual(['EUR', 'GBP'])
	})

	test('omits currencies priced only at another order size', () => {
		const rows = buildRampRows(catalog(), { country: null, regionCatalog: REGION_CATALOG, currency: null, size: 1000 })
		expect(rampCurrencyOptions(rows, 10_000)).toEqual([])
	})

	test('prices the USD default against the cheapest complete rail when a venue has no USD one', () => {
		const [row] = buildRampRows(catalog(), {
			country: null,
			regionCatalog: REGION_CATALOG,
			currency: DEFAULT_RAMP_CURRENCY,
			size: 1000
		})
		expect(row.costIsFallback).toBe(true)
		expect(row.cost?.currency).toBe('EUR')
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
