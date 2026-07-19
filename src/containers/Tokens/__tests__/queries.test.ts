import { describe, expect, it } from 'vitest'
import type { MarketSegmentSummary } from '~/containers/Markets/api.types'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import type { TokensRawAdapterChainMetrics, TokensRawCoinGeckoRanking, TokensRawMarketsList } from '../api.types'
import { buildTokenOverviewCurrentMetricsById, buildTokensChartDataset, buildTokensSourceRows } from '../queries.server'

function marketSegment(overrides: Partial<MarketSegmentSummary>): MarketSegmentSummary {
	return {
		exchange_count: 1,
		funding_rate_8h: null,
		leverage_max: null,
		leverage_min: null,
		market_count: 1,
		oi_prev_usd: null,
		oi_usd: null,
		price: null,
		price_change_24h: null,
		volume_24h: 0,
		volume_prev_24h: null,
		...overrides
	}
}

function adapterMetric(
	defillamaId: string,
	total24h: number,
	parentProtocol?: string
): TokensRawAdapterChainMetrics['protocols'][number] {
	return {
		defillamaId,
		total24h,
		parentProtocol
	} as TokensRawAdapterChainMetrics['protocols'][number]
}

function tokenRightsEntry(overrides: Partial<IRawTokenRightsEntry>): IRawTokenRightsEntry {
	return {
		'Protocol Name': 'Ethena',
		Token: ['ENA'],
		'Last Updated': '2026-04-14',
		'Governance Decisions': ['ENA'],
		'Treasury Decisions': ['N/A'],
		'Revenue Decisions': ['sENA'],
		'Fee Switch Status': 'Pending',
		Buybacks: ['None'],
		Dividends: ['sUSDe'],
		Burns: 'Active',
		'DefiLlama ID': 'ethena',
		...overrides
	}
}

describe('buildTokensChartDataset', () => {
	it('projects the market-cap index into a compact deterministic chart contract', () => {
		const result = buildTokensSourceRows({
			tokens: [
				{ id: 'beta', name: 'Beta', symbol: 'b', market_cap: 100, price_change_percentage_24h: 2 },
				{
					id: 'alpha',
					name: 'Alpha',
					symbol: 'a',
					market_cap: 100,
					price_change_percentage_7d_in_currency: -3
				},
				{ id: 'small', name: 'Small', symbol: 's', market_cap: 50 },
				{ id: 'missing', name: 'Missing', symbol: 'm', market_cap: null }
			],
			markets: { last_updated: '', tokens: [] },
			tokenRightsEntries: [],
			stablecoinGeckoIds: new Set(['beta']),
			fees: [],
			revenue: [],
			holdersRevenue: [],
			unlocks: [],
			metadata: {
				tokenDirectory: {},
				protocolMetadata: {},
				emissionsSupplyMetrics: {}
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		})

		expect(buildTokensChartDataset(result.sortIndexes.marketCap, 2)).toEqual({
			names: ['Alpha', 'Beta'],
			symbols: ['A', 'B'],
			logoSources: ['@alpha', '@beta'],
			hrefs: [null, null],
			marketCaps: [100, 100],
			priceChanges: { '24h': [null, 2], '7d': [-3, null], '30d': [null, null] },
			stablecoins: [false, true]
		})
	})
})

describe('buildTokensSourceRows', () => {
	it('precomputes token rows from tokenlist, markets, adapter metrics, unlocks, and rights data', () => {
		const nowSec = 1_800_000_000
		const tokens: TokensRawCoinGeckoRanking[] = [
			{
				id: 'ethena',
				name: 'Ethena',
				symbol: 'ena',
				current_price: 2,
				market_cap: 1000,
				fully_diluted_valuation: 2000,
				market_cap_rank: 15,
				price_change_percentage_1h_in_currency: 1.5,
				price_change_percentage_24h_in_currency: -2.5,
				price_change_percentage_7d_in_currency: 7,
				price_change_percentage_30d_in_currency: 30,
				circulating_supply: 500,
				total_supply: 900,
				max_supply: 1000,
				total_volume: 777,
				last_updated: '2026-06-29T00:00:00Z'
			},
			{
				id: 'unmapped',
				name: 'Unmapped',
				symbol: 'none',
				current_price: 1,
				market_cap: 50
			}
		]
		const markets: TokensRawMarketsList = {
			last_updated: '2026-06-29T01:00:00Z',
			tokens: [
				{
					symbol: 'ENA',
					exchange_count: 3,
					market_count: 4,
					tags: [],
					total_oi_usd: 325,
					total_volume_24h: 350,
					segments: {
						spot: marketSegment({ price: 2.1, volume_24h: 100 }),
						linear_perp: marketSegment({ volume_24h: 200, oi_usd: 300 }),
						inverse_perp: marketSegment({ volume_24h: 50, oi_usd: 25 })
					}
				}
			]
		}
		const metadata = {
			tokenDirectory: {
				ethena: {
					name: 'Ethena',
					symbol: 'ENA',
					token_nk: 'coingecko:ethena',
					protocolId: 'ethena',
					route: '/token/ENA',
					logo: '/ena.png'
				}
			},
			protocolMetadata: {
				ethena: {
					name: 'Ethena',
					displayName: 'Ethena',
					gecko_id: 'ethena',
					perps: true,
					tokenRights: true
				}
			},
			emissionsSupplyMetrics: {
				ethena: {
					name: 'Ethena',
					supplyMetrics: {
						maxSupply: 1000,
						adjustedSupply: 600,
						tbdAmount: 0,
						incentiveAmount: 0,
						nonIncentiveAmount: 600
					}
				}
			}
		} as unknown as MetadataCache

		const result = buildTokensSourceRows({
			tokens,
			markets,
			tokenRightsEntries: [tokenRightsEntry({})],
			fees: [adapterMetric('ethena', 11)],
			revenue: [adapterMetric('ethena', 22)],
			holdersRevenue: [adapterMetric('ethena', 5.5)],
			unlocks: [
				{
					name: 'Ethena',
					token: 'ENA',
					gecko_id: 'ethena',
					maxSupply: 1000,
					totalLocked: 400,
					tPrice: 2,
					events: [
						{
							timestamp: nowSec - 10,
							noOfTokens: [5, 5]
						},
						{
							timestamp: nowSec + 20,
							noOfTokens: [100]
						},
						{
							timestamp: nowSec - 30 * 24 * 60 * 60 - 1,
							noOfTokens: [100]
						}
					],
					upcomingEvent: [
						{
							timestamp: nowSec + 10,
							noOfTokens: [12]
						}
					]
				}
			],
			metadata,
			nowSec
		})

		expect(result.updatedAt).toBe('2026-06-29T01:00:00Z')
		expect(result.stats).toMatchObject({
			totalMarketCap: 1050,
			marketCapWeightedChange24h: -2.5,
			spotVolume24h: 100,
			perpsVolume24h: 250,
			openInterest24h: 325,
			unlock30dUsd: 20,
			upcomingUnlockUsd: 24
		})

		const ethena = result.rows[0]
		expect(ethena).toMatchObject({
			id: 'ethena',
			logo: '/ena.png',
			href: '/token/ENA',
			tokenRightsHref: '/token/ENA#token-rights-and-value-accrual',
			price: 2,
			priceChange24h: -2.5,
			outstandingFdv: 1200,
			unlockedPercent: 60,
			spotVolume24h: 100,
			perpsVolume24h: 250,
			openInterest24h: 325,
			fees24h: 11,
			revenue24h: 22,
			holdersRevenue24h: 5.5,
			trsPercent: 25,
			unlock30dUsd: 20,
			upcomingUnlockUsd: 24
		})
		expect(ethena.rights).toMatchObject({
			protocolName: 'Ethena',
			primaryValue: null,
			governance: true,
			treasury: false,
			revenue: true,
			feeSwitchStatus: 'Pending',
			buybacks: false,
			dividends: true,
			burns: true,
			burnsStatus: 'Active',
			equityTone: 'warning'
		})
		const currentMetricsById = buildTokenOverviewCurrentMetricsById({ tokens, markets, metadata })
		expect(currentMetricsById.ethena).toEqual({
			currentPrice: 2,
			percentChange24h: -2.5,
			circulatingSupply: 500,
			totalSupply: 900,
			maxSupply: 1000,
			mcap: 1000,
			fdv: 2000,
			volume24h: 777,
			outstandingFDV: 1200
		})
		expect(currentMetricsById.missing).toBeUndefined()

		expect(result.rows[1]).toMatchObject({
			id: 'unmapped',
			logo: 'https://token-icons.llamao.fi/icons/tokens/gecko/unmapped?w=48&h=48',
			href: null,
			rights: null
		})
	})

	it('uses the shared snapshot metrics even when local metadata would derive another value', () => {
		const result = buildTokensSourceRows({
			tokens: [{ id: 'shared', name: 'Shared', symbol: 'shr', current_price: 1, market_cap: 100 }],
			markets: { last_updated: '', tokens: [] },
			currentMetricsById: {
				shared: {
					currentPrice: 2,
					percentChange24h: 3,
					circulatingSupply: 500,
					totalSupply: 900,
					maxSupply: 1000,
					mcap: 1000,
					fdv: 2000,
					volume24h: 777,
					outstandingFDV: 1200
				}
			},
			tokenRightsEntries: [],
			fees: [],
			revenue: [],
			holdersRevenue: [],
			unlocks: [],
			metadata: {
				tokenDirectory: {},
				protocolMetadata: {},
				emissionsSupplyMetrics: {}
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		})

		expect(result.rows[0]).toMatchObject({
			price: 2,
			priceChange24h: 3,
			marketCap: 1000,
			fdv: 2000,
			outstandingFdv: 1200
		})
	})

	it('flags stablecoins by gecko id and defaults to false without the set', () => {
		const tokens = [
			{ id: 'Tether', name: 'Tether', symbol: 'usdt', current_price: 1, market_cap: 100 },
			{ id: 'ethena', name: 'Ethena', symbol: 'ena', current_price: 1, market_cap: 50 }
		]
		const base = {
			markets: { last_updated: '', tokens: [] },
			tokenRightsEntries: [],
			fees: [],
			revenue: [],
			holdersRevenue: [],
			unlocks: [],
			metadata: {
				tokenDirectory: {},
				protocolMetadata: {},
				emissionsSupplyMetrics: {}
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		}

		const flagged = buildTokensSourceRows({ ...base, tokens, stablecoinGeckoIds: new Set(['tether']) })
		expect(flagged.rows.map((row) => row.isStablecoin)).toEqual([true, false])

		const unflagged = buildTokensSourceRows({ ...base, tokens })
		expect(unflagged.rows.map((row) => row.isStablecoin)).toEqual([false, false])
	})

	it('links rights to the protocol page when no token-directory route exists', () => {
		const result = buildTokensSourceRows({
			tokens: [
				{
					id: 'metadata-only',
					name: 'Metadata Only',
					symbol: 'meta',
					current_price: 1,
					market_cap: 100
				}
			],
			markets: { last_updated: '', tokens: [] },
			tokenRightsEntries: [
				tokenRightsEntry({
					'Protocol Name': 'Metadata Only',
					Token: ['META'],
					'DefiLlama ID': 'metadata-only'
				})
			],
			fees: [],
			revenue: [],
			holdersRevenue: [],
			unlocks: [],
			metadata: {
				tokenDirectory: {},
				protocolMetadata: {
					'metadata-only': {
						name: 'Metadata Only',
						displayName: 'Metadata Only',
						gecko_id: 'metadata-only',
						tokenRights: true
					}
				},
				emissionsSupplyMetrics: {}
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		})

		expect(result.rows[0]).toMatchObject({
			href: null,
			tokenRightsHref: '/protocol/token-rights/metadata-only',
			rights: { protocolName: 'Metadata Only' }
		})
	})

	it('keeps same-symbol token rows on their canonical token directory routes', () => {
		const result = buildTokensSourceRows({
			tokens: [
				{
					id: 'data',
					name: 'DATA',
					symbol: 'data',
					current_price: 1,
					market_cap: 100
				},
				{
					id: 'streamr',
					name: 'Streamr',
					symbol: 'data',
					current_price: 2,
					market_cap: 200
				}
			],
			markets: { last_updated: '', tokens: [] },
			tokenRightsEntries: [],
			fees: [],
			revenue: [],
			holdersRevenue: [],
			unlocks: [],
			metadata: {
				tokenDirectory: {
					data: {
						name: 'DATA',
						symbol: 'DATA',
						token_nk: 'coingecko:data',
						route: '/token/DATA'
					},
					streamr: {
						name: 'Streamr',
						symbol: 'DATA',
						token_nk: 'coingecko:streamr',
						route: '/token/Streamr'
					}
				},
				protocolMetadata: {},
				emissionsSupplyMetrics: {}
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		})

		expect(result.rows.map((row) => row.href)).toEqual(['/token/DATA', '/token/Streamr'])
	})

	it('prioritizes parent protocol matches for adapter metrics', () => {
		const result = buildTokensSourceRows({
			tokens: [
				{
					id: 'hyperliquid',
					name: 'Hyperliquid',
					symbol: 'hype',
					current_price: 1,
					market_cap: 100
				}
			],
			markets: { last_updated: '', tokens: [] },
			tokenRightsEntries: [],
			fees: [
				adapterMetric('hyperliquid-perps', 10, 'parent#hyperliquid'),
				adapterMetric('hyperliquid-spot-orderbook', 20, 'parent#hyperliquid')
			],
			revenue: [adapterMetric('parent#hyperliquid', 100), adapterMetric('hyperliquid-perps', 7, 'parent#hyperliquid')],
			holdersRevenue: [adapterMetric('hyperliquid-perps', 25, 'parent#hyperliquid')],
			unlocks: [],
			metadata: {
				tokenDirectory: {
					hype: {
						name: 'Hyperliquid',
						symbol: 'HYPE',
						token_nk: 'coingecko:hyperliquid',
						route: '/token/HYPE'
					}
				},
				protocolMetadata: {
					'hyperliquid-perps': {
						name: 'Hyperliquid Perps',
						displayName: 'Hyperliquid Perps',
						gecko_id: 'hyperliquid'
					},
					'parent#hyperliquid': {
						name: 'hyperliquid',
						displayName: 'Hyperliquid',
						gecko_id: 'hyperliquid'
					}
				},
				emissionsSupplyMetrics: {}
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		})

		expect(result.rows[0]).toMatchObject({
			fees24h: 30,
			revenue24h: 100,
			holdersRevenue24h: 25,
			trsPercent: 25
		})
	})

	it('paints buyback and dividend pie slices by shared structural value accrual', () => {
		const metadata = {
			tokenDirectory: {
				buybacks: {
					name: 'Buybacks Only',
					symbol: 'BUY',
					token_nk: 'coingecko:buybacks',
					protocolId: 'buybacks'
				},
				none: {
					name: 'No Accrual',
					symbol: 'NONE',
					token_nk: 'coingecko:none',
					protocolId: 'none'
				}
			},
			protocolMetadata: {},
			emissionsSupplyMetrics: {}
		} as unknown as MetadataCache

		const result = buildTokensSourceRows({
			tokens: [
				{
					id: 'buybacks',
					name: 'Buybacks Only',
					symbol: 'buy',
					current_price: 1,
					market_cap: 100
				},
				{
					id: 'none',
					name: 'No Accrual',
					symbol: 'none',
					current_price: 1,
					market_cap: 100
				}
			],
			markets: { last_updated: '', tokens: [] },
			tokenRightsEntries: [
				tokenRightsEntry({
					'Protocol Name': 'Buybacks Only',
					Token: ['BUY'],
					'Governance Decisions': ['None'],
					'Revenue Decisions': ['None'],
					Buybacks: ['BUY'],
					Dividends: ['None'],
					Fundraising: ['Token Sale'],
					Burns: 'None',
					'DefiLlama ID': 'buybacks'
				}),
				tokenRightsEntry({
					'Protocol Name': 'No Accrual',
					Token: ['NONE'],
					'Governance Decisions': ['None'],
					'Revenue Decisions': ['None'],
					Buybacks: ['None'],
					Dividends: ['None'],
					Fundraising: ['Unknown'],
					Burns: 'None',
					'DefiLlama ID': 'none'
				})
			],
			fees: [],
			revenue: [],
			holdersRevenue: [],
			unlocks: [],
			metadata,
			nowSec: 1_800_000_000
		})

		const buybacksOnly = result.rows.find((row) => row.id === 'buybacks')?.rights
		const noAccrual = result.rows.find((row) => row.id === 'none')?.rights

		expect(buybacksOnly).toMatchObject({ buybacks: true, dividends: false, equityTone: 'positive' })
		expect(noAccrual).toMatchObject({ buybacks: false, dividends: false, equityTone: 'warning' })
	})

	it('does not join symbol-only market metrics when multiple tokens share the symbol', () => {
		const result = buildTokensSourceRows({
			tokens: [
				{
					id: 'first-duplicate',
					name: 'First Duplicate',
					symbol: 'dup',
					current_price: 1,
					market_cap: 100
				},
				{
					id: 'second-duplicate',
					name: 'Second Duplicate',
					symbol: 'dup',
					current_price: 2,
					market_cap: 200
				}
			],
			markets: {
				last_updated: '',
				tokens: [
					{
						symbol: 'DUP',
						exchange_count: 1,
						market_count: 1,
						tags: [],
						total_oi_usd: 50,
						total_volume_24h: 100,
						segments: {
							spot: marketSegment({ price: 10, volume_24h: 100 }),
							linear_perp: marketSegment({ volume_24h: 200, oi_usd: 50 })
						}
					}
				]
			},
			tokenRightsEntries: [],
			fees: [],
			revenue: [],
			holdersRevenue: [],
			unlocks: [],
			metadata: {
				tokenDirectory: {},
				protocolMetadata: {},
				emissionsSupplyMetrics: {}
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		})

		expect(result.rows.map((row) => row.spotVolume24h)).toEqual([null, null])
		expect(result.rows.map((row) => row.perpsVolume24h)).toEqual([null, null])
		expect(result.rows.map((row) => row.openInterest24h)).toEqual([null, null])
		expect(result.stats).toMatchObject({
			spotVolume24h: 0,
			perpsVolume24h: 0,
			openInterest24h: 0
		})
	})
})
