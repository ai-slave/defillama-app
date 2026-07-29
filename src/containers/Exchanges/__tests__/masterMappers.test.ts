import { isSerializableProps } from 'next/dist/lib/is-serializable-props'
import { describe, expect, it } from 'vitest'
import {
	decodeMasterChart,
	mapMasterDirectory,
	mapMasterDirectoryOverview,
	mapMasterMetadataOnlyProfile,
	mapMasterMica,
	mapMasterProfile,
	mapMasterResearchReport
} from '../master.mappers'
import type {
	MasterChartColumnarResponse,
	MasterDirectoryResponse,
	MasterDirectoryTotals,
	MasterDirectoryVenue,
	MasterEntityScope,
	MasterExchangeIndexResponse,
	MasterExchangeMetadataResponse,
	MasterExchangePair,
	MasterFreshness,
	MasterLiquidityBySegment,
	MasterMicaVenue,
	MasterRampCost,
	MasterVenueCore
} from '../master.types'

const FRESHNESS: MasterFreshness = {
	volume: '2026-07-14T12:00:00Z',
	oi: '2026-07-14T12:00:00Z',
	funding: '2026-07-14T12:00:00Z',
	depth: '2026-07-14T12:00:00Z'
}

const OWN = { mode: 'own' } as const

function sharedWith(slug: string, coverage: 'full' | 'subset') {
	return {
		mode: 'shared' as const,
		coverage,
		source: { slug, name: slug, profile_url: `/exchange/${slug}` }
	}
}

function liquidity(patch: Partial<MasterLiquidityBySegment> = {}): MasterLiquidityBySegment {
	return { spot: OWN, linear_perp: OWN, inverse_perp: null, ...patch }
}

function venueCore(slug: string, patch: Partial<MasterVenueCore> = {}): MasterVenueCore {
	return {
		slug,
		display_name: 'Venue',
		type: 'cex',
		directory_visibility: 'listed',
		profile_mode: 'markets',
		scope: { kind: 'global' },
		parent_entity: null,
		related_entities: [],
		liquidity: liquidity(),
		links: {
			profile: `/exchange/${slug}`,
			website: { url: 'https://example.com', kind: 'official' },
			defillama: { slug: 'venue-cex', type: 'cex', url: '/cex/venue-cex' }
		},
		...patch
	}
}

const RAMP_COST: MasterRampCost = {
	notional_usd: 1_000,
	pair: 'btc/eur',
	on_ramp: {
		fiat_fee_usd: 1,
		trade_fee_usd: 2,
		slippage_usd: 3,
		transfer_fee_usd: 4,
		total_usd: 10,
		total_pct: 0.01
	},
	off_ramp: {
		fiat_fee_usd: 2,
		trade_fee_usd: 3,
		slippage_usd: 4,
		transfer_fee_usd: 5,
		total_usd: 14,
		total_pct: 0.014
	},
	assumptions: {
		method: 'sepa',
		taker_fee: 0.002,
		half_spread_pct: 0.001,
		btc_withdrawal_fee_btc: 0.0001,
		btc_network_fee_btc: 0.0002,
		btc_price_usd: 60_000
	}
}

function directoryVenue(patch: Partial<MasterDirectoryVenue> = {}): MasterDirectoryVenue {
	return {
		...venueCore('venue'),
		directory_visibility: 'listed',
		tracked: true,
		secondary: false,
		segments: {
			spot: {
				markets: 2,
				coins: 2,
				volume_24h: 100,
				volume_prev_24h: 80,
				depth_2pct_bid_usd: null,
				depth_2pct_ask_usd: null,
				depth_partial: false,
				freshness: FRESHNESS
			},
			linear_perp: {
				markets: 1,
				coins: 1,
				volume_24h: 600,
				volume_prev_24h: 500,
				oi_usd: 300,
				oi_prev_usd: 280,
				depth_2pct_bid_usd: null,
				depth_2pct_ask_usd: null,
				depth_partial: false,
				freshness: FRESHNESS
			}
		},
		capabilities: {
			spot: { oi: false, funding: false, depth: false },
			linear_perp: { oi: true, funding: true, depth: true }
		},
		totals: {
			spot_volume_24h: 100,
			linear_perp_volume_24h: 600,
			inverse_perp_volume_24h: null,
			total_trading_volume_24h: 700,
			coins: 2
		},
		sparks: { spot: [70, 100] },
		freshness: FRESHNESS,
		reserves: {
			total_usd: 500,
			clean_usd: 450,
			own_token_pct: 0.1,
			inflows_24h_usd: 10,
			inflows_7d_usd: 20,
			inflows_1m_usd: 30,
			auditor: 'Auditor',
			source_url: 'https://example.com/reserves'
		},
		fees: {
			spot: { maker: 0.001, taker: 0.002 },
			linear_perp: null,
			inverse_perp: null,
			fee_token: { symbol: 'v', discount_pct: 25 }
		},
		compliance: {
			hq: 'France',
			eu_status: 'available',
			mica: { status: 'active', licensed: true, member_state: 'FR', regulator: 'AMF' },
			license_count: 1,
			kyc: { required: true, short: 'ID', summary: 'Government ID' }
		},
		profile: {
			founded: 2020,
			native_token: 'v',
			promotions: [],
			last_verified: '2026-07'
		},
		funding: {
			fiat_currencies: ['EUR'],
			has_fiat_onramp: true,
			fiat_fees: {
				on_ramp: [
					{
						currency: 'EUR',
						fee: 'Free',
						method: 'SEPA',
						min: '€1',
						note: 'Bank fees may apply.',
						src: { label: 'Source', url: 'https://example.com/fiat-fees' },
						time: '1-2 business days'
					}
				],
				off_ramp: []
			},
			ramp_cost_1k: RAMP_COST
		},
		warnings: [{ level: 'caution', text: 'Limited coverage' }],
		regional: null,
		nvol: { spot: null, linear_perp: null, inverse_perp: null },
		rank: null,
		...patch
	}
}

function totals(patch: Partial<MasterDirectoryTotals> = {}): MasterDirectoryTotals {
	return {
		venues: 1,
		tracked: 1,
		spot_volume_24h: 500,
		linear_perp_volume_24h: 600,
		inverse_perp_volume_24h: 100,
		total_trading_volume_24h: 1_200,
		reserves_usd: 900,
		...patch
	}
}

function directoryResponse(venues: MasterDirectoryVenue[]): MasterDirectoryResponse {
	return {
		venues,
		totals: {
			...totals({ venues: venues.length, tracked: venues.filter((venue) => venue.tracked).length }),
			cex: totals(),
			dex: totals({
				venues: 0,
				tracked: 0,
				spot_volume_24h: null,
				linear_perp_volume_24h: null,
				inverse_perp_volume_24h: null,
				total_trading_volume_24h: null,
				reserves_usd: null
			})
		},
		freshness: FRESHNESS,
		last_updated: '2026-07-14T00:00:00Z'
	}
}

function pair(patch: Partial<MasterExchangePair> = {}): MasterExchangePair {
	return {
		market_type: 'perpetual',
		contract_type: 'linear',
		base: 'btc',
		quote: 'usdt',
		base_coingecko_id: 'bitcoin',
		quote_coingecko_id: 'tether',
		pair_id: 'BTCUSDT',
		market_id: 'venue:cex:perpetual:btcusdt',
		pair_url: 'https://example.com/btc-usdt',
		symbol: 'btc/usdt',
		price: 60_000,
		mark_price: 60_300,
		index_price: 60_000,
		price_change_24h: 0.02,
		volume_24h: 1_000,
		volume_prev_24h: 800,
		oi: 2,
		oi_usd: 120_000,
		oi_prev_usd: 100_000,
		funding_rate_8h: 0.0001,
		contract_size: 1,
		settle_asset: 'usdt',
		funding_period_h: 8,
		next_funding_ts: 1_721_000_000,
		expiry_ts: null,
		listed_ts: 1_700_000_000,
		max_leverage: 50,
		taker_fee: 0.0005,
		maker_fee: 0.0002,
		price_precision: 0.1,
		amount_precision: 0.001,
		min_order_cost: 5,
		best_bid: 59_990,
		best_ask: 60_010,
		depth_bid_usd: [10, 20],
		depth_ask_usd: [12, 24],
		depth_bid_max_dist: 0.03,
		depth_ask_max_dist: 0.04,
		nvol: {
			reported: 1_000,
			normalized: 700,
			active_liquidity: 350,
			band: 0.02,
			daily_vol: 0.03,
			coverage: 0.04,
			status: 'covered',
			category: 'fully_supported',
			flag: null
		},
		volume_change_24h: 0.25,
		oi_change_24h: 0.2,
		freshness: FRESHNESS,
		...patch
	}
}

function indexResponse(): MasterExchangeIndexResponse {
	return {
		slug: 'venue',
		type: 'cex',
		liquidity: liquidity({ spot: null, linear_perp: OWN, inverse_perp: OWN }),
		segments: {
			linear_perp: {
				markets: 1,
				coins: 1,
				volume_24h: null,
				volume_prev_24h: 800,
				oi_usd: 120_000,
				oi_prev_usd: 100_000,
				freshness: FRESHNESS,
				pairs: [pair()]
			},
			inverse_perp: {
				markets: 1,
				coins: 1,
				volume_24h: 200,
				volume_prev_24h: 100,
				oi_usd: null,
				oi_prev_usd: null,
				freshness: FRESHNESS,
				doublecount: { oi: 'Reported open interest counts both sides (~2× a one-sided figure)' },
				pairs: [pair({ contract_type: 'inverse', nvol: null })]
			}
		},
		capabilities: {
			linear_perp: { oi: true, funding: true, depth: true },
			inverse_perp: { oi: false, funding: false, depth: true }
		},
		freshness: FRESHNESS,
		depth_bands: [0.005, 0.02],
		last_updated: '2026-07-14T00:00:00Z'
	}
}

function metadataResponse(): MasterExchangeMetadataResponse {
	return {
		...venueCore('venue', { display_name: 'Venue Display' }),
		native_token: { symbol: 'V', name: 'Venue Token', coingecko_id: 'venue-token', url: '/token/V' },
		promotions: [],
		kpis: [{ key: 'status', label: 'Status', type: 'badge', value: 'Available', tone: 'positive' }],
		groups: [
			{
				key: 'identity',
				title: 'Identity',
				fields: [{ key: 'legal-name', label: 'Legal name', type: 'text', value: 'Venue Ltd', comparable: true }]
			}
		],
		last_updated: '2026-07-14T00:01:00Z'
	}
}

function micaVenue(patch: Partial<MasterMicaVenue> = {}): MasterMicaVenue {
	return {
		...venueCore('venue'),
		native_token: null,
		founded: null,
		hq: null,
		license_count: 1,
		fiat_currency_count: 1,
		has_fiat_onramp: true,
		fiat_fees: null,
		warnings: [],
		ramp_cost_1k: RAMP_COST,
		depth_summary: {
			spot: { bid_2pct_usd: 4, ask_2pct_usd: 4, bid_05pct_usd: 3, ask_05pct_usd: 3, partial: false },
			linear_perp: { bid_2pct_usd: 2, ask_2pct_usd: 2, bid_05pct_usd: 1, ask_05pct_usd: 1, partial: false },
			inverse_perp: null
		},
		eu_status: 'available',
		mica_status: 'active',
		mica_licensed: true,
		mica_member_state: 'FR',
		mica_regulator: 'AMF',
		products: ['spot'],
		promotions: [],
		kyc_required: true,
		kyc_short: 'ID',
		kyc_summary: 'Identity document',
		fees: {
			spot: { maker: 0.001, taker: 0.002 },
			linear_perp: null,
			inverse_perp: null
		},
		fee_token: null,
		reserves_usd: null,
		reserves_source_url: null,
		clean_reserves_usd: null,
		own_token_pct: null,
		inflows_24h_usd: null,
		metrics: {
			spot: { volume_24h_usd: 100, oi_usd: null, market_count: 2 },
			linear_perp: null,
			inverse_perp: null
		},
		total_trading_volume_24h: 100,
		last_verified: '2026-07',
		secondary: false,
		...patch
	}
}

describe('master directory mapper', () => {
	it('orders ranked venues by quality score and rank before volume-ranked unscored venues', () => {
		const withVolume = (slug: string, totalTradingVolume: number) => {
			const venue = directoryVenue()
			return directoryVenue({
				slug,
				totals: { ...venue.totals, total_trading_volume_24h: totalTradingVolume }
			})
		}
		const withQuality = (slug: string, score: number, rank: number, totalTradingVolume: number) => ({
			...withVolume(slug, totalTradingVolume),
			rank: { score, rank, segments: {}, components: {} }
		})

		const rows = mapMasterDirectory(
			directoryResponse([
				withVolume('unranked-smaller', 1_000),
				withQuality('lower-score', 80, 1, 10_000),
				withQuality('score-tie-rank-two', 90, 2, 100),
				withVolume('unranked-larger', 2_000),
				withQuality('score-tie-rank-one', 90, 1, 50)
			])
		).rows

		expect(rows.map((row) => row.slug)).toEqual([
			'score-tie-rank-one',
			'score-tie-rank-two',
			'lower-score',
			'unranked-larger',
			'unranked-smaller'
		])
		expect(rows[0].quality).toMatchObject({ score: 90, rank: 1 })
	})

	it('uses canonical totals and preserves nullable segment observations and enriched metadata', () => {
		const base = directoryVenue()
		const mapped = mapMasterDirectory(
			directoryResponse([
				directoryVenue({
					segments: { ...base.segments, spot: { ...base.segments.spot!, volume_24h: null } }
				})
			])
		)
		const row = mapped.rows[0]

		expect(mapped.summary).toMatchObject({
			totalVolume24h: 1_200,
			spotVolume24h: 500,
			linearPerpVolume24h: 600,
			inversePerpVolume24h: 100,
			linearPerpOpenInterestUsd: 300,
			inversePerpOpenInterestUsd: null
		})
		expect(row).toMatchObject({
			profileHref: '/exchange/venue',
			secondaryUrl: null,
			reservesHref: '/exchange/venue?section=reserves',
			websiteUrl: 'https://example.com',
			referralUrl: null,
			related: { euEntity: null, globalEntity: null },
			segments: { spot: { volume24h: null, coinCount: 2, volumeUpdatedAt: FRESHNESS.volume } },
			sparks: { spot: [70, 100] },
			reserves: { inflows7dUsd: 20, inflows1mUsd: 30, auditor: 'Auditor' },
			compliance: { eeaOrderbookOwnership: null },
			funding: {
				fiatCurrencies: ['EUR'],
				fiatFees: {
					onRamp: [
						{
							currency: 'EUR',
							fee: 'Free',
							method: 'SEPA',
							minimum: '€1',
							note: 'Bank fees may apply.',
							source: { label: 'Source', url: 'https://example.com/fiat-fees' },
							processingTime: '1-2 business days'
						}
					],
					offRamp: []
				},
				hasFiatOnramp: true,
				rampCost: { onRamp: { totalUsd: 10 } }
			},
			warnings: [{ level: 'caution', text: 'Limited coverage' }]
		})
	})

	it('excludes shared-book segments from the aggregate open interest', () => {
		const summary = mapMasterDirectory(
			directoryResponse([
				directoryVenue(),
				directoryVenue({
					slug: 'venue-eu',
					liquidity: liquidity({ linear_perp: sharedWith('venue', 'full') }),
					links: { profile: '/exchange/venue-eu', website: null, defillama: null }
				})
			])
		).summary

		expect(summary.linearPerpOpenInterestUsd).toBe(300)
		expect(summary.inversePerpOpenInterestUsd).toBeNull()
	})

	it('maps the parent entity and per-segment liquidity relations for child venues', () => {
		const parentEntity = {
			slug: 'venue',
			name: 'Venue',
			scope: { kind: 'global' } as const,
			profile_url: '/exchange/venue' as const
		}
		const rows = mapMasterDirectory(
			directoryResponse([
				directoryVenue(),
				directoryVenue({
					slug: 'venue-eu',
					display_name: 'Venue EU',
					parent_entity: parentEntity,
					liquidity: liquidity({ spot: sharedWith('venue', 'subset'), linear_perp: OWN }),
					links: { profile: '/exchange/venue-eu', website: null, defillama: null }
				})
			])
		).rows
		const parentRow = rows.find((item) => item.slug === 'venue')!
		const childRow = rows.find((item) => item.slug === 'venue-eu')!

		expect(parentRow.parent).toBeNull()
		expect(childRow.parent).toEqual({ slug: 'venue', name: 'Venue' })
		expect(childRow.liquidity).toEqual({
			spot: { mode: 'shared', coverage: 'subset', source: { slug: 'venue', name: 'venue' } },
			linear_perp: { mode: 'own' },
			inverse_perp: null
		})
	})

	it('splits the single backend website destination into referral and official actions', () => {
		const [row] = mapMasterDirectory(
			directoryResponse([
				directoryVenue({
					links: {
						profile: '/exchange/venue',
						website: { url: 'https://example.com/ref', kind: 'referral' },
						defillama: null
					}
				})
			])
		).rows

		expect(row.referralUrl).toBe('https://example.com/ref')
		expect(row.websiteUrl).toBeNull()
		expect(row.secondaryUrl).toBeNull()
	})

	it('uses the canonical profile route for a listed metadata-only venue', () => {
		const [row] = mapMasterDirectory(directoryResponse([directoryVenue({ tracked: false })])).rows
		expect(row.profileHref).toBe('/exchange/venue')
		expect(row.secondaryUrl).toBeNull()
		expect(row.reservesHref).toBe('/exchange/venue?section=reserves')
	})

	it('derives EEA and global relations only when both entities are directory-listed', () => {
		const eeaScope: MasterEntityScope = { kind: 'regional', regions: ['eea'] }
		const globalEntity = {
			slug: 'venue',
			name: 'Venue Global',
			scope: { kind: 'global' } as const,
			profile_url: '/exchange/venue' as const
		}
		const eeaEntity = {
			slug: 'venue-eu',
			name: 'Venue EU',
			scope: eeaScope,
			profile_url: '/exchange/venue-eu' as const
		}
		const response = directoryResponse([
			directoryVenue({ related_entities: [eeaEntity] }),
			directoryVenue({
				slug: 'venue-eu',
				display_name: 'Venue EU',
				scope: eeaScope,
				parent_entity: globalEntity,
				related_entities: [globalEntity],
				tracked: false,
				links: { profile: '/exchange/venue-eu', website: null, defillama: null }
			})
		])
		const rows = mapMasterDirectory(response).rows
		const globalRow = rows.find((item) => item.slug === 'venue')!
		const euRow = rows.find((item) => item.slug === 'venue-eu')!

		expect(globalRow.related).toEqual({
			euEntity: { slug: 'venue-eu', name: 'Venue EU', profileHref: '/exchange/venue-eu' },
			globalEntity: null
		})
		expect(euRow.related).toEqual({
			euEntity: null,
			globalEntity: { slug: 'venue', name: 'Venue Global', profileHref: '/exchange/venue' }
		})
	})

	it('omits a related EEA entity that is not a directory row', () => {
		const legalEntity = {
			slug: 'legal-eu',
			name: 'Legal EU',
			scope: { kind: 'regional', regions: ['eea'] } as MasterEntityScope,
			profile_url: '/exchange/legal-eu'
		}
		const [venue] = mapMasterDirectory(
			directoryResponse([directoryVenue({ slug: 'venue', related_entities: [legalEntity] })])
		).rows

		expect(venue.related.euEntity).toBeNull()
	})

	it('derives own, shared, and mixed EEA orderbook ownership from exact segment relations', () => {
		const eeaScope: MasterEntityScope = { kind: 'regional', regions: ['eea'] }
		const rows = mapMasterDirectory(
			directoryResponse([
				directoryVenue(),
				directoryVenue({
					slug: 'own-eu',
					scope: eeaScope,
					liquidity: liquidity({ linear_perp: null }),
					links: { profile: '/exchange/own-eu', website: null, defillama: null }
				}),
				directoryVenue({
					slug: 'shared-eu',
					scope: eeaScope,
					liquidity: liquidity({ spot: sharedWith('venue', 'subset'), linear_perp: null }),
					links: { profile: '/exchange/shared-eu', website: null, defillama: null }
				}),
				directoryVenue({
					slug: 'okx-eu',
					scope: eeaScope,
					liquidity: liquidity({ spot: sharedWith('okx', 'full'), linear_perp: OWN }),
					links: { profile: '/exchange/okx-eu', website: null, defillama: null }
				})
			])
		).rows

		expect(rows.find((row) => row.slug === 'venue')?.compliance?.eeaOrderbookOwnership).toBeNull()
		expect(rows.find((row) => row.slug === 'own-eu')?.compliance?.eeaOrderbookOwnership).toEqual({ mode: 'own' })
		expect(rows.find((row) => row.slug === 'shared-eu')?.compliance?.eeaOrderbookOwnership).toEqual({
			mode: 'shared'
		})
		expect(rows.find((row) => row.slug === 'okx-eu')?.compliance?.eeaOrderbookOwnership).toEqual({
			mode: 'mixed',
			sharedSegments: ['spot'],
			dedicatedSegments: ['linear_perp']
		})
	})

	it('preserves nullable totals instead of fabricating empty-group zeroes', () => {
		const response = directoryResponse([directoryVenue()])
		response.totals.spot_volume_24h = null
		response.totals.linear_perp_volume_24h = 0
		response.totals.inverse_perp_volume_24h = null
		const summary = mapMasterDirectory(response).summary

		expect(summary.spotVolume24h).toBeNull()
		expect(summary.linearPerpVolume24h).toBe(0)
		expect(summary.inversePerpVolume24h).toBeNull()
		expect(summary.volumeByKind.dex).toEqual({ spot: null, linearPerp: null, inversePerp: null, total: null })
	})

	it('maps per-segment normalized volume without inventing an aggregate perp column', () => {
		const [row] = mapMasterDirectory(
			directoryResponse([
				directoryVenue({
					nvol: {
						spot: { reported: 100, normalized: 70, discount_pct: 0.3, unverified_pct: 0.1, flag: null },
						linear_perp: null,
						inverse_perp: null
					}
				})
			])
		).rows

		expect(row.normalizedVolume).toEqual({
			spot: { reported: 100, normalized: 70, discountFraction: 0.3, unverifiedFraction: 0.1, flag: null },
			linear_perp: null,
			inverse_perp: null
		})
	})

	it('preserves nullable nested directory fields', () => {
		const venue = directoryVenue({
			reserves: { ...directoryVenue().reserves!, source_url: null },
			fees: { ...directoryVenue().fees!, spot: null },
			compliance: {
				...directoryVenue().compliance!,
				eu_status: null,
				kyc: null
			}
		})
		const [row] = mapMasterDirectory(directoryResponse([venue])).rows

		expect(row.reserves?.sourceUrl).toBeNull()
		expect(row.fees?.spot).toBeNull()
		expect(row.compliance).toMatchObject({ euStatus: null, kyc: null, mica: { licensed: true } })
	})

	it('keeps linear and inverse perp fees separate without borrowing across classes', () => {
		const linearFee = { maker: 0.0002, taker: 0.0005 }
		const inverseFee = { maker: 0.0001, taker: 0.0004 }
		const rows = mapMasterDirectory(
			directoryResponse([
				directoryVenue({ fees: { spot: null, linear_perp: linearFee, inverse_perp: inverseFee, fee_token: null } }),
				directoryVenue({
					slug: 'inverse-only',
					links: { profile: '/exchange/inverse-only', website: null, defillama: null },
					fees: { spot: null, linear_perp: null, inverse_perp: inverseFee, fee_token: null }
				})
			])
		).rows
		const both = rows.find((row) => row.slug === 'venue')
		const inverseOnly = rows.find((row) => row.slug === 'inverse-only')

		expect(both?.fees).toMatchObject({ linearPerp: linearFee, inversePerp: inverseFee })
		expect(inverseOnly?.fees).toMatchObject({ linearPerp: null, inversePerp: inverseFee })
	})

	it('requires a capability block for every present segment', () => {
		expect(() => mapMasterDirectory(directoryResponse([directoryVenue({ capabilities: {} })]))).toThrow(
			'Missing spot capabilities for venue'
		)
	})

	it('produces directory props accepted by the Pages Router serializer', () => {
		expect(
			isSerializableProps('/exchanges', 'getStaticProps', {
				directory: mapMasterDirectory(directoryResponse([directoryVenue()]))
			})
		).toBe(true)
	})

	it('indexes columnar history, skips unsupported null columns, and fails on misalignment', () => {
		const payload = {
			days: [1, 2],
			key: ['total_spot_volume', 'total_linear_perp_volume', 'total_inverse_perp_volume'],
			series: [[100, 110], [200, 210], null],
			last_updated: '2026-07-14T00:00:00Z'
		}
		const mapped = mapMasterDirectoryOverview(payload)
		expect(mapped.series.total_linear_perp_volume).toEqual([200, 210])
		expect('total_inverse_perp_volume' in mapped.series).toBe(false)
		expect(() => mapMasterDirectoryOverview({ ...payload, series: [[100, 110]] })).toThrow(
			'Series columns do not match the key axis'
		)
		expect(() =>
			mapMasterDirectoryOverview({
				...payload,
				series: [[100, 110], [200], null]
			})
		).toThrow('Series column total_linear_perp_volume does not match the day axis')
	})
})

describe('master profile mapper', () => {
	it('keeps per-segment capabilities, canonical links, null volume, and pair reference prices', () => {
		const profile = mapMasterProfile(indexResponse(), metadataResponse())
		const linear = profile.segments.linear_perp!
		const inverse = profile.segments.inverse_perp!
		const mappedPair = linear.pairs[0]

		expect(profile.name).toBe('Venue Display')
		expect(profile.slug).toBe('venue')
		expect(profile.kind).toBe('cex')
		expect(profile.profileMode).toBe('markets')
		expect(profile.defillamaUrl).toBe('/cex/venue-cex')
		expect(profile.defillamaCexSlug).toBe('venue-cex')
		expect(profile.nativeToken).toEqual({
			coinId: 'venue-token',
			name: 'Venue Token',
			symbol: 'V',
			url: '/token/V',
			priceUsd: null,
			change24h: null
		})
		expect(profile.reserves).toBeNull()
		expect(profile.metadata.website).toBe('https://example.com')
		expect(profile.metadata.referralUrl).toBeNull()
		expect(linear).toMatchObject({
			volume24h: null,
			capabilities: { openInterest: true, funding: true, depth: true }
		})
		expect(inverse.capabilities).toEqual({ openInterest: false, funding: false, depth: true })
		expect(mappedPair).toMatchObject({
			baseGeckoId: 'bitcoin',
			quoteGeckoId: 'tether',
			markPrice: 60_300,
			indexPrice: 60_000,
			nextFundingAt: 1_721_000_000,
			volumeUpdatedAt: FRESHNESS.volume,
			depthBid2Usd: 20,
			normalizedVolume: { discountFraction: 0.3 }
		})
		expect(mappedPair.basis).toBeCloseTo(0.005)
	})

	it('surfaces a backend referral destination as the profile referral action', () => {
		const metadata = metadataResponse()
		metadata.links = {
			...metadata.links,
			website: { url: 'https://example.com/ref', kind: 'referral' }
		}
		const profile = mapMasterProfile(indexResponse(), metadata)

		expect(profile.metadata.referralUrl).toBe('https://example.com/ref')
		expect(profile.metadata.website).toBeNull()
	})

	it('maps a metadata-only profile without manufacturing market segments', () => {
		const metadata = metadataResponse()
		metadata.slug = 'bitpanda'
		metadata.display_name = 'Bitpanda'
		metadata.directory_visibility = 'mica-only'
		metadata.profile_mode = 'metadata-only'
		metadata.links.profile = '/exchange/bitpanda'

		expect(mapMasterMetadataOnlyProfile(metadata)).toMatchObject({
			slug: 'bitpanda',
			name: 'Bitpanda',
			profileMode: 'metadata-only',
			segments: {},
			metadata: { groups: [{ key: 'identity' }] }
		})
	})

	it('promotes the primary Twitter link without selecting staff accounts', () => {
		const metadata = metadataResponse()
		metadata.groups.push({
			key: 'links',
			title: 'Links',
			fields: [
				{
					key: 'links',
					label: 'Links',
					type: 'links',
					value: [
						{ label: '@founder · Founder', url: 'https://x.com/founder' },
						{ label: 'X/Twitter', url: 'https://x.com/venue' }
					],
					comparable: true
				}
			]
		})

		expect(mapMasterMetadataOnlyProfile(metadata).metadata.twitterUrl).toBe('https://x.com/venue')
	})

	it.each([
		['missing mark', { mark_price: null }],
		['missing index', { index_price: null }],
		['zero index', { index_price: 0 }]
	] as const)('leaves basis unavailable for %s', (_label, patch) => {
		const index = indexResponse()
		index.segments.linear_perp!.pairs = [pair(patch)]
		expect(mapMasterProfile(index, metadataResponse()).segments.linear_perp!.pairs[0].basis).toBeNull()
	})

	it('requires metadata and keeps metadata-backed props serializable', () => {
		expect(
			isSerializableProps('/exchange/[slug]', 'getStaticProps', {
				profile: mapMasterProfile(indexResponse(), metadataResponse())
			})
		).toBe(true)
	})
})

describe('canonical research charts', () => {
	it('preserves separate metric columns, an absent column, and observed zero', () => {
		const response: MasterChartColumnarResponse<'volume'> = {
			days: [1, 2],
			key: ['spot', 'linear_perp', 'inverse_perp', 'spot_mkts', 'linear_perp_mkts', 'inverse_perp_mkts'],
			exchanges: ['spot-only', 'perp-only'],
			types: ['cex', 'dex'],
			series: [
				[[0, 10], null, null, null, null, null],
				[null, [20, 0], null, null, null, null]
			],
			names: { 'spot-only': 'spot-only', 'perp-only': 'perp-only' },
			last_updated: '2026-07-14T00:00:00Z',
			built_at: '2026-07-14T00:02:00Z',
			range: '1y'
		}

		expect(decodeMasterChart(response)).toEqual([
			{ exchange: 'spot-only', type: 'cex', metrics: { spot: [0, 10] } },
			{ exchange: 'perp-only', type: 'dex', metrics: { linear_perp: [20, 0] } }
		])
	})

	it('rejects columnar chart axes that are not aligned', () => {
		const response: MasterChartColumnarResponse<'volume'> = {
			days: [1, 2],
			key: ['spot', 'linear_perp', 'inverse_perp', 'spot_mkts', 'linear_perp_mkts', 'inverse_perp_mkts'],
			exchanges: ['venue'],
			types: ['cex'],
			series: [[[10], null, null, null, null, null]],
			names: { venue: 'venue' },
			last_updated: '2026-07-14T00:00:00Z',
			built_at: '2026-07-14T00:02:00Z',
			range: '1y'
		}

		expect(() => decodeMasterChart(response)).toThrow('Chart column spot for venue does not match the day axis')
		expect(() => decodeMasterChart({ ...response, series: [[]] })).toThrow(
			'Chart columns for venue do not match the metric axis'
		)
		expect(() =>
			decodeMasterChart({
				...response,
				btc_depth: { spot: [10], linear_perp: [20, 30], inverse_perp: [1, 2] }
			})
		).toThrow('BTC depth columns do not match the day axis')
	})

	it('keeps top venues plus Other and groups the same rows by venue type', () => {
		const response: MasterChartColumnarResponse<'oi'> = {
			days: [1, 2],
			key: ['linear_perp', 'inverse_perp'],
			exchanges: Array.from({ length: 10 }, (_, index) => `venue-${index + 1}`),
			types: Array.from({ length: 10 }, (_, index) => (index === 9 ? 'dex' : 'cex')),
			series: Array.from({ length: 10 }, (_, index) => [
				[index + 1, index + 1],
				[0, 0]
			]),
			names: Object.fromEntries(
				Array.from({ length: 10 }, (_, index) => [
					`venue-${index + 1}`,
					index === 9 ? 'Venue Ten' : `Venue ${index + 1}`
				])
			),
			last_updated: '2026-07-14T00:00:00Z',
			built_at: '2026-07-14T00:02:00Z',
			range: '1y'
		}
		const report = mapMasterResearchReport('oi', response)
		const venues = report.views.find((view) => view.id === 'open-interest-linear-exchanges')!.chart.lines
		const types = report.views.find((view) => view.id === 'open-interest-types')!.chart.lines

		expect(venues.map((line) => line.id)).toEqual([
			'venue-10',
			'venue-9',
			'venue-8',
			'venue-7',
			'venue-6',
			'venue-5',
			'venue-4',
			'venue-3',
			'other'
		])
		expect(venues.at(-1)?.values).toEqual([3, 3])
		expect(venues.find((line) => line.id === 'venue-9')?.label).toBe('Venue 9')
		expect(types).toEqual([
			{ id: 'cex-linear_perp', label: 'CEX · Linear Perps', values: [45, 45] },
			{ id: 'cex-inverse_perp', label: 'CEX · Inverse Perps', values: [0, 0] },
			{ id: 'dex-linear_perp', label: 'DEX · Linear Perps', values: [10, 10] },
			{ id: 'dex-inverse_perp', label: 'DEX · Inverse Perps', values: [0, 0] }
		])
	})

	it('keeps linear and inverse perpetual columns separate: no view ever renders their sum', () => {
		const response: MasterChartColumnarResponse<'volume'> = {
			days: [1, 2],
			key: ['spot', 'linear_perp', 'inverse_perp', 'spot_mkts', 'linear_perp_mkts', 'inverse_perp_mkts'],
			exchanges: ['cex-venue', 'dex-venue'],
			types: ['cex', 'dex'],
			series: [
				[[10, 11], [100, 110], [1, null], null, null, null],
				[null, [20, 21], null, null, null, null]
			],
			names: { 'cex-venue': 'cex-venue', 'dex-venue': 'dex-venue' },
			last_updated: '2026-07-14T00:00:00Z',
			built_at: '2026-07-14T00:02:00Z',
			range: '1y'
		}
		const report = mapMasterResearchReport('volume', response)

		expect(report.views.map((view) => view.id)).toEqual([
			'spot-exchanges',
			'linear-perp-exchanges',
			'inverse-perp-exchanges',
			'volume-types'
		])
		expect(report.views.find((view) => view.id === 'spot-exchanges')?.chart.lines).toEqual([
			{ id: 'cex-venue', label: 'cex-venue', values: [10, 11] }
		])
		expect(report.views.find((view) => view.id === 'linear-perp-exchanges')?.chart.lines).toEqual([
			{ id: 'cex-venue', label: 'cex-venue', values: [100, 110] },
			{ id: 'dex-venue', label: 'dex-venue', values: [20, 21] }
		])
		expect(report.views.find((view) => view.id === 'inverse-perp-exchanges')?.chart.lines).toEqual([
			{ id: 'cex-venue', label: 'cex-venue', values: [1, null] }
		])
		expect(report.views.find((view) => view.id === 'volume-types')?.chart.lines).toEqual([
			{ id: 'cex-spot', label: 'CEX · Spot', values: [10, 11] },
			{ id: 'cex-linear_perp', label: 'CEX · Linear Perps', values: [100, 110] },
			{ id: 'cex-inverse_perp', label: 'CEX · Inverse Perps', values: [1, null] },
			{ id: 'dex-linear_perp', label: 'DEX · Linear Perps', values: [20, 21] }
		])
		// The combined perp figure (101 = 100 + 1) must not appear on any line of any view.
		for (const view of report.views) {
			for (const line of view.chart.lines) {
				expect(line.values).not.toContain(101)
			}
		}
	})

	it('groups normalized volume by exact segment without losing observed zero', () => {
		const response: MasterChartColumnarResponse<'nvol'> = {
			days: [1, 2],
			key: ['spot', 'linear_perp', 'inverse_perp', 'reported_spot', 'reported_linear_perp', 'reported_inverse_perp'],
			exchanges: ['one', 'two'],
			types: ['cex', 'dex'],
			series: [
				[[30, 0], [20, 10], null, [60, 1], [40, 20], null],
				[null, [5, 0], null, null, [10, 1], null]
			],
			names: { one: 'one', two: 'two' },
			last_updated: '2026-07-14T00:00:00Z',
			built_at: '2026-07-14T00:02:00Z',
			range: '1y'
		}
		const report = mapMasterResearchReport('nvol', response)

		expect(report.views.find((view) => view.id === 'normalized-segments')?.chart.lines).toEqual([
			{ id: 'spot', label: 'Spot', values: [30, 0] },
			{ id: 'linear_perp', label: 'Linear Perps', values: [25, 10] }
		])
	})

	it('keeps the three BTC depth segments as separate presentation lines', () => {
		const response: MasterChartColumnarResponse<'depth'> = {
			days: [1, 2],
			key: ['spot', 'linear_perp', 'inverse_perp'],
			exchanges: ['venue'],
			types: ['cex'],
			series: [
				[
					[10, 20],
					[1, 2],
					[3, null]
				]
			],
			btc_depth: {
				spot: [100, 200],
				linear_perp: [10, 20],
				inverse_perp: [1, null]
			},
			names: { venue: 'venue' },
			last_updated: '2026-07-14T00:00:00Z',
			built_at: '2026-07-14T00:02:00Z',
			range: '1y'
		}
		const view = mapMasterResearchReport('depth', response).views.find((item) => item.id === 'btc-depth')!

		expect(view.chart.lines).toEqual([
			{ id: 'btc-spot', label: 'BTC spot depth', values: [100, 200] },
			{ id: 'btc-linear-perp', label: 'BTC linear perp depth', values: [10, 20] },
			{ id: 'btc-inverse-perp', label: 'BTC inverse perp depth', values: [1, null] }
		])
	})

	it('computes survival ratios per exchange and leaves non-positive or absent denominators unavailable', () => {
		const response: MasterChartColumnarResponse<'nvol'> = {
			days: [1, 2, 3],
			key: ['spot', 'linear_perp', 'inverse_perp', 'reported_spot', 'reported_linear_perp', 'reported_inverse_perp'],
			exchanges: ['covered', 'missing-reported'],
			types: ['cex', 'dex'],
			series: [
				[[30, 20, 10], [20, 10, 0], null, [60, 0, 0], [40, 0, 0], null],
				[[5, 5, 5], null, null, null, null, null]
			],
			names: { covered: 'covered', 'missing-reported': 'missing-reported' },
			last_updated: '2026-07-14T00:00:00Z',
			built_at: '2026-07-14T00:02:00Z',
			range: '1y'
		}
		const report = mapMasterResearchReport('nvol', response)
		const spotChart = report.views.find((view) => view.id === 'survival-spot-exchanges')!.chart
		const linearChart = report.views.find((view) => view.id === 'survival-linear-exchanges')!.chart

		expect(spotChart).toMatchObject({ metric: 'survival-ratio', valueSymbol: '%' })
		expect(spotChart.lines).toEqual([{ id: 'covered', label: 'covered', values: [0.5, null, null] }])
		// The linear class keeps its own per-segment ratio rather than blending into a combined figure.
		expect(linearChart.lines).toEqual([{ id: 'covered', label: 'covered', values: [0.5, null, null] }])
	})

	it('calculates Other survival from aggregate normalized and reported volume instead of summing ratios', () => {
		const exchanges = Array.from({ length: 10 }, (_, index) => `venue-${index + 1}`)
		const response: MasterChartColumnarResponse<'nvol'> = {
			days: [1],
			key: ['spot', 'linear_perp', 'inverse_perp', 'reported_spot', 'reported_linear_perp', 'reported_inverse_perp'],
			exchanges,
			types: exchanges.map(() => 'cex'),
			series: exchanges.map((_, index) => {
				const reported = 100 - index * 10
				const normalized = index === 8 ? 8 : index === 9 ? 7 : reported / 2
				return [[normalized], null, null, [reported], null, null]
			}),
			names: Object.fromEntries(exchanges.map((exchange) => [exchange, exchange])),
			last_updated: '2026-07-14T00:00:00Z',
			built_at: '2026-07-14T00:02:00Z',
			range: '1y'
		}
		const lines = mapMasterResearchReport('nvol', response).views.find((view) => view.id === 'survival-spot-exchanges')!
			.chart.lines

		expect(lines.at(-1)).toEqual({ id: 'other', label: 'Other', values: [0.5] })
	})
})

describe('MiCA contract', () => {
	it('qualifies MiCA rows as licensed and EU-available', () => {
		const rows = mapMasterMica({
			last_updated: '2026-07-14T00:00:00Z',
			exchanges: [
				micaVenue({ slug: 'qualified', eu_status: 'available', mica_licensed: true }),
				micaVenue({ slug: 'leaving', eu_status: 'leaving', mica_licensed: true }),
				micaVenue({ slug: 'unlicensed', eu_status: 'available', mica_licensed: null })
			]
		})
		expect(rows.map((row) => row.exchange)).toEqual(['qualified'])
	})

	it('maps per-segment fees, metrics, products, and the backend destination link', () => {
		const [row] = mapMasterMica({
			last_updated: '2026-07-14T00:00:00Z',
			exchanges: [
				micaVenue({
					display_name: 'Venue EU',
					parent_entity: {
						slug: 'venue',
						name: 'Venue',
						profile_url: '/exchange/venue',
						scope: { kind: 'global' }
					},
					products: ['spot', 'margin', 'linear_perp', 'inverse_perp', 'futures', 'options'],
					fees: {
						spot: { maker: 0.001, taker: 0.002 },
						linear_perp: { maker: 0.0002, taker: 0.0005 },
						inverse_perp: { maker: null, taker: null }
					},
					metrics: {
						spot: { volume_24h_usd: 100, oi_usd: null, market_count: 2 },
						linear_perp: { volume_24h_usd: 200, oi_usd: 50, market_count: 3 },
						inverse_perp: null
					},
					links: {
						profile: '/exchange/venue',
						website: { url: 'https://example.com/ref', kind: 'referral' },
						defillama: null
					}
				})
			]
		})

		expect(row).toMatchObject({
			exchange: 'venue',
			name: 'Venue EU',
			profileHref: '/exchange/venue',
			website: null,
			referralUrl: 'https://example.com/ref',
			products: ['spot', 'margin', 'linear_perp', 'inverse_perp', 'futures', 'options'],
			marketCount: 5,
			spotFee: { maker: 0.001, taker: 0.002 },
			perpFee: { maker: 0.0002, taker: 0.0005 }
		})
	})

	it('preserves consolidated Coinbase and Kraken EEA futures products', () => {
		const rows = mapMasterMica({
			last_updated: '2026-07-14T00:00:00Z',
			exchanges: [
				micaVenue({
					slug: 'coinbase',
					display_name: 'Coinbase',
					products: ['spot', 'futures'],
					links: { profile: '/exchange/coinbase', website: null, defillama: null },
					metrics: { spot: null, linear_perp: null, inverse_perp: null }
				}),
				micaVenue({
					slug: 'kraken',
					display_name: 'Kraken',
					products: ['spot', 'margin', 'futures'],
					links: { profile: '/exchange/kraken', website: null, defillama: null }
				})
			]
		})

		expect(
			rows.map(({ exchange, profileHref, products, marketCount }) => ({ exchange, profileHref, products, marketCount }))
		).toEqual([
			{
				exchange: 'coinbase',
				profileHref: '/exchange/coinbase',
				products: ['spot', 'futures'],
				marketCount: null
			},
			{
				exchange: 'kraken',
				profileHref: '/exchange/kraken',
				products: ['spot', 'margin', 'futures'],
				marketCount: 2
			}
		])
	})

	it('preserves nullable KYC and fee facts', () => {
		const [row] = mapMasterMica({
			last_updated: '2026-07-14T00:00:00Z',
			exchanges: [
				micaVenue({
					kyc_required: null,
					kyc_short: null,
					kyc_summary: null,
					fees: { spot: null, linear_perp: null, inverse_perp: null }
				})
			]
		})

		expect(row.kyc).toBeNull()
		expect(row.spotFee).toBeNull()
		expect(row.perpFee).toBeNull()
	})

	it('preserves segment-specific depth coverage and authored ramp costs', () => {
		const [row] = mapMasterMica({
			last_updated: '2026-07-14T00:00:00Z',
			exchanges: [
				micaVenue({
					promotions: [
						{
							title: 'Fee campaign',
							label: '20% off',
							type: 'fee_discount',
							url: 'https://example.com/campaign',
							terms_url: 'https://example.com/terms',
							priority: 5,
							source: { url: 'https://example.com/source' }
						},
						{
							title: 'Standard campaign',
							label: 'Standard',
							type: 'other',
							source: { url: 'https://example.com/standard-source' }
						}
					],
					depth_summary: {
						spot: null,
						linear_perp: { bid_2pct_usd: 0, ask_2pct_usd: 9, bid_05pct_usd: null, ask_05pct_usd: null, partial: true },
						inverse_perp: null
					}
				})
			]
		})

		expect(row.depth).toMatchObject({
			spotBid2Usd: null,
			spotAsk2Usd: null,
			perpBid2Usd: 0,
			perpAsk2Usd: 9,
			spotPartialCoverage: false,
			perpPartialCoverage: true
		})
		expect(row).toMatchObject({ micaStatus: 'active', micaLicensed: true, licenseCount: 1 })
		expect(row.promotions[0]).toMatchObject({
			label: '20% off',
			url: 'https://example.com/campaign',
			termsUrl: 'https://example.com/terms',
			priority: 5
		})
		expect(row.promotions[1].priority).toBeNull()
		expect(row.rampCost).toMatchObject({
			onRamp: { totalUsd: 10, totalFraction: 0.01 },
			offRamp: { totalUsd: 14, totalFraction: 0.014 }
		})
	})

	it('keeps spot and linear depth coverage independent in both directions', () => {
		const rows = mapMasterMica({
			last_updated: '2026-07-14T00:00:00Z',
			exchanges: [
				micaVenue({
					slug: 'spot-partial',
					depth_summary: {
						spot: { bid_2pct_usd: 1, ask_2pct_usd: 2, bid_05pct_usd: 1, ask_05pct_usd: 1, partial: true },
						linear_perp: {
							bid_2pct_usd: 3,
							ask_2pct_usd: 4,
							bid_05pct_usd: 2,
							ask_05pct_usd: 2,
							partial: false
						},
						inverse_perp: null
					}
				}),
				micaVenue({
					slug: 'linear-partial',
					depth_summary: {
						spot: { bid_2pct_usd: 1, ask_2pct_usd: 2, bid_05pct_usd: 1, ask_05pct_usd: 1, partial: false },
						linear_perp: {
							bid_2pct_usd: 3,
							ask_2pct_usd: 4,
							bid_05pct_usd: 2,
							ask_05pct_usd: 2,
							partial: true
						},
						inverse_perp: null
					}
				})
			]
		})

		expect(rows.map((row) => row.depth)).toMatchObject([
			{ spotPartialCoverage: true, perpPartialCoverage: false },
			{ spotPartialCoverage: false, perpPartialCoverage: true }
		])
	})

	it('preserves linear and inverse perpetual product classes and aggregate market counts', () => {
		const rows = mapMasterMica({
			last_updated: '2026-07-14T00:00:00Z',
			exchanges: [
				micaVenue({
					slug: 'inverse-only',
					products: ['inverse_perp'],
					metrics: {
						spot: null,
						linear_perp: null,
						inverse_perp: { volume_24h_usd: 10, oi_usd: 4, market_count: 2 }
					}
				}),
				micaVenue({
					slug: 'linear-only',
					products: ['linear_perp'],
					metrics: {
						spot: null,
						linear_perp: { volume_24h_usd: 20, oi_usd: 5, market_count: 3 },
						inverse_perp: null
					}
				}),
				micaVenue({
					slug: 'both',
					products: ['linear_perp', 'inverse_perp'],
					metrics: {
						spot: null,
						linear_perp: { volume_24h_usd: 20, oi_usd: 5, market_count: 3 },
						inverse_perp: { volume_24h_usd: 10, oi_usd: 4, market_count: 2 }
					}
				})
			]
		})

		expect(rows.map(({ products, marketCount }) => ({ products, marketCount }))).toEqual([
			{ products: ['inverse_perp'], marketCount: 2 },
			{ products: ['linear_perp'], marketCount: 3 },
			{ products: ['linear_perp', 'inverse_perp'], marketCount: 5 }
		])
	})
})
