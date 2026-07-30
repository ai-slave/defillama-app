import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFastJsonTimeoutMs } from '~/utils/async'

const fetchAdapterProtocolChartData = vi.hoisted(() => vi.fn())
const fetchProtocolTvlChart = vi.hoisted(() => vi.fn().mockResolvedValue([]))
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
	fetchAdapterProtocolMetrics: vi.fn().mockResolvedValue({})
}))

vi.mock('~/containers/Incentives/queries', () => ({
	getProtocolIncentivesFromAggregatedEmissions: vi.fn().mockResolvedValue(null)
}))

vi.mock('~/containers/Oracles/api', () => ({
	fetchOracleMetrics: vi.fn().mockResolvedValue(null),
	fetchOracleProtocolChart: vi.fn().mockResolvedValue(null)
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
	fetchProtocolOverviewMetrics: vi.fn().mockResolvedValue({
		id: 'test-protocol',
		name: 'Test Protocol',
		gecko_id: 'test-token',
		category: 'Dexes',
		chains: ['Ethereum'],
		currentChainTvls: {}
	}),
	fetchProtocolTvlChart
}))

vi.mock('../formatAdapterData', () => ({
	formatAdapterData: vi.fn().mockResolvedValue({
		totalAllTime: 1,
		defaultChartView: 'daily'
	})
}))

describe('getProtocolOverviewPageData', () => {
	afterEach(() => {
		fetchAdapterProtocolChartData.mockClear()
		fetchProtocolTvlChart.mockResolvedValue([])
		fetchProtocolTvlChart.mockClear()
		fetchTreasuries.mockResolvedValue([])
		fetchTreasuries.mockClear()
		fetchJson.mockResolvedValue({ content_elements: [] })
		fetchJson.mockClear()
		optionalPageData.mockClear()
		getTokenMarketSummaryByGeckoId.mockClear()
	})

	it('default-toggles secondary charts without server-prefetching their series', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				fees: true
			} as never,
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
			} as never,
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
			} as never,
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
			currentProtocolMetadata: { displayName: 'Test Protocol', gecko_id: 'test-token' } as never,
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
				} as never,
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
			} as never,
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
			} as never,
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
			} as never,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			protocolLlamaswapDataset: {},
			yieldsSnapshot: null
		})

		expect(data.yields).toBeNull()
		expect(data.tokenLiquidity).toBeNull()
		expect(optionalPageData).not.toHaveBeenCalledWith('protocol:test-protocol:yields', expect.any(Function), null)
		expect(optionalPageData).not.toHaveBeenCalledWith(
			'protocol:test-protocol:liquidity_yields_config',
			expect.any(Function),
			null
		)
	})

	it('fetches token income statements from the token endpoint', async () => {
		fetchJson.mockResolvedValueOnce({ aggregates: { monthly: {}, quarterly: {}, yearly: {} } })
		const { getTokenIncomeStatement } = await import('../queries')

		const incomeStatement = await getTokenIncomeStatement({ token: 'HYPE' })

		expect(fetchJson).toHaveBeenCalledWith(expect.stringMatching(/\/metrics\/financial-statement\/token\/hype\?q=30$/))
		expect(incomeStatement?.data).toMatchObject({ monthly: {}, quarterly: {}, yearly: {} })
	})

	it('calculates outstanding FDV from cached emissions supply metrics', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				emissions: true
			} as never,
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
})
