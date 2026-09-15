import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ParentProtocolLite, ProtocolLite } from '~/containers/ProtocolLists/api.types'
import { getFastJsonTimeoutMs } from '~/utils/async'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import type { IProtocolExpenses } from '../api.types'
import { buildProtocolExpenseRows } from '../expenses'

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
const fetchRWAPlatformAumChart = vi.hoisted(() => vi.fn().mockResolvedValue([]))
vi.mock('~/containers/RWA/api', () => ({ fetchRWAPlatformAumChart }))

const fetchProtocolTvlChart = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const fetchOracleMetrics = vi.hoisted(() => vi.fn().mockResolvedValue(null))
const fetchOracleProtocolChart = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const fetchTreasuries = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const fetchProtocolExpenses = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const fetchProtocols = vi.hoisted(() => vi.fn().mockResolvedValue({ protocols: [], chains: [], parentProtocols: [] }))
const fetchJson = vi.hoisted(() => vi.fn().mockResolvedValue({ content_elements: [] }))
const getTokenMarketSummaryByGeckoId = vi.hoisted(() => vi.fn().mockResolvedValue(null))
const getSponsoredResearchReports = vi.hoisted(() => vi.fn().mockResolvedValue({ sponsor: null, reports: [] }))
const optionalPageData = vi.hoisted(() =>
	vi.fn(async (_label: string, run: () => Promise<unknown>, fallback: unknown) => {
		try {
			return await run()
		} catch {
			return fallback
		}
	})
)
const yieldsSnapshot = {
	generationId: 'test-gen',
	generatedAt: 0,
	readJson: vi.fn().mockRejectedValue(new Error('yields unavailable'))
}

vi.mock('~/api', () => ({
	fetchBlockExplorers: vi.fn().mockResolvedValue([])
}))

vi.mock('~/api/coingecko', () => ({
	fetchCoinGeckoChartByIdWithCacheFallback: vi.fn().mockResolvedValue(null)
}))

vi.mock('~/containers/Bridges/api', () => ({
	fetchBridgeVolumeBySlug: vi.fn().mockResolvedValue({ dailyVolumes: [] })
}))

vi.mock('~/containers/Articles/api', () => ({
	getSponsoredResearchReports
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
	fetchProtocols
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
	fetchProtocolExpenses,
	fetchProtocolOverviewMetrics,
	fetchProtocolTvlChart
}))

vi.mock('../formatAdapterData', () => ({
	formatAdapterData
}))

describe('getProtocolOverviewPageData', () => {
	test('tolerates RWA upstream failure while TVL is live', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')
		fetchRWAPlatformAumChart.mockRejectedValueOnce(new Error('RWA unavailable'))
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			const result = getProtocolOverviewPageData({
				protocolId: 'test-protocol',
				currentProtocolMetadata: { displayName: 'Test Protocol', tvl: true, rwaPlatformSlug: 'test-platform' },
				chainMetadata: {},
				tokenlist: {},
				cgExchangeIdentifiers: [],
				emissionsSupplyMetrics: {},
				yieldsSnapshot
			})
			const page = await result
			expect(page.rwaActiveAum).toBeNull()
			expect(page.metrics.tvl).toBe(true)
		} finally {
			logSpy.mockRestore()
		}
	})

	test('rejects RWA upstream failure when TVL is retired', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')
		fetchRWAPlatformAumChart.mockRejectedValueOnce(new Error('RWA unavailable'))
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			const result = getProtocolOverviewPageData({
				protocolId: 'test-protocol',
				currentProtocolMetadata: { displayName: 'Test Protocol', tvl: false, rwaPlatformSlug: 'test-platform' },
				chainMetadata: {},
				tokenlist: {},
				cgExchangeIdentifiers: [],
				emissionsSupplyMetrics: {},
				yieldsSnapshot
			})
			await expect(result).rejects.toThrow('RWA unavailable')
		} finally {
			logSpy.mockRestore()
		}
	})

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
		fetchProtocolExpenses.mockResolvedValue([])
		fetchProtocolExpenses.mockClear()
		fetchProtocols.mockResolvedValue({
			protocols: [],
			chains: [],
			parentProtocols: []
		})
		fetchProtocols.mockClear()
		fetchJson.mockResolvedValue({ content_elements: [] })
		fetchJson.mockClear()
		optionalPageData.mockClear()
		getTokenMarketSummaryByGeckoId.mockClear()
		getSponsoredResearchReports.mockResolvedValue({
			sponsor: null,
			reports: []
		})
		getSponsoredResearchReports.mockClear()
		fetchProtocolOverviewMetrics.mockClear()
		formatAdapterData.mockClear()
	})

	test.each([
		{ chains: ['Ethereum', 'Base'], expected: ['Ethereum', 'Base'] },
		{ chains: [], expected: ['Ethereum'] },
		{ chains: undefined, expected: ['Ethereum'] }
	])('uses metadata chains with protocol fallback: $chains', async ({ chains, expected }) => {
		const { getProtocolOverviewPageData } = await import('../queries')
		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: { displayName: 'Test Protocol', chains },
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(data.chains).toEqual(expected)
		const answer = data.faqItems?.find((item) => item.id === 'chains')?.answer
		expect(answer?.map((part) => part.text).join('')).toBe(
			expected.length === 1
				? 'Test Protocol operates on Ethereum.'
				: 'Test Protocol operates on 2 chains: Ethereum and Base.'
		)
	})

	test.each([
		[
			{ gasTokenGeckoId: 'ethereum', gasTokenSymbol: 'ETH' },
			[
				{ symbol: 'USD', geckoId: null },
				{ symbol: 'ETH', geckoId: 'ethereum' }
			]
		],
		[{}, [{ symbol: 'USD', geckoId: null }]]
	])(
		'uses gas metadata for protocol denominations without assuming the official token',
		async (gasMetadata, expected) => {
			const protocol = await fetchProtocolOverviewMetrics()
			fetchProtocolOverviewMetrics.mockResolvedValueOnce({
				...protocol,
				currentChainTvls: { Arbitrum: 100, Ethereum: 10 }
			})
			const { getProtocolOverviewPageData } = await import('../queries')
			const data = await getProtocolOverviewPageData({
				protocolId: 'test-protocol',
				currentProtocolMetadata: { displayName: 'Test Protocol' },
				chainMetadata: {
					arbitrum: { name: 'Arbitrum', id: 'arbitrum', gecko_id: 'arbitrum', tokenSymbol: 'ARB', ...gasMetadata }
				},
				tokenlist: {},
				cgExchangeIdentifiers: [],
				emissionsSupplyMetrics: {},
				yieldsSnapshot
			})
			expect(data.chartDenominations).toEqual(expected)
		}
	)

	test('looks up sponsored reports by the canonical protocol page identity', async () => {
		const report = {
			id: 'report-id',
			title: 'Canonical report',
			slug: 'canonical-report',
			section: 'report' as const,
			coverImage: null,
			carouselImage: null,
			excerpt: null,
			reportDescription: null,
			displayDate: null,
			publishedAt: '2026-08-01T00:00:00.000Z'
		}
		getSponsoredResearchReports.mockResolvedValueOnce({
			sponsor: null,
			reports: [report]
		})
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			researchSponsorEntitySlug: 'canonical-test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol'
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(getSponsoredResearchReports).toHaveBeenCalledWith('protocol', 'canonical-test-protocol', {
			limit: 3
		})
		expect(data.articles).toEqual([report])
		expect(data.researchSponsorEntity).toEqual({
			entityType: 'protocol',
			entitySlug: 'canonical-test-protocol'
		})
	})

	test('excludes child protocols from their parent protocol competitors', async () => {
		fetchProtocolOverviewMetrics.mockResolvedValueOnce({
			id: 'parent#arcus',
			name: 'Arcus',
			isParentProtocol: true,
			symbol: null,
			url: 'https://arcus.exchange',
			description: 'Arcus parent protocol',
			logo: 'arcus.png',
			gecko_id: null,
			cmcId: null,
			chains: ['Robinhood Chain'],
			currentChainTvls: {},
			mcap: null,
			raises: [],
			hacks: [],
			otherProtocols: ['Arcus', 'Arcus Perps', 'Arcus Spot'],
			twitter: null,
			treasury: null
		})
		fetchProtocols.mockResolvedValueOnce({
			protocols: [
				{
					name: 'Arcus Perps',
					defillamaId: 'arcus-perps',
					parentProtocol: 'parent#arcus',
					category: 'Derivatives',
					chains: ['Robinhood Chain'],
					tvl: 20_000_000
				},
				{
					name: 'Lighter Robinhood Perps',
					defillamaId: 'lighter-robinhood-perps',
					parentProtocol: 'parent#lighter',
					category: 'Derivatives',
					chains: ['Robinhood Chain'],
					tvl: 11_000_000
				}
			],
			chains: ['Robinhood Chain'],
			parentProtocols: []
		})
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'parent#arcus',
			currentProtocolMetadata: {
				displayName: 'Arcus'
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(data.competitors).toEqual([{ name: 'Lighter Robinhood Perps', tvl: 11_000_000 }])
		expect(data.childProtocols).toEqual([
			{
				name: 'Arcus Perps',
				href: '/protocol/arcus-perps',
				category: 'Derivatives',
				chains: ['Robinhood Chain']
			}
		])
	})

	test('uses the same ordered peers for the competitors card and FAQ', async () => {
		fetchProtocolOverviewMetrics.mockResolvedValueOnce({
			id: 'boros',
			name: 'Boros',
			symbol: null,
			url: 'https://boros.example',
			description: null,
			logo: null,
			gecko_id: null,
			cmcId: null,
			category: 'Interest Rate Derivatives',
			chains: ['Arbitrum'],
			currentChainTvls: { Arbitrum: 8 },
			mcap: null,
			raises: [],
			hacks: []
		})
		fetchProtocols.mockResolvedValueOnce({
			protocols: [
				{
					name: 'Boros',
					defillamaId: 'boros',
					category: 'Interest Rate Derivatives',
					chains: ['Arbitrum'],
					tvl: 8
				},
				{
					name: 'Rho X',
					defillamaId: 'rho-x',
					category: 'Interest Rate Derivatives',
					chains: ['Ethereum'],
					tvl: 10,
					parentProtocol: 'parent#rho'
				},
				{
					name: 'Arbitrum Rates',
					defillamaId: 'arbitrum-rates',
					category: 'Interest Rate Derivatives',
					chains: ['Arbitrum'],
					tvl: 1
				}
			],
			chains: ['Arbitrum', 'Ethereum'],
			parentProtocols: []
		})
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'boros',
			currentProtocolMetadata: {
				displayName: 'Boros',
				tvl: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})
		const faqPeers =
			data.faqItems
				?.find((item) => item.id === 'comparison')
				?.answer.filter((part) => part.href?.startsWith('/protocol/'))
				.map((part) => part.text) ?? []

		expect(data.competitors).toEqual([
			{ name: 'Arbitrum Rates', tvl: 1 },
			{ name: 'Rho X', tvl: 10 }
		])
		expect(faqPeers).toEqual(data.competitors?.map((peer) => peer.name) ?? [])
	})

	test('distinguishes absent TVL capability from successful empty and explicit-zero TVL responses', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')
		const request = {
			protocolId: 'test-protocol',
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		}

		const absent = await getProtocolOverviewPageData({
			...request,
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				tvl: false
			} satisfies IProtocolMetadata
		})
		expect(absent.currentTvlByChain).toBeNull()

		const empty = await getProtocolOverviewPageData({
			...request,
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				tvl: true
			} satisfies IProtocolMetadata
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
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				tvl: true
			} satisfies IProtocolMetadata
		})
		expect(zero.currentTvlByChain).toStrictEqual({ Ethereum: 0 })
	})

	test('shows key metrics for period-only and zero adapter values but hides unavailable adapter data', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')
		const request = {
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				fees: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		}

		formatAdapterData.mockResolvedValueOnce({
			total30d: 100,
			totalAllTime: null,
			defaultChartView: 'daily'
		})
		expect((await getProtocolOverviewPageData(request)).hasKeyMetrics).toBe(true)

		formatAdapterData.mockResolvedValueOnce({
			total30d: 0,
			totalAllTime: null,
			defaultChartView: 'daily'
		})
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

	test('retains a successful activity summary when every metric is explicit zero', async () => {
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
			yieldsSnapshot
		})

		expect(data.users).toEqual({
			activeUsers: 0,
			newUsers: 0,
			transactions: 0,
			gasUsed: 0,
			gasUsedUsd: 0
		})
	})

	test('keeps native gas usage separate from its USD cost', async () => {
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

	test('default-toggles secondary charts without server-prefetching their series', async () => {
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
			yieldsSnapshot
		})

		expect(data.availableCharts).toContain('Fees')
		expect(data.defaultToggledCharts).toContain('Fees')
		expect(data.initialMultiSeriesChartData).toEqual({})
		expect(fetchAdapterProtocolChartData).not.toHaveBeenCalled()
	})

	test('default-toggles seeded primary chart data', async () => {
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

	test('keeps configured TVS available while seeding only a nonempty exact producer array', async () => {
		const { getProtocolOverviewPageData } = await import('../queries')

		const emptyData = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: {
				displayName: 'Chainlink',
				tvl: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(emptyData.availableCharts).toContain('TVS')
		expect(emptyData.availableCharts).not.toContain('TVL')
		expect(emptyData.defaultToggledCharts).toContain('TVS')
		expect(emptyData.initialMultiSeriesChartData).toEqual({})

		fetchOracleProtocolChart.mockResolvedValueOnce([[1_700_000_000, 42]])
		const populatedData = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: {
				displayName: 'Chainlink',
				tvl: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(populatedData.initialMultiSeriesChartData.TVS).toEqual([[1_700_000_000_000, 42]])
	})

	test('aggregates every consumer measurement for an oracle provider', async () => {
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
			currentProtocolMetadata: {
				displayName: 'Chainlink',
				tvl: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(data.oracleTvs).toEqual({ Ethereum: 20, Arbitrum: 5 })
	})

	test('treats an omitted canonical Oracle member as zero contribution', async () => {
		fetchOracleMetrics.mockResolvedValueOnce({
			oracles: { Chainlink: ['Measured', 'Missing'] },
			chainsByOracle: { Chainlink: ['Ethereum'] },
			protocolsByOracleChain: {
				Chainlink: { Ethereum: ['Measured', 'Missing'] }
			},
			oraclesTVS: { Chainlink: { Measured: { Ethereum: 10 } } }
		})
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: {
				displayName: 'Chainlink',
				tvl: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(data.oracleTvs).toEqual({ Ethereum: 10 })
	})

	test('preserves extra-only Oracle measurements while default TVS is zero', async () => {
		fetchOracleMetrics.mockResolvedValueOnce({
			oracles: { Chainlink: ['Extra Only'] },
			chainsByOracle: { Chainlink: ['Ethereum'] },
			protocolsByOracleChain: { Chainlink: { Ethereum: ['Extra Only'] } },
			oraclesTVS: { Chainlink: { 'Extra Only': { 'Ethereum-staking': 5 } } }
		})
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: {
				displayName: 'Chainlink',
				tvl: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(data.oracleTvs).toEqual({ 'Ethereum-staking': 5 })
	})

	test('preserves Oracle identity when its optional measurement request fails', async () => {
		fetchOracleMetrics.mockRejectedValueOnce(new Error('oracle metrics unavailable'))
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'chainlink',
			currentProtocolMetadata: {
				displayName: 'Chainlink',
				tvl: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(data).toMatchObject({
			isOracleProtocol: true,
			oracleTvs: null,
			hasKeyMetrics: true
		})
	})

	test('constructs token FAQ data from the shared token market summary', async () => {
		getTokenMarketSummaryByGeckoId.mockResolvedValueOnce({
			symbol: 'TEST',
			marketCapRank: 10,
			currentPrice: 2,
			priceChange7d: 2,
			priceChange30d: 3,
			marketCap: 1000,
			fdv: 2000,
			circulatingSupply: 500,
			totalSupply: 1000,
			maxSupply: 1000,
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
			yieldsSnapshot,
			getTokenMarketSummary: getTokenMarketSummaryByGeckoId
		})

		expect(getTokenMarketSummaryByGeckoId).toHaveBeenCalledWith('test-token')
		expect(data.faqItems?.find((item) => item.id === 'token-valuation')?.answer).toContainEqual({
			text: 'TEST',
			href: '/token/TEST'
		})
	})

	test('does not load token FAQ data when FAQs are disabled', async () => {
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
			yieldsSnapshot,
			includeFaq: false,
			getTokenMarketSummary: getTokenMarketSummaryByGeckoId
		})

		expect(getTokenMarketSummaryByGeckoId).not.toHaveBeenCalled()
	})

	test('builds protocol page data when the primary TVL chart seed fails', async () => {
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
				yieldsSnapshot
			})

			expect(fetchProtocolTvlChart).toHaveBeenCalledWith({
				protocol: 'test-protocol',
				timeout: getFastJsonTimeoutMs()
			})
			expect(data.availableCharts).toContain('TVL')
			expect(data.defaultToggledCharts).toEqual(['TVL'])
			expect(data.initialMultiSeriesChartData).toEqual({})
		} finally {
			logSpy.mockRestore()
		}
	})

	test('builds protocol page data when optional treasury data fails', async () => {
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
			yieldsSnapshot
		})

		expect(data.treasury).toBeNull()
		expect(optionalPageData).toHaveBeenCalledWith('protocol:test-protocol:treasury', expect.any(Function), null)
	})

	test('keeps a present all-zero Treasury distinct from an absent Treasury', async () => {
		fetchTreasuries.mockResolvedValueOnce([
			{
				id: 'test-protocol-treasury',
				name: 'Test Protocol (treasury)',
				logo: '',
				slug: 'test-protocol-(treasury)',
				tvl: 0,
				chainTvls: {},
				tokenBreakdowns: { majors: 0, stablecoins: 0, ownTokens: 0, others: 0 },
				mcap: null
			}
		])
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
			yieldsSnapshot
		})

		expect(data.treasury).toEqual({ majors: 0, stablecoins: 0, ownTokens: 0, others: 0, total: 0 })
	})

	test('preserves signed expense categories and missing optional metadata', async () => {
		fetchProtocolExpenses.mockResolvedValueOnce([
			{
				protocolId: 'test-protocol',
				annualUsdCost: { operations: 100, adjustment: -25 },
				sources: null,
				lastUpdate: '2026-08-30'
			}
		])
		const { getProtocolOverviewPageData } = await import('../queries')

		const data = await getProtocolOverviewPageData({
			protocolId: 'test-protocol',
			currentProtocolMetadata: {
				displayName: 'Test Protocol',
				expenses: true
			} satisfies IProtocolMetadata,
			chainMetadata: {},
			tokenlist: {},
			cgExchangeIdentifiers: [],
			emissionsSupplyMetrics: {},
			yieldsSnapshot
		})

		expect(data.expenses).toEqual({
			headcount: null,
			annualUsdCost: [
				['Operations', 100],
				['Adjustment', -25]
			],
			total: 75,
			sources: null,
			notes: null,
			lastUpdate: '2026-08-30'
		})
	})

	test('builds protocol page data when optional yields data fails', async () => {
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
			yieldsSnapshot
		})

		expect(data.yields).toBeNull()
		expect(optionalPageData).toHaveBeenCalledWith('protocol:test-protocol:yields', expect.any(Function), null)
	})

	test('builds protocol page data without optional Yields enrichment when no snapshot is available', async () => {
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
			yieldsSnapshot: null
		})

		expect(data.yields).toBeNull()
		expect(JSON.parse(JSON.stringify(data))).toEqual(data)
		expect(optionalPageData).not.toHaveBeenCalledWith('protocol:test-protocol:yields', expect.any(Function), null)
	})

	test('fetches token income statements from the token endpoint', async () => {
		const response = {
			components: [
				{ name: 'Hyperliquid', id: 'chain#hyperliquid', protocolType: 'chain', module: 'hyperliquid' },
				{ name: 'Hyper Foundation', id: 'parent#hyper-foundation', protocolType: 'protocol', module: null }
			],
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
		expect(incomeStatement?.components).toEqual(response.components)
		expect(response).toEqual(original)
	})

	test('calculates outstanding FDV from cached emissions supply metrics', async () => {
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
			}
		})

		expect(data.outstandingFDV).toBe(1000)
	})

	test.each([
		{ adjustedSupply: 0, currentPrice: 2 },
		{ adjustedSupply: 500, currentPrice: 0 }
	])('preserves zero at the outstanding FDV boundary', async ({ adjustedSupply, currentPrice }) => {
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
			}
		})

		expect(data.outstandingFDV).toBe(0)
	})
})

const expenseProtocol = {
	name: 'Child Protocol',
	symbol: 'CHILD',
	logo: null,
	url: '',
	chains: [],
	chainTvls: {},
	tvl: null,
	tvlPrevDay: null,
	tvlPrevWeek: null,
	tvlPrevMonth: null,
	mcap: null,
	defillamaId: '10',
	geckoId: null,
	category: 'Dexs'
} satisfies ProtocolLite

const expenseParentProtocol = {
	id: 'parent#example',
	name: 'Parent Protocol',
	chains: [],
	gecko_id: null,
	mcap: null,
	logo: ''
} satisfies ParentProtocolLite

describe('Protocol Expenses rows', () => {
	test('joins child and parent identities and sums signed whole-USD categories', () => {
		const expenses: Array<IProtocolExpenses> = [
			{
				protocolId: '10',
				headcount: 0,
				annualUsdCost: { salaries: 100, adjustment: -25 },
				sources: [],
				lastUpdate: '2026-01-01'
			},
			{
				protocolId: 'parent#example',
				annualUsdCost: { operations: 200 },
				sources: null,
				lastUpdate: '2026-01-02'
			}
		]

		expect(
			buildProtocolExpenseRows({
				expenses,
				protocols: [expenseProtocol],
				parentProtocols: [expenseParentProtocol]
			})
		).toEqual([
			{
				name: 'Parent Protocol',
				protocol: { ...expenseParentProtocol, defillamaId: 'parent#example' },
				headcount: null,
				sources: null,
				sumAnnualUsdExpenses: 200
			},
			{
				name: 'Child Protocol',
				protocol: expenseProtocol,
				headcount: 0,
				sources: [],
				sumAnnualUsdExpenses: 75
			}
		])
	})

	test('keeps a successful empty population empty', () => {
		expect(buildProtocolExpenseRows({ expenses: [], protocols: [expenseProtocol], parentProtocols: [] })).toEqual([])
	})

	test('fails page construction when producer identity has no protocol metadata', () => {
		const expenses: Array<IProtocolExpenses> = [
			{
				protocolId: 'missing',
				annualUsdCost: { operations: 1 },
				sources: null,
				lastUpdate: '2026-01-01'
			}
		]

		expect(() => buildProtocolExpenseRows({ expenses, protocols: [], parentProtocols: [] })).toThrow(
			'Protocol Expenses metadata is missing for missing'
		)
	})
})
