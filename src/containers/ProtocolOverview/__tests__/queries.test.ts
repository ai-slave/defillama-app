import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFastJsonTimeoutMs } from '~/utils/async'
import type { IProtocolMetadata } from '~/utils/metadata/types'

const fetchAdapterProtocolChartData = vi.hoisted(() => vi.fn())
const fetchAdapterProtocolMetrics = vi.hoisted(() => vi.fn().mockResolvedValue({}))
const fetchProtocolOverviewMetrics = vi.hoisted(() =>
	vi.fn().mockResolvedValue({
		id: 'test-protocol',
		name: 'Test Protocol',
		symbol: 'TEST',
		url: 'https://example.com',
		description: null,
		logo: null,
		gecko_id: 'test-token',
		cmcId: null,
		category: 'Dexes',
		chain: 'Ethereum',
		module: 'test/index.js',
		chains: ['Ethereum'],
		currentChainTvls: {},
		mcap: null,
		raises: [],
		hacks: []
	})
)
const formatAdapterData = vi.hoisted(() =>
	vi.fn().mockResolvedValue({
		totalAllTime: 1,
		defaultChartView: 'daily'
	})
)
const fetchProtocolTvlChart = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const fetchOracleMetrics = vi.hoisted(() => vi.fn().mockResolvedValue(null))
const fetchOracleProtocolChart = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const fetchTreasuries = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const fetchJson = vi.hoisted(() => vi.fn().mockResolvedValue({ content_elements: [] }))
const getTokenMarketSummaryByGeckoId = vi.hoisted(() => vi.fn().mockResolvedValue(null))
const optionalPageData = vi.hoisted(() =>
	vi.fn(async (_label: string, run: () => Promise<unknown>, fallback: unknown) => {
		try {
			return await run()
		} catch {
			return fallback
		}
	})
)
const yieldsSnapshot = { readJson: vi.fn().mockRejectedValue(new Error('yields unavailable')) }

vi.mock('~/api', () => ({
	fetchBlockExplorers: vi.fn().mockResolvedValue([]),
	fetchLiquidityTokensDataset: vi.fn().mockResolvedValue([])
}))

vi.mock('~/api/coingecko', () => ({
	fetchCoinGeckoChartByIdWithCacheFallback: vi.fn().mockResolvedValue(null)
}))

vi.mock('~/containers/Bridges/api', () => ({
	fetchBridgeVolumeBySlug: vi.fn().mockResolvedValue({ dailyVolumes: [] })
}))

vi.mock('~/containers/Articles/api', () => ({
	listArticles: vi.fn().mockResolvedValue({ items: [] })
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterProtocolChartData,
	fetchAdapterProtocolMetrics
}))

vi.mock('~/containers/Incentives/queries', () => ({
	getProtocolIncentivesFromAggregatedEmissions: vi.fn().mockResolvedValue(null)
}))

vi.mock('~/containers/Oracles/api', () => ({
	fetchOracleMetrics,
	fetchOracleProtocolChart
}))

vi.mock('~/containers/ProtocolLists/api', () => ({
	fetchProtocols: vi.fn().mockResolvedValue({ protocols: [], chains: [], parentProtocols: [] })
}))

vi.mock('~/containers/Treasuries/api', () => ({
	fetchTreasuries
}))

vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return {
		...actual,
		fetchJson
	}
})

vi.mock('~/utils/optionalPageData', () => ({
	optionalPageData
}))

vi.mock('../api', () => ({
	fetchProtocolExpenses: vi.fn().mockResolvedValue([]),
	fetchProtocolOverviewMetrics,
	fetchProtocolTvlChart
}))

vi.mock('../formatAdapterData', () => ({
	formatAdapterData
}))

describe('getProtocolOverviewPageData', () => {
	afterEach(() => {
		fetchAdapterProtocolChartData.mockClear()
		fetchAdapterProtocolMetrics.mockResolvedValue({})
		fetchAdapterProtocolMetrics.mockClear()
		fetchProtocolTvlChart.mockResolvedValue([])
		fetchProtocolTvlChart.mockClear()
		fetchOracleMetrics.mockResolvedValue(null)
		fetchOracleMetrics.mockClear()
		fetchOracleProtocolChart.mockResolvedValue([])
		fetchOracleProtocolChart.mockClear()
		fetchTreasuries.mockResolvedValue([])
		fetchTreasuries.mockClear()
		fetchJson.mockResolvedValue({ content_elements: [] })
		fetchJson.mockClear()
		optionalPageData.mockClear()
		getTokenMarketSummaryByGeckoId.mockClear()
		fetchProtocolOverviewMetrics.mockClear()
		formatAdapterData.mockClear()
	})

	it('distinguishes absent TVL capability from successful empty and explicit-zero TVL responses', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')
		const request = {
			protocolId: 'test-protocol',
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		}

		const absent = await getProtocolOverviewPageData({
			...request,
			currentProtocolMetadata: { displayName: 'Test Protocol', tvl: false } satisfies IProtocolMetadata
		})
		expect(absent.currentTvlByChain).toBeNull()

		const empty = await getProtocolOverviewPageData({
			...request,
			currentProtocolMetadata: { displayName: 'Test Protocol', tvl: true } satisfies IProtocolMetadata
		})
		expect(empty.currentTvlByChain).toStrictEqual({})

		fetchProtocolOverviewMetrics.mockResolvedValueOnce({
			id: 'test-protocol',
			name: 'Test Protocol',
			symbol: 'TEST',
			url: 'https://example.com',
			description: null,
			logo: null,
			gecko_id: null,
			cmcId: null,
			category: 'Dexes',
			chain: 'Ethereum',
			module: 'test/index.js',
			chains: ['Ethereum'],
			currentChainTvls: { Ethereum: 0 },
			mcap: null,
			raises: [],
			hacks: []
		})
		const zero = await getProtocolOverviewPageData({
			...request,
			currentProtocolMetadata: { displayName: 'Test Protocol', tvl: true } satisfies IProtocolMetadata
		})
		expect(zero.currentTvlByChain).toStrictEqual({ Ethereum: 0 })
	})

	it('shows key metrics for period-only and zero adapter values but hides unavailable adapter data', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')
		const request = {
			protocolId: 'test-protocol',
			currentProtocolMetadata: { displayName: 'Test Protocol', fees: true } satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		}

		formatAdapterData.mockResolvedValueOnce({ total30d: 100, totalAllTime: null, defaultChartView: 'daily' })
		expect((await getProtocolOverviewPageData(request)).hasKeyMetrics).toBe(true)

		formatAdapterData.mockResolvedValueOnce({ total30d: 0, totalAllTime: null, defaultChartView: 'daily' })
		expect((await getProtocolOverviewPageData(request)).hasKeyMetrics).toBe(true)

		formatAdapterData.mockResolvedValueOnce({
			total24h: null,
			total7d: null,
			total30d: null,
			totalAllTime: null,
			annualized1y: null,
			defaultChartView: 'daily'
		})
		expect((await getProtocolOverviewPageData(request)).hasKeyMetrics).toBe(false)
	})

	it('retains a successful activity summary when every metric is explicit zero', async () => {
		fetchAdapterProtocolMetrics.mockResolvedValue({ total24h: 0 })
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				activeUsers: true,
				newUsers: true,
				txCount: true,
				gasUsed: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(data.users).toEqual({ activeUsers: 0, newUsers: 0, transactions: 0, gasUsed: 0, gasUsedUsd: 0 })
	})

	it('keeps native gas usage separate from its USD cost', async () => {
		fetchAdapterProtocolMetrics.mockImplementation(({ dataType }: { dataType?: string }) =>
			Promise.resolve({
				total24h: dataType === 'dailyGasUsed' ? 398_354 : dataType === 'dailyGasUsedUsd' ? 28_520 : null
			})
		)
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'polymarket',
			currentProtocolMetadata: {
				displayName: 'Polymarket',
				gasUsed: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(data.users).toEqual({
			activeUsers: null,
			newUsers: null,
			transactions: null,
			gasUsed: 398_354,
			gasUsedUsd: 28_520
		})
		expect(fetchAdapterProtocolMetrics).toHaveBeenCalledWith({
			protocol: 'Polymarket',
			adapterType: 'active-users',
			dataType: 'dailyGasUsed'
		})
		expect(fetchAdapterProtocolMetrics).toHaveBeenCalledWith({
			protocol: 'Polymarket',
			adapterType: 'active-users',
			dataType: 'dailyGasUsedUsd'
		})
	})

	it('default-toggles secondary charts without server-prefetching their series', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				fees: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(data.availableCharts).toContain('Fees')
		expect(data.defaultToggledCharts).toContain('Fees')
		expect(data.initialMultiSeriesChartData).toEqual({})
		expect(fetchAdapterProtocolChartData).not.toHaveBeenCalled()
	})

	it('default-toggles seeded primary chart data', async () => {
		fetchProtocolTvlChart.mockResolvedValueOnce([
			[1_700_000_000_000, 10],
			[1_700_086_400_000, 12]
		])
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				tvl: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(data.defaultToggledCharts).toEqual(['TVL'])
		expect(data.initialMultiSeriesChartData).toEqual({
			TVL: [
				[1_700_000_000_000, 10],
				[1_700_086_400_000, 12]
			]
		})
	})

	it('keeps configured TVS available while seeding only a nonempty exact producer array', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')

		const emptyData = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: { displayName: 'Chainlink', tvl: true } satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(emptyData.availableCharts).toContain('TVS')
		expect(emptyData.availableCharts).not.toContain('TVL')
		expect(emptyData.defaultToggledCharts).toContain('TVS')
		expect(emptyData.initialMultiSeriesChartData).toEqual({})

		fetchOracleProtocolChart.mockResolvedValueOnce([[1_700_000_000, 42]])
		const populatedData = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: { displayName: 'Chainlink', tvl: true } satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(populatedData.initialMultiSeriesChartData.TVS).toEqual([[1_700_000_000_000, 42]])
	})

	it('aggregates every consumer measurement for an oracle provider', async () => {
		fetchOracleMetrics.mockResolvedValueOnce({
			oracles: { Chainlink: ['Chainlink', 'Aave'] },
			chainsByOracle: { Chainlink: ['Ethereum', 'Arbitrum'] },
			protocolsByOracleChain: {
				Chainlink: { Ethereum: ['Chainlink', 'Aave'], Arbitrum: ['Aave'] }
			},
			oraclesTVS: {
				Chainlink: {
					Chainlink: { Ethereum: 0 },
					Aave: { Ethereum: 20, Arbitrum: 5 }
				}
			}
		})
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: { displayName: 'Chainlink', tvl: true } satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(data.oracleTvs).toEqual({ Ethereum: 20, Arbitrum: 5 })
	})

	it('keeps an oracle provider aggregate unavailable when a canonical member is unmeasured', async () => {
		fetchOracleMetrics.mockResolvedValueOnce({
			oracles: { Chainlink: ['Measured', 'Missing'] },
			chainsByOracle: { Chainlink: ['Ethereum'] },
			protocolsByOracleChain: { Chainlink: { Ethereum: ['Measured', 'Missing'] } },
			oraclesTVS: { Chainlink: { Measured: { Ethereum: 10 } } }
		})
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: { displayName: 'Chainlink', tvl: true } satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(data.oracleTvs).toBeNull()
	})

	it('preserves Oracle identity when its optional measurement request fails', async () => {
		fetchOracleMetrics.mockRejectedValueOnce(new Error('oracle metrics unavailable'))
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: { displayName: 'Chainlink', tvl: true } satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(data).toMatchObject({ isOracleProtocol: true, oracleTvs: null, hasKeyMetrics: true })
	})

	it('constructs token FAQ data from the shared token market summary', async () => {
		getTokenMarketSummaryByGeckoId.mockResolvedValueOnce({
			symbol: 'TEST',
			marketCapRank: 10,
			currentPrice: 2,
			priceChange7d: 2,
			priceChange30d: 3,
			marketCap: 1_000,
			fdv: 2_000,
			circulatingSupply: 500,
			totalSupply: 1_000,
			maxSupply: 1_000,
			ath: 5,
			athDate: '2026-01-01T00:00:00Z'
		})
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				gecko_id: 'test-token'
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			tokenDirectory: {
				test: {
					name: 'Test Token',
					symbol: 'TEST',
					token_nk: 'coingecko:test-token',
					route: '/token/TEST'
				}
			},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot,
			getTokenMarketSummary: getTokenMarketSummaryByGeckoId
		})

		expect(getTokenMarketSummaryByGeckoId).toHaveBeenCalledWith('test-token')
		expect(data.faqItems?.find((item) => item.id === 'token-valuation')?.answer).toContainEqual({
			text: 'TEST',
			href: '/token/TEST'
		})
	})

	it('does not load token FAQ data when FAQs are disabled', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')

		await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				gecko_id: 'test-token'
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot,
			includeFaq: false,
			getTokenMarketSummary: getTokenMarketSummaryByGeckoId
		})

		expect(getTokenMarketSummaryByGeckoId).not.toHaveBeenCalled()
	})

	it('builds protocol page data when the primary TVL chart seed fails', async () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		fetchProtocolTvlChart.mockRejectedValueOnce(new Error('chart timeout'))
		try {
			const { getProtocolOverviewPageData } = await import('../queries')

			const data = await getProtocolOverviewPageData({
				protocolId: 'test-protocol',
				currentProtocolMetadata: {
					displayName: 'Test Protocol',
					tvl: true
				} satisfies IProtocolMetadata,
				chainMetadata: {},
				tokenlist: {},
				cgExchangeIdentifiers: [],
				emissionsSupplyMetrics: {},
				protocolLlamaswapDataset: {},
				yieldsSnapshot
			})

			expect(fetchProtocolTvlChart).toHaveBeenCalledWith({ protocol: 'test-protocol', timeout: getFastJsonTimeoutMs() })
			expect(data.availableCharts).toContain('TVL')
			expect(data.defaultToggledCharts).toEqual(['TVL'])
			expect(data.initialMultiSeriesChartData).toEqual({})
		} finally {
			logSpy.mockRestore()
		}
	})

	it('builds protocol page data when optional treasury data fails', async () => {
		fetchTreasuries.mockRejectedValueOnce(new Error('treasury timeout'))
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				treasury: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(data.treasury).toBeNull()
		expect(optionalPageData).toHaveBeenCalledWith('protocol:test-protocol:treasury', expect.any(Function), null)
	})

	it('builds protocol page data when optional yields data fails', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				yields: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot
		})

		expect(data.yields).toBeNull()
		expect(optionalPageData).toHaveBeenCalledWith('protocol:test-protocol:yields', expect.any(Function), null)
	})

	it('builds protocol page data without optional Yields enrichment when no snapshot is available', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				yields: true,
				liquidity: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot: null
		})

		expect(data.yields).toBeNull()
		expect(data.tokenLiquidity).toBeNull()
		expect(JSON.parse(JSON.stringify(data))).toEqual(data)
		expect(optionalPageData).not.toHaveBeenCalledWith('protocol:test-protocol:yields', expect.any(Function), null)
		expect(optionalPageData).not.toHaveBeenCalledWith(
			'protocol:test-protocol:liquidity_yields_config',
			expect.any(Function),
			null
		)
	})

	it('fetches token income statements from the token endpoint', async () => {
		const response = {
			aggregates: {
				monthly: {
					'2026-01': {
						Earnings: { value: -5 },
						Revenue: { value: 0, 'by-label': { Fees: 0 } }
					}
				},
				quarterly: {},
				yearly: {}
			}
		}
		const original = structuredClone(response)
		fetchJson.mockResolvedValueOnce(response)
		const { getTokenIncomeStatement } = await import('../queries')

		const incomeStatement = await getTokenIncomeStatement({ token: 'HYPE' })

		expect(fetchJson).toHaveBeenCalledWith(expect.stringMatching(/\/metrics\/financial-statement\/token\/hype\?q=30$/))
		expect(incomeStatement?.data.monthly['2026-01']).toEqual({
			timestamp: Date.parse('2026-01'),
			values: {
				Earnings: { value: -5 },
				Revenue: { value: 0, 'by-label': { Fees: 0 } }
			}
		})
		expect(incomeStatement?.data.cumulative.cumulative).toEqual({
			timestamp: Date.parse('2026-01'),
			values: {
				Earnings: { value: -5 },
				Revenue: { value: 0, 'by-label': { Fees: 0 } }
			}
		})
		expect(response).toEqual(original)
	})

	it('calculates outstanding FDV from cached emissions supply metrics', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				emissions: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {
				'test-token': {
					symbol: 'test',
					current_price: 2,
					price_change_24h: null,
					price_change_percentage_24h: null,
					ath: null,
					ath_date: null,
					atl: null,
					atl_date: null,
					market_cap: null,
					fully_diluted_valuation: null,
					total_volume: null,
					total_supply: null,
					circulating_supply: null,
					max_supply: null
				}
			},
			cgExchangeIdentifiers: [],
			yieldsSnapshot,
			emissionsSupplyMetrics: {
				'test-protocol': {
					name: 'Test Protocol',
					supplyMetrics: {
						maxSupply: 1000,
						adjustedSupply: 500,
						tbdAmount: 0,
						incentiveAmount: 0,
						nonIncentiveAmount: 500
					}
				}
			},
			protocolLlamaswapDataset: {}
		})

		expect(data.outstandingFDV).toBe(1000)
	})

	it.each([
		{ adjustedSupply: 0, currentPrice: 2 },
		{ adjustedSupply: 500, currentPrice: 0 }
	])('preserves zero at the outstanding FDV boundary', async ({ adjustedSupply, currentPrice }) => {
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: { displayName: 'Test Protocol', emissions: true } satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {
				'test-token': {
					symbol: 'test',
					current_price: currentPrice,
					price_change_24h: null,
					price_change_percentage_24h: null,
					ath: null,
					ath_date: null,
					atl: null,
					atl_date: null,
					market_cap: null,
					fully_diluted_valuation: null,
					total_volume: null,
					total_supply: null,
					circulating_supply: null,
					max_supply: null
				}
			},
			cgExchangeIdentifiers: [],
			yieldsSnapshot,
			emissionsSupplyMetrics: {
				'test-protocol': {
					name: 'Test Protocol',
					supplyMetrics: {
						maxSupply: 1000,
						adjustedSupply,
						tbdAmount: 0,
						incentiveAmount: 0,
						nonIncentiveAmount: adjustedSupply
					}
				}
			},
			protocolLlamaswapDataset: {}
		})

		expect(data.outstandingFDV).toBe(0)
	})
})
