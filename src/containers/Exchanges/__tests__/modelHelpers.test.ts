import { describe, expect, it } from 'vitest'
import type { MasterExchangeRegionCatalogResponse } from '../master.types'
import {
	activityForScope,
	combineNormalizedVolume,
	depthMetricState,
	describeChildLiquidity,
	filterDirectoryRows,
	nestDirectoryRows,
	normalizedVolumeForScope,
	sparklineForScope,
	sumNullable,
	sumSparks,
	volumeToDepth,
	volumeToOpenInterest
} from '../modelHelpers'
import type { ExchangeDirectoryRowModel, ExchangeSegmentActivity } from '../models'

const VOLUME_UPDATED_AT = '2026-07-14T12:00:00Z'

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
		volumeUpdatedAt: VOLUME_UPDATED_AT,
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
		reservesHref: '/exchange/venue?section=reserves',
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
		execution: null,
		quality: null,
		...patch
	}
}

describe('activityForScope', () => {
	it('keeps an absent segment absent instead of creating a zero row', () => {
		expect(activityForScope(row(), 'spot')).toBeNull()
	})

	it('preserves missing, observed zero, and capability-inapplicable states', () => {
		const missing = activityForScope(row({ segments: { spot: activity({ volume24h: null }) } }), 'spot')
		const zero = activityForScope(row({ segments: { spot: activity({ volume24h: 0 }) } }), 'spot')

		expect(missing).toMatchObject({ volume24h: null, supportsOpenInterest: false })
		expect(zero?.volume24h).toBe(0)
	})

	it('never sums the perpetual classes: each scope returns exactly its own segment', () => {
		const linear = activity({ volume24h: 600, openInterestUsd: 20, supportsOpenInterest: true, coinCount: 598 })
		const inverse = activity({ volume24h: 25, coinCount: 29 })
		const venue = row({ segments: { linear_perp: linear, inverse_perp: inverse } })

		expect(activityForScope(venue, 'linear_perp')).toBe(linear)
		expect(activityForScope(venue, 'inverse_perp')).toBe(inverse)
		expect(activityForScope(venue, 'linear_perp')?.volume24h).toBe(600)
		expect(activityForScope(venue, 'inverse_perp')?.volume24h).toBe(25)
		expect(activityForScope(venue, 'spot')).toBeNull()
	})
})

describe('nullable sums', () => {
	it.each([
		['missing', [null, null], null],
		['observed zero', [null, 0], 0],
		['present values', [10, null, 5], 15]
	] as const)('preserves %s totals', (_label, values, expected) => {
		expect(sumNullable([...values])).toBe(expected)
	})
})

describe('scope-specific sparks', () => {
	it('selects spot, linear, and inverse sparks without blending scopes', () => {
		const venue = row({
			sparks: { spot: [1, 2], linear_perp: [10, 20], inverse_perp: [100, 200] }
		})
		expect(sparklineForScope(venue, 'spot')).toEqual([1, 2])
		expect(sparklineForScope(venue, 'linear_perp')).toEqual([10, 20])
		expect(sparklineForScope(venue, 'inverse_perp')).toEqual([100, 200])
		expect(sparklineForScope(row({ sparks: {} }), 'linear_perp')).toEqual([])
	})
})

describe('spark and normalized-volume aggregation helpers', () => {
	it('right-aligns spark series so the most recent day lines up', () => {
		// Longer + shorter series: align by last element, sum overlapping tail.
		expect(sumSparks([1, 2, 3], [10, 20])).toEqual([1, 12, 23])
		expect(sumSparks([], [5, 6])).toEqual([5, 6])
		expect(sumSparks([5, 6], [])).toEqual([5, 6])
	})

	it('combines normalized volume additively with a recomputed discount and weighted unverified share', () => {
		const combined = combineNormalizedVolume(
			{ reported: 1_000, normalized: 800, discountFraction: 0.2, unverifiedFraction: 0, flag: null },
			{ reported: 200, normalized: 100, discountFraction: 0.5, unverifiedFraction: 0.5, flag: 'thin' }
		)
		expect(combined.reported).toBe(1_200)
		expect(combined.normalized).toBe(900)
		expect(combined.discountFraction).toBeCloseTo(1 - 900 / 1_200, 10)
		expect(combined.unverifiedFraction).toBeCloseTo((0.5 * 200) / 1_200, 10)
		expect(combined.flag).toBe('thin')
	})
})

describe('raw activity ratios', () => {
	it('computes volume/OI only when OI is supported and positive', () => {
		expect(volumeToOpenInterest(activity({ volume24h: 1_000, openInterestUsd: 10, supportsOpenInterest: true }))).toBe(
			100
		)
		expect(
			volumeToOpenInterest(activity({ volume24h: 1_000, openInterestUsd: 0, supportsOpenInterest: true }))
		).toBeNull()
		expect(volumeToOpenInterest(activity({ volume24h: 1_000, openInterestUsd: 10 }))).toBeNull()
	})

	it('computes volume/depth from combined bid+ask depth when supported', () => {
		expect(volumeToDepth(activity({ volume24h: 1_000, depthBidUsd: 10, depthAskUsd: 15, supportsDepth: true }))).toBe(
			40
		)
		expect(volumeToDepth(activity({ volume24h: 1_000, supportsDepth: true }))).toBeNull()
		expect(volumeToDepth(activity({ volume24h: 1_000, depthBidUsd: 10, depthAskUsd: 15 }))).toBeNull()
	})
})

describe('directory discovery and canonical links', () => {
	const trackedSpot = row({ segments: { spot: activity() } })
	const trackedPerp = row({ slug: 'perp', profileHref: '/exchange/perp', segments: { linear_perp: activity() } })
	const metadataOnly = row({
		slug: 'catalog',
		name: 'Catalog Venue',
		kind: 'dex',
		tracked: false,
		profileHref: '/exchange/catalog',
		secondaryUrl: '/protocol/catalog',
		reservesHref: null
	})

	it.each([
		['spot scope', { kind: 'all', scope: 'spot' }, ['venue', 'catalog']],
		['linear-perp scope', { kind: 'all', scope: 'linear_perp' }, ['perp', 'catalog']],
		['DEX venues', { kind: 'dex', scope: 'linear_perp' }, ['catalog']]
	] as const)('keeps the intended rows for %s', (_label, filters, expected) => {
		expect(filterDirectoryRows([trackedSpot, trackedPerp, metadataOnly], filters).map((item) => item.slug)).toEqual(
			expected
		)
	})

	it('preserves canonical API-authored routes for tracked and metadata-only profiles', () => {
		expect(trackedSpot.profileHref).toBe('/exchange/venue')
		expect(metadataOnly.profileHref).toBe('/exchange/catalog')
		expect(metadataOnly.secondaryUrl).toBe('/protocol/catalog')
	})
})

describe('country-aware directory filtering', () => {
	const catalog = {
		countries: ['DE', 'US'],
		country_regions: { DE: 'eea', US: 'global' },
		regions: {
			eea: { label: 'EU / EEA', continent: 'Europe', countries: ['DE'] },
			global: { label: 'Global / Other', continent: 'Global', countries: [] }
		}
	} as unknown as MasterExchangeRegionCatalogResponse
	const regional = (
		status: 'available' | 'restricted' | 'leaving' | 'unavailable',
		segments: Array<'spot' | 'linear_perp'>
	) => ({
		variants: {
			global: {
				status: 'available' as const,
				segments: ['spot' as const],
				note: null,
				source: null,
				country_overrides: {}
			},
			eea:
				status === 'unavailable'
					? { status, segments: [] as [], note: null, source: null, country_overrides: {} }
					: { status, segments, note: null, source: null, country_overrides: {} }
		}
	})

	it('hides unavailable and unsupported rows while retaining restricted rows', () => {
		const available = row({
			slug: 'available',
			segments: { spot: activity() },
			regional: regional('available', ['spot'])
		})
		const restricted = row({
			slug: 'restricted',
			segments: { spot: activity() },
			regional: regional('restricted', ['spot'])
		})
		const unavailable = row({
			slug: 'unavailable',
			segments: { spot: activity() },
			regional: regional('unavailable', ['spot'])
		})

		const spot = filterDirectoryRows([available, restricted, unavailable], {
			kind: 'all',
			scope: 'spot',
			country: 'DE',
			catalog
		})
		expect(spot.map((venue) => venue.slug)).toEqual(['available', 'restricted'])
		expect(spot[1].selectedCountryStatus).toBe('restricted')
		expect(
			filterDirectoryRows([available, restricted], {
				kind: 'all',
				scope: 'linear_perp',
				country: 'DE',
				catalog
			})
		).toEqual([])
	})

	it('falls back to the unfiltered global view while the catalog is loading or failed', () => {
		const tracked = row({ segments: { spot: activity() } })
		const metadataOnly = row({ slug: 'catalog-only', tracked: false })

		for (const catalogState of [null, undefined]) {
			const rows = filterDirectoryRows([tracked, metadataOnly], {
				kind: 'all',
				scope: 'spot',
				country: 'DE',
				catalog: catalogState
			})
			expect(rows.map((venue) => venue.slug)).toEqual(['venue', 'catalog-only'])
			// Global fallback rows carry no country annotation.
			expect(rows[0].selectedCountry).toBeNull()
		}
	})

	it('keeps the tracked-activity gate when a country is selected', () => {
		// Bitstamp pattern: the eea variant advertises linear_perp, but the venue
		// has tracked spot activity only — it must not appear as an empty perp row.
		const bitstampLike = row({
			slug: 'bitstamp',
			segments: { spot: activity() },
			regional: regional('available', ['spot', 'linear_perp'])
		})
		expect(filterDirectoryRows([bitstampLike], { kind: 'all', scope: 'linear_perp', country: 'DE', catalog })).toEqual(
			[]
		)
		expect(
			filterDirectoryRows([bitstampLike], { kind: 'all', scope: 'spot', country: 'DE', catalog }).map(
				(venue) => venue.slug
			)
		).toEqual(['bitstamp'])
	})
})

describe('parent/child directory nesting', () => {
	const parent = row({ segments: { spot: activity({ volume24h: 1_000 }) } })
	const child = row({
		slug: 'venue-eu',
		name: 'Venue EU',
		profileHref: '/exchange/venue-eu',
		parent: { slug: 'venue', name: 'Venue' },
		segments: { spot: activity({ volume24h: 40 }) }
	})
	const unrelated = row({ slug: 'solo', profileHref: '/exchange/solo' })

	it('nests a venue under its parent only when the parent is itself a listed row', () => {
		const nested = nestDirectoryRows([parent, child, unrelated])

		expect(nested.map((item) => item.slug)).toEqual(['venue', 'solo'])
		expect(nested[0].subRows?.map((item) => item.slug)).toEqual(['venue', 'venue-eu'])
		expect(nested[1].subRows).toBeUndefined()
	})

	it('keeps an orphaned child at the top level when its parent is filtered out', () => {
		const nested = nestDirectoryRows([child, unrelated])
		expect(nested.map((item) => item.slug)).toEqual(['venue-eu', 'solo'])
		expect(nested[0].subRows).toBeUndefined()
	})

	it('aggregates valid Binance brand activity and keeps parent-level facts', () => {
		const binance = row({
			slug: 'binance',
			name: 'Binance',
			profileHref: '/exchange/binance',
			segments: {
				spot: activity({
					marketCount: 10,
					coinCount: 8,
					volume24h: 1_000,
					volumePrevious24h: 900,
					depthBidUsd: 100,
					depthAskUsd: 120,
					supportsDepth: true,
					doubleCount: { volume: 'Parent-only note' }
				})
			},
			sparks: { spot: [800, 900, 1_000] },
			reserves: {
				totalUsd: 1,
				cleanUsd: 1,
				ownTokenFraction: null,
				inflows24hUsd: null,
				inflows7dUsd: null,
				inflows1mUsd: null,
				auditor: null,
				sourceUrl: null
			},
			fees: { spot: null, linearPerp: null, inversePerp: null, feeToken: null },
			compliance: {
				headquarters: 'Global',
				euStatus: null,
				eeaOrderbookOwnership: null,
				mica: null,
				licenseCount: null,
				kyc: null
			},
			profile: { founded: 2017, nativeToken: 'BNB' },
			funding: { fiatCurrencies: ['USD'], fiatFees: null, hasFiatOnramp: true, rampCost: null },
			warnings: [{ level: 'caution', text: 'Parent-only warning' }],
			normalizedVolume: {
				spot: { reported: 1_000, normalized: 800, discountFraction: 0.2, unverifiedFraction: 0, flag: null },
				linear_perp: null,
				inverse_perp: null
			}
		})
		const binanceUs = row({
			slug: 'binance-us',
			name: 'Binance.US',
			profileHref: '/exchange/binance-us',
			parent: { slug: 'binance', name: 'Binance' },
			segments: {
				spot: activity({
					marketCount: 2,
					coinCount: 2,
					volume24h: 40,
					volumePrevious24h: 30,
					depthBidUsd: 10,
					depthAskUsd: 20,
					depthPartial: true,
					supportsDepth: true
				})
			},
			sparks: { spot: [30, 40] },
			normalizedVolume: {
				spot: { reported: 40, normalized: 20, discountFraction: 0.5, unverifiedFraction: 0.5, flag: null },
				linear_perp: null,
				inverse_perp: null
			}
		})
		const nested = nestDirectoryRows([binance, binanceUs])
		const brand = nested[0]

		expect(brand.segments.spot).toMatchObject({
			marketCount: 12,
			coinCount: null,
			volume24h: 1_040,
			volumePrevious24h: 930,
			depthBidUsd: 110,
			depthAskUsd: 140,
			depthPartial: true,
			volumeUpdatedAt: null,
			supportsDepth: true
		})
		expect(brand.segments.spot?.doubleCount).toBeUndefined()
		// Trend and normalized volume aggregate the parent + own-book child
		// (spark right-aligned: [800,900,1000] + [30,40] = [800,930,1040]).
		expect(brand.sparks.spot).toEqual([800, 930, 1_040])
		expect(brand.normalizedVolume?.spot).toMatchObject({
			reported: 1_040,
			normalized: 820,
			unverifiedFraction: 20 / 1_040
		})
		// Brand-level facts stay the parent's, so the brand row still ranks in the
		// Transparency/Fees/Compliance views instead of reading as "no data".
		expect(brand.reserves?.totalUsd).toBe(1)
		expect(brand.fees).toBe(binance.fees)
		expect(brand.compliance?.headquarters).toBe('Global')
		expect(brand.profile?.nativeToken).toBe('BNB')
		expect(brand.funding?.hasFiatOnramp).toBe(true)
		expect(brand.warnings).toEqual([{ level: 'caution', text: 'Parent-only warning' }])
		// Brand-row identity stays the global venue's (slug, links, profile).
		expect(brand.slug).toBe('binance')
		expect(brand.profileHref).toBe('/exchange/binance')
		// The global venue reappears untouched as the first child row.
		expect(brand.subRows?.[0]).toBe(binance)
		expect(brand.subRows?.[1]).toBe(binanceUs)
	})

	it('never adds shared-subset segments into the brand row', () => {
		// OKX pattern: EU spot is a shared EUR-quoted subset (already inside the
		// parent's book); only the own linear_perp book joins the brand sum.
		const okx = row({
			slug: 'okx',
			liquidity: { spot: { mode: 'own' }, linear_perp: { mode: 'own' }, inverse_perp: null },
			segments: {
				spot: activity({ volume24h: 1_000 }),
				linear_perp: activity({
					volume24h: 500,
					openInterestUsd: 100,
					openInterestPreviousUsd: 90,
					supportsOpenInterest: true
				})
			}
		})
		const okxEu = row({
			slug: 'okx-eu',
			parent: { slug: 'okx', name: 'OKX' },
			liquidity: {
				spot: { mode: 'shared', coverage: 'subset', source: { slug: 'okx', name: 'OKX' } },
				linear_perp: { mode: 'own' },
				inverse_perp: null
			},
			segments: {
				spot: activity({ volume24h: 40 }),
				linear_perp: activity({
					volume24h: 60,
					openInterestUsd: 10,
					openInterestPreviousUsd: 8,
					supportsOpenInterest: true
				})
			}
		})
		const nested = nestDirectoryRows([okx, okxEu])

		expect(nested[0].segments.spot?.volume24h).toBe(1_000)
		expect(nested[0].segments.linear_perp?.volume24h).toBe(560)
		expect(nested[0].segments.linear_perp?.openInterestUsd).toBe(110)
		expect(nested[0].segments.linear_perp?.openInterestPreviousUsd).toBe(98)
		expect(nested[0].segments.linear_perp?.coinCount).toBeNull()
		expect(nested[0].subRows?.map((item) => item.slug)).toEqual(['okx', 'okx-eu'])
	})

	it('surfaces an own child segment the parent lacks on the brand row', () => {
		const inverseChild = row({
			slug: 'venue-eu',
			parent: { slug: 'venue', name: 'Venue' },
			liquidity: { spot: null, linear_perp: null, inverse_perp: { mode: 'own' } },
			segments: { inverse_perp: activity({ volume24h: 7 }) }
		})
		const nested = nestDirectoryRows([parent, inverseChild])
		expect(nested[0].segments.inverse_perp?.volume24h).toBe(7)
		expect(nested[0].segments.spot?.volume24h).toBe(1_000)
	})
})

describe('child liquidity descriptions', () => {
	it('describes an own-book regional venue per present segment', () => {
		const bybitEuLike = row({
			slug: 'bybit-eu',
			parent: { slug: 'bybit', name: 'Bybit' },
			liquidity: { spot: { mode: 'own' }, linear_perp: null, inverse_perp: null }
		})
		const description = describeChildLiquidity(bybitEuLike)
		expect(description).toContain('Spot')
		expect(description).toContain('operates its own order book')
		expect(description).toContain('separate from Bybit')
	})

	it('describes mixed subset-shared and own segments from liquidity modes and coverage', () => {
		const okxEuLike = row({
			slug: 'okx-eu',
			parent: { slug: 'okx', name: 'OKX' },
			liquidity: {
				spot: { mode: 'shared', coverage: 'subset', source: { slug: 'okx', name: 'OKX' } },
				linear_perp: { mode: 'own' },
				inverse_perp: null
			}
		})
		const description = describeChildLiquidity(okxEuLike)
		expect(description).toContain('Spot')
		expect(description).toContain('subset of pairs')
		expect(description).toContain('volume also counted under OKX')
		expect(description).toContain('Linear Perps')
		expect(description).toContain('separate from OKX')
	})

	it('describes a full shared segment alongside an independently owned segment', () => {
		const mirror = row({
			slug: 'venue-mirror-eu',
			parent: { slug: 'venue', name: 'Venue' },
			liquidity: {
				spot: { mode: 'shared', coverage: 'full', source: { slug: 'venue', name: 'Venue' } },
				linear_perp: { mode: 'own' },
				inverse_perp: null
			}
		})
		const description = describeChildLiquidity(mirror)
		expect(description).toContain("Spot: presents Venue's order book")
		expect(description).toContain('Linear Perps')
		expect(description).toContain('separate from Venue')
	})

	it('returns nothing without a parent', () => {
		expect(describeChildLiquidity(row())).toBeNull()
	})
})

describe('normalized volume and depth semantics', () => {
	it('exposes each perp class separately and never a combined perp figure', () => {
		const linear = { reported: 100, normalized: 70, discountFraction: 0.3, unverifiedFraction: 0.1, flag: null }
		const inverse = { reported: 50, normalized: 30, discountFraction: 0.4, unverifiedFraction: 0.4, flag: 'outlier' }
		const venue = row({
			segments: { linear_perp: activity(), inverse_perp: activity() },
			normalizedVolume: { spot: null, linear_perp: linear, inverse_perp: inverse }
		})

		expect(normalizedVolumeForScope(venue, 'linear_perp')).toBe(linear)
		expect(normalizedVolumeForScope(venue, 'inverse_perp')).toBe(inverse)
		expect(normalizedVolumeForScope(venue, 'spot')).toBeNull()
	})

	it('keeps an uncovered segment unavailable instead of borrowing the other class', () => {
		const linear = { reported: 100, normalized: 70, discountFraction: 0.3, unverifiedFraction: 0.1, flag: null }
		const venue = row({
			segments: { linear_perp: activity(), inverse_perp: activity() },
			normalizedVolume: { spot: null, linear_perp: linear, inverse_perp: null }
		})
		expect(normalizedVolumeForScope(venue, 'inverse_perp')).toBeNull()
		expect(normalizedVolumeForScope(venue, 'linear_perp')).toBe(linear)
	})

	it.each([
		['absent segment', null, { state: 'unsupported' }],
		['unsupported', activity({ supportsDepth: false, depthBidUsd: 10, depthAskUsd: 10 }), { state: 'unsupported' }],
		['missing', activity({ supportsDepth: true }), { state: 'missing' }],
		[
			'partial observed',
			activity({ supportsDepth: true, depthBidUsd: 10 }),
			{ state: 'observed', value: 10, partial: true }
		],
		[
			'observed zero',
			activity({ supportsDepth: true, depthBidUsd: 0, depthAskUsd: 0 }),
			{ state: 'observed', value: 0, partial: false }
		]
	] as const)('preserves the %s state', (_label, input, expected) => {
		expect(depthMetricState(input)).toEqual(expected)
	})
})
