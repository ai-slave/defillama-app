import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import type { IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import type { MarketSegmentSummary, TokenMarketsListResponse } from '~/containers/Markets/api.types'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import type { EnrichedProtocolEmission } from '~/containers/Unlocks/queries'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import {
	buildTokenMarketSummary,
	buildTokenFilterOptions,
	buildTokensChartDataset,
	buildTokensSourceRows,
	fetchTokensSourceRows
} from '../queries.server'
import { buildTokenOverviewCurrentMetricsById } from '../readModel'
import { buildTokensRowFilter } from '../utils'

const sourceMocks = vi.hoisted(() => ({
	fetchAdapterChainMetrics: vi.fn(() => Promise.resolve({ protocols: [] })),
	fetchTokenRightsEntries: vi.fn(() => Promise.resolve([])),
	getAllProtocolEmissions: vi.fn(() => Promise.resolve([])),
	refreshMetadataInBackgroundIfStale: vi.fn()
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainMetrics: sourceMocks.fetchAdapterChainMetrics
}))

vi.mock('~/containers/TokenRights/server/dataset.server', () => ({
	fetchTokenRightsEntries: sourceMocks.fetchTokenRightsEntries
}))

vi.mock('~/containers/Unlocks/queries', () => ({
	getAllProtocolEmissions: sourceMocks.getAllProtocolEmissions
}))

vi.mock('~/utils/metadata', () => ({
	default: {
		tokenlist: {},
		tokenDirectory: {},
		protocolMetadata: {},
		emissionsSupplyMetrics: {},
		tokenFilterMetadata: {
			schemaVersion: 1,
			generatedAt: 0,
			sources: { coingeckoCatalogGeneratedAt: 0, rankingsUpdatedAt: null },
			tokens: {},
			categories: []
		}
	},
	refreshMetadataInBackgroundIfStale: sourceMocks.refreshMetadataInBackgroundIfStale
}))

afterEach(() => {
	vi.useRealTimers()
	sourceMocks.getAllProtocolEmissions.mockClear()
})

function tokenFilterMetadata(
	tokens: MetadataCache['tokenFilterMetadata']['tokens'] = {}
): MetadataCache['tokenFilterMetadata'] {
	return {
		schemaVersion: 1,
		generatedAt: 0,
		sources: { coingeckoCatalogGeneratedAt: 0, rankingsUpdatedAt: null },
		tokens,
		categories: []
	}
}

describe('fetchTokensSourceRows', () => {
	it('retains future emissions while bounding the historical unlock window', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-08-23T12:00:00Z'))
		const nowSec = Math.floor(Date.now() / 1000)

		await fetchTokensSourceRows({
			tokens: [],
			markets: { last_updated: '', tokens: [] },
			currentMetricsById: {},
			tokenIndexById: new Map(),
			version: 'test',
			generatedAt: nowSec
		})

		expect(sourceMocks.getAllProtocolEmissions).toHaveBeenCalledWith({
			startDate: nowSec - 30 * 24 * 60 * 60,
			getHistoricalPrices: false,
			tokenlist: {}
		})
	})
})

describe('buildTokenFilterOptions', () => {
	it('orders options by aggregate token market cap with deterministic ties', () => {
		const rows = [
			{ marketCap: 100, chains: ['ethereum'], categories: ['stablecoins', 'rwa'] },
			{ marketCap: 80, chains: ['solana'], categories: ['rwa'] },
			{ marketCap: 30, chains: ['solana'], categories: ['stablecoins'] }
		]
		const result = buildTokenFilterOptions(rows, {
			chainDisplayNames: new Map([
				['ethereum', 'Ethereum'],
				['solana', 'Solana']
			]),
			tokenFilterMetadata: {
				schemaVersion: 1,
				generatedAt: 1,
				sources: { coingeckoCatalogGeneratedAt: 1, rankingsUpdatedAt: null },
				tokens: {},
				categories: [
					{ id: 'rwa', label: 'RWA' },
					{ id: 'stablecoins', label: 'Stablecoins' },
					{ id: 'unused', label: 'Unused' }
				]
			}
		})

		expect(result.chainOptions.map((option) => option.id)).toEqual(['solana', 'ethereum'])
		expect(result.categoryOptions.map((option) => option.id)).toEqual(['rwa', 'stablecoins', 'unused'])
	})
})

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
	total24h: number | null,
	parentProtocol?: string
): IAdapterChainMetrics['protocols'][number] {
	return {
		defillamaId,
		total24h,
		...(parentProtocol !== undefined ? { parentProtocol } : {}),
		breakdown24h: null,
		breakdown30d: null,
		name: defillamaId,
		displayName: defillamaId,
		module: null,
		category: null,
		logo: '',
		chains: [],
		protocolType: 'protocol',
		methodologyURL: null,
		methodology: null,
		slug: defillamaId,
		id: defillamaId
	}
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
			fees: [],
			revenue: [],
			holdersRevenue: [],
			unlocks: [],
			metadata: {
				tokenDirectory: {},
				protocolMetadata: {},
				emissionsSupplyMetrics: {},
				tokenFilterMetadata: tokenFilterMetadata({
					beta: { chains: [], categories: ['stablecoins'] }
				})
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		})

		expect(buildTokensChartDataset(result.sortIndexes.marketCap, null, 2)).toEqual({
			names: ['Alpha', 'Beta'],
			symbols: ['A', 'B'],
			logoSources: ['@alpha', '@beta'],
			hrefs: [null, null],
			marketCaps: [100, 100],
			priceChanges: { '24h': [null, 2], '7d': [-3, null], '30d': [null, null] },
			stablecoins: [false, true]
		})

		const filter = buildTokensRowFilter(
			{ categories: 'stablecoins' },
			[],
			[
				{ id: 'stablecoins', label: 'Stablecoins' },
				{ id: 'governance', label: 'Governance' }
			]
		)
		expect(buildTokensChartDataset(result.sortIndexes.marketCap, filter)).toEqual({
			names: ['Beta'],
			symbols: ['B'],
			logoSources: ['@beta'],
			hrefs: [null],
			marketCaps: [100],
			priceChanges: { '24h': [2], '7d': [null], '30d': [null] },
			stablecoins: [true]
		})
	})
})

describe('buildTokenMarketSummary', () => {
	it('combines ranking-period fields with the current shared token snapshot', () => {
		const summary = buildTokenMarketSummary(
			{
				id: 'aave',
				name: 'Aave',
				symbol: 'aave',
				market_cap_rank: 40,
				market_cap_rank_with_rehypothecated: 38,
				current_price: 200,
				price_change_percentage_7d_in_currency: 8.4,
				price_change_percentage_30d_in_currency: 3.1,
				ath: 666.86,
				ath_date: '2021-05-18T00:00:00Z'
			},
			{
				currentPrice: 214.4,
				percentChange24h: 2,
				circulatingSupply: 15_100_000,
				totalSupply: 16_000_000,
				maxSupply: 16_000_000,
				mcap: 3_240_000_000,
				fdv: 3_430_000_000,
				volume24h: 200_000_000,
				outstandingFDV: null
			},
			99
		)

		expect(summary).toMatchObject({
			symbol: 'AAVE',
			marketCapRank: 38,
			currentPrice: 214.4,
			priceChange7d: 8.4,
			priceChange30d: 3.1,
			marketCap: 3_240_000_000,
			fdv: 3_430_000_000,
			ath: 666.86
		})
	})
})

describe('buildTokensSourceRows', () => {
	it('precomputes token rows from tokenlist, markets, adapter metrics, unlocks, and rights data', () => {
		const nowSec = 1_800_000_000
		const tokens: IResponseCGTokenRankingsDatasetItem[] = [
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
		const markets: TokenMarketsListResponse = {
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
			},
			tokenFilterMetadata: tokenFilterMetadata()
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
					sources: [],
					protocolId: null,
					gecko_id: 'ethena',
					circSupply: 600,
					circSupply30d: 590,
					maxSupply: 1000,
					totalLocked: 400,
					unlocksPerDay: null,
					next24h: {
						cliff: 100,
						linear: 12 / 7,
						total: 100 + 12 / 7,
						unknownEventCount: 0
					},
					unlockEvents: null,
					tPrice: 2,
					tSymbol: 'ENA',
					historicalPrice: [],
					lastEvent: [],
					events: [
						{
							description: 'Weekly emissions',
							category: 'farming',
							unlockType: 'linear',
							timestamp: nowSec - 10,
							noOfTokens: [5, 10],
							rateDurationDays: 7
						},
						{
							description: 'Unknown amount',
							category: 'insiders',
							unlockType: 'cliff',
							timestamp: nowSec - 9,
							noOfTokens: [],
							hasUnknownTokenAmount: true
						},
						{
							description: 'Negative correction',
							category: 'insiders',
							unlockType: 'cliff',
							timestamp: nowSec - 8,
							noOfTokens: [-50]
						},
						{
							description: 'Recent cliff',
							category: 'insiders',
							unlockType: 'cliff',
							timestamp: nowSec - 7,
							noOfTokens: [10]
						},
						{
							description: 'Future cliff',
							category: 'insiders',
							unlockType: 'cliff',
							timestamp: nowSec + 20,
							noOfTokens: [100]
						},
						{
							description: 'Old cliff',
							category: 'insiders',
							unlockType: 'cliff',
							timestamp: nowSec - 30 * 24 * 60 * 60 - 1,
							noOfTokens: [100]
						}
					],
					upcomingEvent: [
						{
							description: 'Upcoming weekly emissions',
							category: 'farming',
							unlockType: 'linear',
							timestamp: nowSec + 10,
							noOfTokens: [6, 12],
							rateDurationDays: 7
						},
						{
							description: 'Upcoming zero',
							category: 'insiders',
							unlockType: 'cliff',
							timestamp: nowSec + 10,
							noOfTokens: [0]
						}
					]
				} satisfies EnrichedProtocolEmission
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
			upcomingUnlockUsd: 200
		})

		const ethena = result.rows[0]
		if (ethena === undefined) throw new Error('Expected Ethena token row')
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
			upcomingUnlockUsd: 200
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
				emissionsSupplyMetrics: {},
				tokenFilterMetadata: tokenFilterMetadata()
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

	it('reads exact CoinGecko filter memberships and flags stablecoins', () => {
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
				emissionsSupplyMetrics: {},
				tokenFilterMetadata: tokenFilterMetadata({
					tether: { chains: ['ethereum'], nativeChains: ['ethereum'], categories: ['stablecoins'] }
				})
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		}

		const flagged = buildTokensSourceRows({ ...base, tokens })
		expect(flagged.rows.map((row) => row.isStablecoin)).toEqual([true, false])
		expect(flagged.rows.map((row) => row.nativeChains)).toEqual([['ethereum'], []])
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
				emissionsSupplyMetrics: {},
				tokenFilterMetadata: tokenFilterMetadata()
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
				emissionsSupplyMetrics: {},
				tokenFilterMetadata: tokenFilterMetadata()
			} as unknown as MetadataCache,
			nowSec: 1_800_000_000
		})

		expect(result.rows.map((row) => row.href)).toEqual(['/token/DATA', '/token/Streamr'])
	})

	it('prioritizes explicit parent metrics and treats inactive children as zero activity', () => {
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
				adapterMetric('hyperliquid-spot-orderbook', 20, 'parent#hyperliquid'),
				adapterMetric('hyperliquid-options', null, 'parent#hyperliquid')
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
				emissionsSupplyMetrics: {},
				tokenFilterMetadata: tokenFilterMetadata()
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
			emissionsSupplyMetrics: {},
			tokenFilterMetadata: tokenFilterMetadata()
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
				emissionsSupplyMetrics: {},
				tokenFilterMetadata: tokenFilterMetadata()
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
