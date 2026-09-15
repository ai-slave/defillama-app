import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Raise } from '~/containers/Raises/model'
import type { RawTreasuriesResponse } from '~/containers/Treasuries/api.types'
import type { IProtocolMetadata, ITokenListEntry } from '~/utils/metadata/types'
import type { TokenDirectoryRecord } from '~/utils/tokenDirectory'
import {
	buildTokenOverviewRawChartData,
	resolveCirculatingSupply,
	type TokenOverviewData,
	getTokenOverviewData
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
import { TokenOverviewSection, TokenPageHero } from '../TokenOverviewSection'

function getRecordKeys<T extends Record<string, unknown>>(record: T): Array<string> {
	const keys: Array<string> = []

	for (const key in record) {
		keys.push(key)
	}

	return keys
}

const mocks = vi.hoisted(() => ({
	fetchCoinGeckoChartByIdWithCacheFallback: vi.fn(),
	fetchCoinGeckoCoinById: vi.fn(),
	fetchCoinPriceByCoinGeckoIdViaLlamaPrices: vi.fn(),
	fetchRaisesByDefillamaId: vi.fn(),
	fetchTreasuryById: vi.fn(),
	useFetchTokenOverviewChartData: vi.fn()
}))

let routerState = {
	pathname: '/token/[token]',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}
let lastProtocolChartProps: any = null

type TokenOverviewSectionProps = Parameters<typeof TokenOverviewSection>[0]

function renderTokenOverviewSection(
	props: Omit<TokenOverviewSectionProps, 'issuer' | 'chain'> &
		Partial<Pick<TokenOverviewSectionProps, 'issuer' | 'chain'>>
) {
	const client = new QueryClient()
	return renderToStaticMarkup(
		<QueryClientProvider client={client}>
			<TokenOverviewSection issuer={null} chain={null} {...props} />
		</QueryClientProvider>
	)
}

const textFromMarkup = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

vi.mock('next/router', () => ({
	useRouter: () => routerState
}))

vi.mock('~/api/coingecko', () => ({
	fetchCoinGeckoChartByIdWithCacheFallback: mocks.fetchCoinGeckoChartByIdWithCacheFallback,
	fetchCoinGeckoCoinById: mocks.fetchCoinGeckoCoinById
}))

vi.mock('~/api/pricing', () => ({
	fetchCoinPriceByCoinGeckoIdViaLlamaPrices: mocks.fetchCoinPriceByCoinGeckoIdViaLlamaPrices
}))

vi.mock('~/containers/Raises/api', () => ({
	fetchRaisesByDefillamaId: mocks.fetchRaisesByDefillamaId
}))

vi.mock('~/containers/Treasuries/api', () => ({
	fetchTreasuryById: mocks.fetchTreasuryById
}))

vi.mock('../useFetchTokenOverviewChartData', () => ({
	useFetchTokenOverviewChartData: mocks.useFetchTokenOverviewChartData
}))

vi.mock('~/containers/ProtocolOverview/Chart', () => ({
	default: (props: any) => {
		lastProtocolChartProps = props
		return <div>protocol-chart</div>
	}
}))

vi.mock('~/containers/Subscription/SignInModal', () => ({
	SignInModal: () => <div>sign-in-modal</div>
}))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		authorizedFetch: vi.fn(),
		hasActiveSubscription: true,
		isAuthenticated: true,
		loaders: { userLoading: false }
	})
}))

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

const overviewFixture: TokenOverviewData = {
	categories: [],
	website: null,
	twitter: null,
	telegram: null,
	discord: null,
	name: 'Bitcoin',
	displayName: 'BTC',
	symbol: 'BTC',
	marketData: {
		currentPrice: 100,
		percentChange24h: 5,
		ath: 120,
		athDate: '2024-01-01',
		atl: 1,
		atlDate: '2020-01-01',
		circulatingSupply: 21,
		totalSupply: 1000,
		maxSupply: 21_000,
		mcap: 1000,
		fdv: 1500,
		volume24h: {
			total: 500,
			cex: 300,
			dex: 200
		}
	},
	treasury: {
		majors: 10,
		stablecoins: 20,
		ownTokens: 30,
		others: 40,
		total: 100
	},
	raises: [
		{
			date: 1_704_067_200,
			round: 'Series A',
			amountUsd: 50_000_000,
			investors: ['Investor A']
		}
	],
	outstandingFDV: 900,
	rawChartData: {
		'Token Price': [
			[1_711_929_600_000, 100],
			[1_712_016_000_000, 110]
		]
	}
}

beforeEach(() => {
	vi.clearAllMocks()
	routerState = {
		pathname: '/token/[token]',
		query: {},
		push: vi.fn()
	}
	lastProtocolChartProps = null
	mocks.fetchCoinGeckoChartByIdWithCacheFallback.mockResolvedValue(cgChartFixture)
	mocks.fetchCoinGeckoCoinById.mockResolvedValue(cgCoinDetailFixture)
	mocks.fetchCoinPriceByCoinGeckoIdViaLlamaPrices.mockResolvedValue({
		price: 111,
		symbol: 'BTC',
		confidence: 0.99,
		timestamp: 1_712_016_000
	})
	mocks.fetchRaisesByDefillamaId.mockImplementation(
		async (defillamaId: string) =>
			[
				{
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
				},
				{
					date: 1_706_745_600,
					name: 'Protocol Raise',
					round: 'Series A',
					amountUsd: 50_000_000,
					chains: [],
					sector: '',
					category: '',
					categoryGroup: '',
					leadInvestors: ['Investor B'],
					otherInvestors: [],
					valuationUsd: null,
					source: '',
					defillamaId: 'parent#test-protocol'
				}
			].filter((raise) => raise.defillamaId === defillamaId) satisfies Array<Raise>
	)
	mocks.fetchTreasuryById.mockResolvedValue({
		id: 'parent#test-protocol-treasury',
		name: 'Treasury',
		logo: '',
		slug: '',
		tvl: 0,
		chainTvls: {},
		tokenBreakdowns: {
			majors: 10,
			stablecoins: 20,
			ownTokens: 30,
			others: 40
		},
		mcap: null
	} satisfies RawTreasuriesResponse[number])
	mocks.useFetchTokenOverviewChartData.mockImplementation(({ overview }: { overview: TokenOverviewData }) => ({
		rawChartData: overview.rawChartData,
		isLoading: false
	}))
})

describe('tokenOverview helpers', () => {
	test.each([true, false])('renders links without chart history, with social overrides: %s', async (hasOverrides) => {
		mocks.fetchCoinGeckoChartByIdWithCacheFallback.mockResolvedValue({
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
		})
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Example',
				symbol: 'EX',
				...(hasOverrides ? { twitter: 'https://x.com/curated', telegram: 'https://t.me/curated' } : {})
			},
			displayName: 'EX',
			geckoId: 'example',
			tokenEntry: tokenEntryFixture,
			protocolMetadata: null,
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			source: { kind: 'prefetched', raises: null, treasury: null }
		})
		expect(result).toMatchObject({
			website: 'https://provider.example',
			twitter: hasOverrides ? 'https://x.com/curated' : 'https://x.com/provider',
			telegram: hasOverrides ? 'https://t.me/curated' : 'https://t.me/providerchat',
			discord: 'https://discord.gg/provider',
			rawChartData: {}
		})
		const html = renderTokenOverviewSection({ overview: result, geckoId: 'example' })
		for (const url of [result.website, result.twitter, result.telegram, result.discord]) {
			expect(html).toContain(`href="${url}"`)
		}
		expect(html).not.toContain('javascript:')
		expect(html).toContain('rel="noopener noreferrer"')
	})

	test.each([true, false])(
		'keeps links serializable without a CoinGecko ID, with overrides: %s',
		async (hasOverrides) => {
			const overrides = hasOverrides
				? { website: 'https://project.example', discord: 'https://project.example/discord' }
				: {}
			const result = await getTokenOverviewData({
				categories: [],
				record: { name: 'Example', symbol: 'EX', token_nk: 'ethereum:0x123', ...overrides },
				displayName: 'EX',
				geckoId: null,
				tokenEntry: null,
				protocolMetadata: null,
				cgExchangeIdentifiers: [],
				emissionsSupplyMetrics: {},
				source: { kind: 'prefetched', raises: null, treasury: null }
			})
			expect(result).toMatchObject({
				website: hasOverrides ? 'https://project.example' : null,
				discord: hasOverrides ? 'https://project.example/discord' : null,
				twitter: null,
				telegram: null
			})
			expect(JSON.parse(JSON.stringify(result))).toEqual(result)
			expect(mocks.fetchCoinGeckoChartByIdWithCacheFallback).not.toHaveBeenCalled()
			const html = renderTokenOverviewSection({ overview: result, geckoId: null })
			expect(html.includes('href="https://project.example"')).toBe(hasOverrides)
			expect(html).not.toContain('>X/Twitter<')
			expect(html).not.toContain('>Telegram<')
		}
	)

	test('uses chain-based raises and skips treasury when chainId exists', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Xion',
				symbol: 'XION',
				chainId: 'xion',
				protocolId: 'parent#test-protocol'
			} satisfies TokenDirectoryRecord,
			displayName: 'XION',
			geckoId: 'bitcoin',
			tokenEntry: tokenEntryFixture,
			protocolMetadata: protocolMetadataFixture,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.treasury).toBeNull()
		expect(result.raises).toEqual([
			expect.objectContaining({
				round: 'Strategic',
				amountUsd: 25_000_000,
				source: 'Chain Announcement'
			})
		])
		expect(result.marketData.volume24h).toEqual({
			total: 500,
			cex: 300,
			dex: 200
		})
		expect(result.outstandingFDV).toBe(99_900)
		expect(mocks.fetchTreasuryById).not.toHaveBeenCalled()
	})

	test('fetches treasury by protocol when protocolId exists without chainId', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Test Protocol',
				symbol: 'TEST',
				protocolId: 'parent#test-protocol'
			} satisfies TokenDirectoryRecord,
			displayName: 'TEST',
			geckoId: 'bitcoin',
			tokenEntry: tokenEntryFixture,
			protocolMetadata: protocolMetadataFixture,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.treasury).toEqual({
			majors: 10,
			stablecoins: 20,
			ownTokens: 30,
			others: 40,
			total: 100
		})
		expect(result.raises).toEqual([
			expect.objectContaining({
				round: 'Series A',
				amountUsd: 50_000_000
			})
		])
		expect(mocks.fetchTreasuryById).toHaveBeenCalledOnce()
	})

	test('uses prefetched raises and treasury without fetching them again', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Test Protocol',
				symbol: 'TEST',
				protocolId: 'parent#test-protocol'
			} satisfies TokenDirectoryRecord,
			displayName: 'TEST',
			geckoId: 'bitcoin',
			tokenEntry: tokenEntryFixture,
			protocolMetadata: protocolMetadataFixture,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: {
				kind: 'prefetched',
				raises: [
					{
						date: 1_706_745_600,
						name: 'Protocol Raise',
						round: 'Series A',
						amountUsd: 50_000_000,
						chains: [],
						sector: '',
						category: '',
						categoryGroup: '',
						source: 'Protocol Blog',
						leadInvestors: ['Investor B'],
						otherInvestors: [],
						valuationUsd: null,
						defillamaId: 'parent#test-protocol'
					}
				],
				treasury: {
					id: 'parent#test-protocol-treasury',
					name: 'Treasury',
					logo: '',
					slug: '',
					tvl: 0,
					chainTvls: {},
					tokenBreakdowns: {
						majors: 10,
						stablecoins: 20,
						ownTokens: 30,
						others: 40
					},
					mcap: null
				}
			}
		})

		expect(result.treasury?.total).toBe(100)
		expect(result.raises?.[0]?.round).toBe('Series A')
		expect(mocks.fetchRaisesByDefillamaId).not.toHaveBeenCalled()
		expect(mocks.fetchTreasuryById).not.toHaveBeenCalled()
	})

	test('prefers the protocol slug metadata and max supply when building overview data', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Test Protocol',
				symbol: 'TEST',
				protocolId: 'parent#uniswap'
			} satisfies TokenDirectoryRecord,
			displayName: 'TEST',
			geckoId: 'bitcoin',
			tokenEntry: {
				...tokenEntryFixture,
				max_supply: 21_000,
				total_supply: 1000
			},
			protocolMetadata: {
				...protocolMetadataFixture,
				name: 'uniswap-v3',
				displayName: 'Uniswap'
			} as IProtocolMetadata,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.rawChartData.FDV).toEqual([
			[1_711_929_600_000, 2_100_000],
			[1_712_016_000_000, 2_310_000]
		])
	})

	test('resolves numeric protocol IDs through metadata before reading emissions supply metrics', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Pudgy Penguins',
				symbol: 'PENGU',
				protocolId: '6146'
			} satisfies TokenDirectoryRecord,
			displayName: 'PENGU',
			geckoId: 'bitcoin',
			tokenEntry: tokenEntryFixture,
			protocolMetadata: {
				displayName: 'Pudgy Penguins',
				emissions: true
			} as IProtocolMetadata,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.outstandingFDV).toBe(99_900)
	})

	test('skips emissions adjusted supply when the resolved slug is absent from the cached emissions list', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Missing Protocol',
				symbol: 'MISS',
				protocolId: '9876'
			} satisfies TokenDirectoryRecord,
			displayName: 'MISS',
			geckoId: 'bitcoin',
			tokenEntry: tokenEntryFixture,
			protocolMetadata: {
				displayName: 'Missing Protocol',
				emissions: true
			} as IProtocolMetadata,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.outstandingFDV).toBeNull()
	})

	test('does not resolve numeric protocol IDs without metadata', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Unknown Protocol',
				symbol: 'MISS',
				protocolId: '9876'
			} satisfies TokenDirectoryRecord,
			displayName: 'MISS',
			geckoId: 'bitcoin',
			tokenEntry: tokenEntryFixture,
			protocolMetadata: null,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.outstandingFDV).toBeNull()
	})

	test('can limit server-prefetched chart data to only the default price series', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Bitcoin',
				symbol: 'BTC'
			} satisfies TokenDirectoryRecord,
			displayName: 'BTC',
			geckoId: 'bitcoin',
			tokenEntry: tokenEntryFixture,
			protocolMetadata: null,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' },
			prefetchedCharts: ['Token Price']
		})

		expect(result.rawChartData).toEqual({
			'Token Price': [
				[1_711_929_600_000, 100],
				[1_712_016_000_000, 110]
			]
		})
		expect(mocks.fetchCoinGeckoChartByIdWithCacheFallback).toHaveBeenCalledWith('bitcoin', {
			timeframe: '24H',
			includeCoinData: true
		})
	})

	test('returns token-only data when no protocol mapping is available', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Bitcoin',
				symbol: 'BTC',
				logo: 'https://metadata.example.com/btc.png'
			} satisfies TokenDirectoryRecord,
			displayName: 'BTC',
			geckoId: 'bitcoin',
			tokenEntry: tokenEntryFixture,
			protocolMetadata: null,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.marketData.currentPrice).toBe(111)
		expect(result.marketData.mcap).toBe(2331)
		expect(result.marketData.fdv).toBe(2_331_000)
		expect(result.treasury).toBeNull()
		expect(result.raises).toBeNull()
		expect(result.outstandingFDV).toBeNull()
		expect(mocks.fetchCoinGeckoCoinById).not.toHaveBeenCalled()
		expect(mocks.fetchCoinPriceByCoinGeckoIdViaLlamaPrices).toHaveBeenCalledWith('bitcoin')
	})

	test.each([null, 0])(
		'preserves current %s metrics against historical prices and handles absent prefetched funding',
		async (value) => {
			const currentMetrics = {
				currentPrice: value,
				percentChange24h: value,
				circulatingSupply: value,
				totalSupply: value,
				maxSupply: value,
				mcap: value,
				fdv: value,
				volume24h: value,
				outstandingFDV: value
			}
			const result = await getTokenOverviewData({
				categories: [],
				record: { name: 'Test Protocol', symbol: 'TEST', protocolId: 'parent#test-protocol' },
				displayName: 'TEST',
				geckoId: 'bitcoin',
				tokenEntry: tokenEntryFixture,
				protocolMetadata: protocolMetadataFixture,
				cgExchangeIdentifiers: [],
				emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
				currentMetrics,
				source: { kind: 'prefetched', raises: null, treasury: null }
			})
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
			expect(result.rawChartData['Token Price']?.length).toBeGreaterThan(0)
			expect(result.raises).toBeNull()
			expect(result.treasury).toBeNull()
			expect(mocks.fetchRaisesByDefillamaId).not.toHaveBeenCalled()
			expect(mocks.fetchTreasuryById).not.toHaveBeenCalled()
			expect(mocks.fetchCoinPriceByCoinGeckoIdViaLlamaPrices).not.toHaveBeenCalled()
			expect(mocks.fetchCoinGeckoCoinById).not.toHaveBeenCalled()
			const html = renderTokenOverviewSection({ overview: result, geckoId: 'bitcoin' })
			expect(html).not.toContain('Total Raised')
			expect(html).not.toContain('Treasury')
		}
	)

	test('uses the rankings metrics verbatim without calling a second current-price source', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Bitcoin',
				symbol: 'BTC'
			} satisfies TokenDirectoryRecord,
			displayName: 'BTC',
			geckoId: 'bitcoin',
			tokenEntry: null,
			protocolMetadata: null,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
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
			},
			source: { kind: 'network' }
		})

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
		expect(mocks.fetchCoinGeckoCoinById).not.toHaveBeenCalled()
		expect(mocks.fetchCoinPriceByCoinGeckoIdViaLlamaPrices).not.toHaveBeenCalled()
	})

	test('does not fetch CoinGecko coin detail when only max supply is missing from tokenlist data', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Ethereum',
				symbol: 'ETH'
			} satisfies TokenDirectoryRecord,
			displayName: 'ETH',
			geckoId: 'ethereum',
			tokenEntry: {
				...tokenEntryFixture,
				max_supply: null
			},
			protocolMetadata: null,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.marketData.currentPrice).toBe(111)
		expect(result.marketData.maxSupply).toBeNull()
		expect(mocks.fetchCoinGeckoCoinById).not.toHaveBeenCalled()
		expect(mocks.fetchCoinPriceByCoinGeckoIdViaLlamaPrices).toHaveBeenCalledWith('ethereum')
	})

	test('uses the current price snapshot as ATH when it exceeds the stored all-time high', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Bitcoin',
				symbol: 'BTC'
			} satisfies TokenDirectoryRecord,
			displayName: 'BTC',
			geckoId: 'bitcoin',
			tokenEntry: {
				...tokenEntryFixture,
				ath: 100,
				ath_date: '2021-05-09'
			},
			protocolMetadata: null,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.marketData.currentPrice).toBe(111)
		expect(result.marketData.ath).toBe(111)
		expect(result.marketData.athDate).toBe('2024-04-02T00:00:00.000Z')
	})

	test('uses the current price snapshot as ATL when it is below the stored all-time low', async () => {
		mocks.fetchCoinPriceByCoinGeckoIdViaLlamaPrices.mockResolvedValueOnce({
			price: 0.5,
			symbol: 'BTC',
			confidence: 0.99,
			timestamp: 1_712_016_000
		})

		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Bitcoin',
				symbol: 'BTC'
			} satisfies TokenDirectoryRecord,
			displayName: 'BTC',
			geckoId: 'bitcoin',
			tokenEntry: {
				...tokenEntryFixture,
				atl: 1,
				atl_date: '2020-01-01'
			},
			protocolMetadata: null,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.marketData.currentPrice).toBe(0.5)
		expect(result.marketData.atl).toBe(0.5)
		expect(result.marketData.atlDate).toBe('2024-04-02T00:00:00.000Z')
	})

	test('uses the single-price endpoint to derive price, market cap, and FDV', async () => {
		const result = await getTokenOverviewData({
			categories: [],
			record: {
				name: 'Wrapped stETH',
				symbol: 'WSTETH'
			} satisfies TokenDirectoryRecord,
			displayName: 'WSTETH',
			geckoId: 'wrapped-steth',
			tokenEntry: null,
			protocolMetadata: null,
			cgExchangeIdentifiers: ['binance'],
			emissionsSupplyMetrics: emissionsSupplyMetricsFixture,
			source: { kind: 'network' }
		})

		expect(result.marketData.currentPrice).toBe(111)
		expect(result.marketData.mcap).toBe(2331)
		expect(result.marketData.fdv).toBe(2_331_000)
		expect(result.marketData.volume24h.total).toBe(4444)
		expect(mocks.fetchCoinGeckoCoinById).toHaveBeenCalledWith('wrapped-steth', {
			localization: false,
			tickers: false,
			marketData: true,
			communityData: false,
			developerData: false,
			sparkline: false,
			includeCategoriesDetails: false
		})
		expect(mocks.fetchCoinPriceByCoinGeckoIdViaLlamaPrices).toHaveBeenCalledWith('wrapped-steth')
		expect(result.rawChartData['Token Price']).toEqual([
			[1_711_929_600_000, 100],
			[1_712_016_000_000, 110]
		])
	})

	test('builds token volume chart data from the coingecko chart payload', () => {
		const rawChartData = buildTokenOverviewRawChartData({
			chart: cgChartFixture as any,
			totalSupply: 1000
		})

		expect(rawChartData['Token Volume']).toEqual([
			[1_711_929_600_000, 450],
			[1_712_016_000_000, 500]
		])
	})
})

describe('TokenPageHero component', () => {
	test('renders the token identity and price breakdown in the page hero', () => {
		const html = renderToStaticMarkup(
			<TokenPageHero overview={overviewFixture} logo="https://metadata.example.com/btc.png" />
		)

		expect(html).toContain('Bitcoin')
		expect(html).toContain('(BTC)')
		expect(html).toContain('Token Price')
		expect(html).toContain('All Time High')
		expect(html).toContain('All Time Low')
	})
})

describe('TokenOverviewSection component', () => {
	test('renders previously loaded page props without categories', () => {
		const { categories: _categories, ...previousOverview } = overviewFixture
		const overview = previousOverview as TokenOverviewData
		const bare = renderTokenOverviewSection({ overview, geckoId: 'bitcoin' })
		expect(bare).toContain('Bitcoin')
		expect(bare).not.toContain('Token Information')

		const withWebsite = renderTokenOverviewSection({
			overview: { ...overview, website: 'https://project.example' },
			geckoId: 'bitcoin'
		})
		expect(withWebsite).toContain('href="https://project.example"')
		expect(withWebsite).not.toContain('/tokens?categories=')
	})

	test('renders token information links in a card below the hero, not in the hero', () => {
		const categories = [
			{ id: 'real-world-assets-rwa', label: 'RWA' },
			{ id: 'stablecoins', label: 'Stablecoins' }
		]
		const overview = { ...overviewFixture, categories, website: 'https://project.example' }
		const html = renderTokenOverviewSection({
			geckoId: 'bitcoin',
			overview,
			issuer: { name: 'Circle', slug: 'circle' },
			chain: { name: 'Ethereum', slug: 'ethereum' }
		})
		expect(html).toContain('Token Information')
		expect(html).toContain('href="/tokens?categories=real-world-assets-rwa"')
		expect(html).toContain('href="/tokens?categories=stablecoins"')
		expect(html).toContain('Categories:')
		expect(html).toContain('href="/protocol/circle"')
		expect(html).toContain('href="/chain/ethereum"')
		expect(html).toContain('>Website<')

		const hero = renderToStaticMarkup(<TokenPageHero overview={overview} />)
		expect(hero).not.toContain('/tokens?categories=')
		expect(hero).not.toContain('Issued by')

		const bare = renderTokenOverviewSection({ geckoId: 'bitcoin', overview: overviewFixture })
		expect(bare).not.toContain('Token Information')
	})
	test('keeps zero funding and treasury visible alongside an undisclosed round', () => {
		const html = renderTokenOverviewSection({
			geckoId: 'bitcoin',
			overview: {
				...overviewFixture,
				treasury: { ownTokens: 0, stablecoins: 0, majors: 0, others: 0, total: 0 },
				raises: [
					{ date: 1, round: 'Seed', amountUsd: 0, investors: [] },
					{ date: 2, round: 'Private', amountUsd: null, investors: [] }
				]
			}
		})
		expect(html).toContain('Total Raised')
		expect(html).toContain('Treasury')
		expect(html).toContain('$0')
		expect(html).toContain('Undisclosed')
	})
	test('keeps the known subtotal visible when another round is undisclosed', () => {
		const html = renderTokenOverviewSection({
			geckoId: 'bitcoin',
			overview: {
				...overviewFixture,
				raises: [
					{ date: 1, round: 'Seed', amountUsd: 2_500_000, investors: [] },
					{ date: 2, round: 'Private', amountUsd: null, investors: [] },
					{ date: 3, round: 'Series A', amountUsd: 14_000_000, investors: [] }
				]
			}
		})
		expect(html).toContain('$16.5m')
		expect(html).toContain('Undisclosed')
	})
	test('renders the overview chart shell and key metrics without duplicating the page hero', () => {
		const html = renderTokenOverviewSection({
			overview: overviewFixture,
			geckoId: 'bitcoin',
			logo: 'https://metadata.example.com/btc.png'
		})

		expect(html).toContain('Bitcoin')
		expect(html).toContain('(BTC)')
		expect((html.match(/\(BTC\)/g) || []).length).toBe(1)
		expect(html).toContain('Overview')
		expect(html).toContain('Key Metrics')
		expect(html).toContain('Add Metrics')
		expect(html).toContain('$BTC Price')
		expect(html).toContain('24H')
		expect(html).toContain('7D')
		expect(html).toContain('CEX Volume')
		expect(html).toContain('DEX Volume')
		expect(html).toContain('Total Raised')
		expect(html.indexOf('Market Cap')).toBeLessThan(html.indexOf('Circ. Supply'))
		expect(html.indexOf('Fully Diluted Valuation')).toBeLessThan(html.indexOf('Circ. Supply'))
	})

	test('shows undisclosed raises without falling back to $0 and exposes chart controls to assistive tech', () => {
		const html = renderTokenOverviewSection({
			overview: {
				...overviewFixture,
				raises: [
					{
						date: 1_704_067_200,
						round: 'Series A',
						amountUsd: null,
						investors: ['Investor A']
					}
				]
			},
			geckoId: 'bitcoin',
			logo: 'https://metadata.example.com/btc.png'
		})
		const text = textFromMarkup(html)

		expect(text).toContain('Undisclosed')
		expect(text).not.toContain('$0')
		expect(html).toContain('aria-label="Remove $BTC Price"')
	})

	test('waits for the client before rendering bookmarked non-prefetched charts', () => {
		routerState.query = {
			timeframe: '7D',
			chart: 'Token Volume'
		}

		const html = renderTokenOverviewSection({
			overview: overviewFixture,
			geckoId: 'bitcoin',
			logo: 'https://metadata.example.com/btc.png'
		})

		expect(html).not.toContain('fetching $BTC Volume')
		expect(html).not.toContain('Chart unavailable for this token right now.')
	})

	test('renders client-fetched non-price chart combinations when the chart hook returns them', () => {
		routerState.query = {
			timeframe: '7D',
			chart: 'Token Volume'
		}
		mocks.useFetchTokenOverviewChartData.mockReturnValue({
			rawChartData: {
				...overviewFixture.rawChartData,
				'Token Volume': [
					[1_711_929_600_000, 450],
					[1_712_016_000_000, 500]
				]
			},
			isLoading: false
		})

		renderTokenOverviewSection({
			overview: overviewFixture,
			geckoId: 'bitcoin',
			logo: 'https://metadata.example.com/btc.png'
		})

		expect(lastProtocolChartProps.groupBy).toBe('daily')
		expect(getRecordKeys(lastProtocolChartProps.chartData)).toEqual(['Token Volume'])
		expect(mocks.useFetchTokenOverviewChartData).toHaveBeenLastCalledWith(expect.objectContaining({ timeframe: '7D' }))
	})

	test('shows a graceful fallback when market chart data is unavailable', () => {
		const html = renderTokenOverviewSection({
			overview: {
				...overviewFixture,
				rawChartData: {}
			},
			geckoId: null,
			logo: 'https://metadata.example.com/btc.png'
		})

		expect(html).toContain('Chart unavailable without CoinGecko market data.')
	})
})
