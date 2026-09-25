import { describe, expect, test } from 'vitest'
import type { Raise } from '~/containers/Raises/model'
import type { RawTreasuriesResponse } from '~/containers/Treasuries/api.types'
import type { IProtocolMetadata, ITokenListEntry } from '~/utils/metadata/types'
import {
	buildTokenOverviewData,
	buildTokenOverviewRawChartData,
	planTokenOverviewRequests,
	resolveCirculatingSupply,
	type TokenOverviewInput,
	type TokenOverviewSources
} from '../tokenOverview'

describe('resolveCirculatingSupply', () => {
	test('uses total supply as circulating for an override token whose CG circulating is 0', () => {
		expect(resolveCirculatingSupply('spark-savings-usdt', 0, 1_191_693_444)).toBe(1_191_693_444)
	})

	test('keeps CG circulating when the override token already reports a positive value', () => {
		expect(resolveCirculatingSupply('spark-savings-usdt', 500, 1000)).toBe(500)
	})

	test('leaves non-override tokens untouched', () => {
		expect(resolveCirculatingSupply('usd-coin', 0, 1000)).toBe(0)
		expect(resolveCirculatingSupply(null, 0, 1000)).toBe(0)
	})
})

const tokenEntryFixture: ITokenListEntry = {
	symbol: 'btc',
	current_price: 100,
	price_change_24h: 5,
	price_change_percentage_24h: 5,
	ath: 120,
	ath_date: '2024-01-01',
	atl: 1,
	atl_date: '2020-01-01',
	market_cap: 1000,
	fully_diluted_valuation: 1500,
	total_volume: 500,
	total_supply: 1000,
	circulating_supply: 21,
	max_supply: 21_000
}

const protocolMetadataFixture = {
	name: 'test-protocol',
	displayName: 'Test Protocol',
	emissions: true
} as IProtocolMetadata

const emissionsSupplyMetricsFixture = {
	'test-protocol': {
		name: 'Test Protocol',
		supplyMetrics: {
			maxSupply: 1000,
			adjustedSupply: 900,
			tbdAmount: 0,
			incentiveAmount: 0,
			nonIncentiveAmount: 900
		}
	},
	uniswap: {
		name: 'Uniswap',
		supplyMetrics: {
			maxSupply: 1000,
			adjustedSupply: 900,
			tbdAmount: 0,
			incentiveAmount: 0,
			nonIncentiveAmount: 900
		}
	},
	'pudgy-penguins': {
		name: 'Pudgy Penguins',
		supplyMetrics: {
			maxSupply: 1000,
			adjustedSupply: 900,
			tbdAmount: 0,
			incentiveAmount: 0,
			nonIncentiveAmount: 900
		}
	}
}

const cgChartFixture = {
	data: {
		prices: [
			[1_711_929_600_000, 100],
			[1_712_016_000_000, 110]
		],
		mcaps: [
			[1_711_929_600_000, 1000],
			[1_712_016_000_000, 1100]
		],
		volumes: [
			[1_711_929_600_000, 450],
			[1_712_016_000_000, 500]
		],
		coinData: {
			tickers: [
				{
					trust_score: 'green',
					converted_volume: { usd: 300 },
					market: { identifier: 'binance' }
				},
				{
					trust_score: 'green',
					converted_volume: { usd: 200 },
					market: { identifier: 'uniswap' }
				}
			]
		}
	}
}

const cgCoinDetailFixture = {
	id: 'bitcoin',
	symbol: 'btc',
	name: 'Bitcoin',
	image: {
		small: 'https://example.com/btc.png'
	},
	market_data: {
		current_price: { usd: 123 },
		market_cap: { usd: 2222 },
		fully_diluted_valuation: { usd: 3333 },
		total_volume: { usd: 4444 },
		circulating_supply: 21,
		total_supply: 1000,
		max_supply: 21_000,
		ath: { usd: 150 },
		ath_date: { usd: '2024-02-01' },
		atl: { usd: 1 },
		atl_date: { usd: '2020-01-01' }
	}
}

const llamaPrice = { price: 111, symbol: 'BTC', confidence: 0.99, timestamp: 1_712_016_000 }

const chainRaise: Raise = {
	date: 1_704_067_200,
	name: 'Chain Raise',
	round: 'Strategic',
	amountUsd: 25_000_000,
	chains: [],
	sector: '',
	category: '',
	categoryGroup: '',
	leadInvestors: ['Investor A'],
	otherInvestors: [],
	valuationUsd: null,
	source: 'Chain Announcement',
	defillamaId: 'chain#xion'
}

const protocolTreasury: RawTreasuriesResponse[number] = {
	id: 'parent#test-protocol-treasury',
	name: 'Treasury',
	logo: '',
	slug: '',
	tvl: 0,
	chainTvls: {},
	tokenBreakdowns: { majors: 10, stablecoins: 20, ownTokens: 30, others: 40 },
	mcap: null
}

function input(overrides: Partial<TokenOverviewInput> = {}): TokenOverviewInput {
	return {
		categories: [],
		record: { name: 'Bitcoin', symbol: 'BTC' },
		displayName: 'BTC',
		geckoId: 'bitcoin',
		tokenEntry: tokenEntryFixture,
		protocolMetadata: null,
		cgExchangeIdentifiers: ['binance'],
		emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
		source: { kind: 'network' },
		...overrides
	}
}

const NO_SOURCES: TokenOverviewSources = {
	cgChart: null,
	coinDetail: null,
	currentPriceViaLlama: null,
	raises: null,
	treasury: null
}

function sources(overrides: Partial<TokenOverviewSources> = {}): TokenOverviewSources {
	return { ...NO_SOURCES, cgChart: cgChartFixture as never, currentPriceViaLlama: llamaPrice, ...overrides }
}

describe('planTokenOverviewRequests', () => {
	test('reads a chain token raises by chain and never its treasury', () => {
		expect(
			planTokenOverviewRequests(
				input({ record: { name: 'Xion', symbol: 'XION', chainId: 'xion', protocolId: 'parent#test-protocol' } })
			)
		).toEqual({
			coinDetailGeckoId: null,
			llamaPriceGeckoId: 'bitcoin',
			raisesDefillamaId: 'chain#xion',
			treasuryId: null
		})
	})

	test('reads a protocol token raises and treasury by protocol', () => {
		expect(
			planTokenOverviewRequests(input({ record: { name: 'Test', symbol: 'TEST', protocolId: 'parent#test-protocol' } }))
		).toMatchObject({ raisesDefillamaId: 'parent#test-protocol', treasuryId: 'parent#test-protocol-treasury' })
	})

	test('asks CoinGecko for coin detail only when the tokenlist lacks supply or volume', () => {
		expect(planTokenOverviewRequests(input({ tokenEntry: { ...tokenEntryFixture, max_supply: null } }))).toMatchObject({
			coinDetailGeckoId: null,
			llamaPriceGeckoId: 'bitcoin'
		})
		expect(planTokenOverviewRequests(input({ geckoId: 'wrapped-steth', tokenEntry: null }))).toMatchObject({
			coinDetailGeckoId: 'wrapped-steth',
			llamaPriceGeckoId: 'wrapped-steth'
		})
	})
})

describe('buildTokenOverviewData', () => {
	test.each([true, false])('takes safe links from CoinGecko unless the record overrides them: %s', (hasOverrides) => {
		const cgChart = {
			data: {
				coinData: {
					links: {
						homepage: ['', 'javascript:alert(1)', 'https://provider.example'],
						twitter_screen_name: 'provider',
						telegram_channel_identifier: 'providerchat',
						chat_url: ['https://t.me/not-discord', 'https://discord.gg/provider']
					}
				}
			}
		}
		const result = buildTokenOverviewData(
			input({
				record: {
					name: 'Example',
					symbol: 'EX',
					...(hasOverrides ? { twitter: 'https://x.com/curated', telegram: 'https://t.me/curated' } : {})
				}
			}),
			sources({ cgChart: cgChart as never })
		)

		expect(result).toMatchObject({
			website: 'https://provider.example',
			twitter: hasOverrides ? 'https://x.com/curated' : 'https://x.com/provider',
			telegram: hasOverrides ? 'https://t.me/curated' : 'https://t.me/providerchat',
			discord: 'https://discord.gg/provider',
			rawChartData: {}
		})
	})

	test('keeps a token without CoinGecko data serializable with only its record links', () => {
		const result = buildTokenOverviewData(
			input({
				geckoId: null,
				tokenEntry: null,
				record: { name: 'Example', symbol: 'EX', token_nk: 'ethereum:0x123', website: 'https://project.example' }
			}),
			NO_SOURCES
		)

		expect(result).toMatchObject({ website: 'https://project.example', twitter: null, telegram: null, discord: null })
		expect(JSON.parse(JSON.stringify(result))).toEqual(result)
	})

	test('splits volume by CEX identifiers and values outstanding FDV at the emissions adjusted supply', () => {
		const result = buildTokenOverviewData(
			input({
				record: { name: 'Xion', symbol: 'XION', chainId: 'xion', protocolId: 'parent#test-protocol' },
				protocolMetadata: protocolMetadataFixture
			}),
			sources({ raises: [chainRaise], treasury: protocolTreasury })
		)

		expect(result.treasury).toBeNull()
		expect(result.raises).toEqual([
			{
				date: 1_704_067_200,
				round: 'Strategic',
				amountUsd: 25_000_000,
				investors: ['Investor A'],
				source: 'Chain Announcement'
			}
		])
		expect(result.marketData.volume24h).toEqual({ total: 500, cex: 300, dex: 200 })
		expect(result.outstandingFDV).toBe(99_900)
	})

	test('totals a protocol treasury', () => {
		const result = buildTokenOverviewData(
			input({ record: { name: 'Test', symbol: 'TEST', protocolId: 'parent#test-protocol' } }),
			sources({ treasury: protocolTreasury })
		)

		expect(result.treasury).toEqual({ majors: 10, stablecoins: 20, ownTokens: 30, others: 40, total: 100 })
	})

	test('charts FDV from max supply rather than total supply', () => {
		const result = buildTokenOverviewData(
			input({ tokenEntry: { ...tokenEntryFixture, max_supply: 21_000, total_supply: 1000 } }),
			sources()
		)

		expect(result.rawChartData.FDV).toEqual([
			[1_711_929_600_000, 2_100_000],
			[1_712_016_000_000, 2_310_000]
		])
	})

	test('can limit server-prefetched chart data to the default price series', () => {
		expect(buildTokenOverviewData(input({ prefetchedCharts: ['Token Price'] }), sources()).rawChartData).toEqual({
			'Token Price': [
				[1_711_929_600_000, 100],
				[1_712_016_000_000, 110]
			]
		})
	})

	test('prices a token without protocol mapping from the single-price snapshot', () => {
		const result = buildTokenOverviewData(input(), sources())

		expect(result.marketData).toMatchObject({ currentPrice: 111, mcap: 2331, fdv: 2_331_000 })
		expect(result.treasury).toBeNull()
		expect(result.raises).toBeNull()
		expect(result.outstandingFDV).toBeNull()
	})

	test('falls back to CoinGecko coin detail for supply and volume when the tokenlist has no entry', () => {
		const result = buildTokenOverviewData(
			input({ geckoId: 'wrapped-steth', tokenEntry: null }),
			sources({ coinDetail: cgCoinDetailFixture as never })
		)

		expect(result.marketData).toMatchObject({ currentPrice: 111, mcap: 2331, fdv: 2_331_000 })
		expect(result.marketData.volume24h.total).toBe(4444)
	})

	test.each([null, 0])('keeps rankings %s metrics instead of deriving them from history', (value) => {
		const result = buildTokenOverviewData(
			input({
				record: { name: 'Test', symbol: 'TEST', protocolId: 'parent#test-protocol' },
				protocolMetadata: protocolMetadataFixture,
				cgExchangeIdentifiers: [],
				currentMetrics: {
					currentPrice: value,
					percentChange24h: value,
					circulatingSupply: value,
					totalSupply: value,
					maxSupply: value,
					mcap: value,
					fdv: value,
					volume24h: value,
					outstandingFDV: value
				},
				source: { kind: 'prefetched', raises: null, treasury: null }
			}),
			sources({ currentPriceViaLlama: null })
		)

		expect(result.marketData).toMatchObject({
			currentPrice: value,
			circulatingSupply: value,
			totalSupply: value,
			maxSupply: value,
			mcap: value,
			fdv: value,
			volume24h: { total: value }
		})
		expect(result.outstandingFDV).toBe(value)
		expect(result.rawChartData['Token Price']).toEqual([
			[1_711_929_600_000, 100],
			[1_712_016_000_000, 110]
		])
		expect(result.raises).toBeNull()
		expect(result.treasury).toBeNull()
	})

	test('uses rankings metrics verbatim', () => {
		const result = buildTokenOverviewData(
			input({
				tokenEntry: null,
				currentMetrics: {
					currentPrice: 2,
					percentChange24h: -3,
					circulatingSupply: 500,
					totalSupply: 900,
					maxSupply: 1000,
					mcap: 1000,
					fdv: 2000,
					volume24h: 777,
					outstandingFDV: 1200
				}
			}),
			sources({ currentPriceViaLlama: null })
		)

		expect(result.marketData).toMatchObject({
			currentPrice: 2,
			percentChange24h: -3,
			circulatingSupply: 500,
			totalSupply: 900,
			maxSupply: 1000,
			mcap: 1000,
			fdv: 2000,
			volume24h: { total: 777 }
		})
		expect(result.outstandingFDV).toBe(1200)
	})

	test('keeps max supply unknown when the tokenlist has none', () => {
		const result = buildTokenOverviewData(input({ tokenEntry: { ...tokenEntryFixture, max_supply: null } }), sources())

		expect(result.marketData.maxSupply).toBeNull()
	})

	test('moves ATH and ATL to the current price snapshot when it breaks them', () => {
		const above = buildTokenOverviewData(
			input({ tokenEntry: { ...tokenEntryFixture, ath: 100, ath_date: '2021-05-09' } }),
			sources()
		)
		const below = buildTokenOverviewData(
			input({ tokenEntry: { ...tokenEntryFixture, atl: 1, atl_date: '2020-01-01' } }),
			sources({ currentPriceViaLlama: { ...llamaPrice, price: 0.5 } })
		)

		expect(above.marketData).toMatchObject({ ath: 111, athDate: '2024-04-02T00:00:00.000Z' })
		expect(below.marketData).toMatchObject({ currentPrice: 0.5, atl: 0.5, atlDate: '2024-04-02T00:00:00.000Z' })
	})
})

test('builds token volume chart data from the coingecko chart payload', () => {
	expect(buildTokenOverviewRawChartData({ chart: cgChartFixture as never, totalSupply: 1000 })['Token Volume']).toEqual(
		[
			[1_711_929_600_000, 450],
			[1_712_016_000_000, 500]
		]
	)
})
