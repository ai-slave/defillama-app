import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ICategoriesAndTags, IChainMetadata } from '~/utils/metadata/types'

const mocks = vi.hoisted(() => ({
	fetchLlamaConfig: vi.fn(),
	fetchCoinGeckoCoinById: vi.fn(),
	fetchAdapterChainMetrics: vi.fn(),
	fetchAdapterProtocolMetrics: vi.fn(),
	fetchCexVolume: vi.fn(),
	fetchChainsAssetTotals: vi.fn(),
	getBridgeChainNetInflows: vi.fn(),
	fetchChainChart: vi.fn(),
	getETFData: vi.fn(),
	getChainIncentivesFromAggregatedEmissions: vi.fn(),
	getProtocolsByChain: vi.fn(),
	fetchRaises: vi.fn(),
	fetchRWAStats: vi.fn(),
	fetchStablecoinAssetsApi: vi.fn(),
	getStablecoinChainMcapSummary: vi.fn(),
	fetchTreasuries: vi.fn(),
	fetchJson: vi.fn(),
	recordOptionalPageDataFailure: vi.fn(),
	fetchHomepageUnlocksSummary: vi.fn()
}))

vi.mock('~/api', () => ({ fetchLlamaConfig: mocks.fetchLlamaConfig }))
vi.mock('~/api/coingecko', () => ({ fetchCoinGeckoCoinById: mocks.fetchCoinGeckoCoinById }))
vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainMetrics: mocks.fetchAdapterChainMetrics,
	fetchAdapterProtocolMetrics: mocks.fetchAdapterProtocolMetrics,
	fetchCexVolume: mocks.fetchCexVolume
}))
vi.mock('~/containers/BridgedTVL/api', () => ({ fetchChainsAssetTotals: mocks.fetchChainsAssetTotals }))
vi.mock('~/containers/Bridges/queries.server', () => ({ getBridgeChainNetInflows: mocks.getBridgeChainNetInflows }))
vi.mock('~/containers/Chains/api', () => ({ fetchChainChart: mocks.fetchChainChart }))
vi.mock('~/containers/ETF/queries', () => ({ getETFData: mocks.getETFData }))
vi.mock('~/containers/Incentives/queries', () => ({
	getChainIncentivesFromAggregatedEmissions: mocks.getChainIncentivesFromAggregatedEmissions
}))
vi.mock('~/containers/ProtocolRankings/queries.server', () => ({ getProtocolsByChain: mocks.getProtocolsByChain }))
vi.mock('~/containers/ProtocolRankings/server/tableData.server', () => {
	// Version must be unique per build: the prepared-rows cache keys on
	// (chain, version, signature) and trusts that a version names one content.
	let snapshotCounter = 0
	return {
		getProtocolRankingsSnapshot: async () => {
			const result = await mocks.getProtocolsByChain()
			if (!result) throw new Error('Missing protocol aggregation for Ethereum')
			const { protocols, chains, fees, dexs, perps } = result
			return {
				chain: 'Ethereum',
				createdAt: 1,
				snapshot: `test-snapshot-${++snapshotCounter}`,
				protocols,
				availableActivityMetrics: [],
				source: { chains, feeProtocols: fees?.protocols ?? null, dexs, perps }
			}
		}
	}
})
vi.mock('~/containers/Raises/api', () => ({ fetchRaises: mocks.fetchRaises }))
vi.mock('~/containers/RWA/api', () => ({ fetchRWAStats: mocks.fetchRWAStats }))
vi.mock('~/containers/Stablecoins/api', () => ({ fetchStablecoinAssetsApi: mocks.fetchStablecoinAssetsApi }))
vi.mock('~/containers/Stablecoins/queries.server', () => ({
	getStablecoinChainMcapSummary: mocks.getStablecoinChainMcapSummary
}))
vi.mock('~/containers/Treasuries/api', () => ({ fetchTreasuries: mocks.fetchTreasuries }))
vi.mock('~/utils/async', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/utils/async')>()
	return { ...actual, fetchJson: mocks.fetchJson }
})
vi.mock('~/utils/optionalPageData', () => ({
	recordOptionalPageDataFailure: mocks.recordOptionalPageDataFailure
}))
vi.mock('../homepageUnlocks.server', () => ({ fetchHomepageUnlocksSummary: mocks.fetchHomepageUnlocksSummary }))

const categoriesAndTagsMetadata = {
	categories: [],
	tags: [],
	tagCategoryMap: {},
	configs: {}
} satisfies ICategoriesAndTags

const ethereum = {
	name: 'Ethereum',
	id: 'ethereum',
	stablecoins: true
} satisfies IChainMetadata

function resetMocks() {
	mocks.fetchLlamaConfig.mockResolvedValue({})
	mocks.fetchCoinGeckoCoinById.mockResolvedValue(null)
	mocks.fetchAdapterChainMetrics.mockResolvedValue(null)
	mocks.fetchAdapterProtocolMetrics.mockResolvedValue(null)
	mocks.fetchCexVolume.mockResolvedValue(null)
	mocks.fetchChainsAssetTotals.mockResolvedValue({})
	mocks.getBridgeChainNetInflows.mockResolvedValue(null)
	mocks.fetchChainChart.mockResolvedValue({
		tvl: [],
		staking: [],
		borrowed: [],
		pool2: [],
		vesting: [],
		offers: [],
		doublecounted: [],
		liquidstaking: [],
		dcAndLsOverlap: []
	})
	mocks.getETFData.mockResolvedValue({ flows: {} })
	mocks.getChainIncentivesFromAggregatedEmissions.mockResolvedValue(null)
	mocks.getProtocolsByChain.mockResolvedValue({ protocols: [], chains: [], fees: null, dexs: null })
	mocks.fetchRaises.mockResolvedValue({ raises: [] })
	mocks.fetchRWAStats.mockResolvedValue(null)
	mocks.fetchStablecoinAssetsApi.mockResolvedValue({ peggedAssets: [], chains: [] })
	mocks.getStablecoinChainMcapSummary.mockResolvedValue(null)
	mocks.fetchTreasuries.mockResolvedValue([])
	mocks.fetchJson.mockResolvedValue(null)
	mocks.recordOptionalPageDataFailure.mockClear()
	mocks.fetchHomepageUnlocksSummary.mockResolvedValue(null)
}

describe('getChainOverviewData optional sections', () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it('falls back when stablecoins fail', async () => {
		resetMocks()
		const error = new Error('stablecoins unavailable')
		mocks.getStablecoinChainMcapSummary.mockRejectedValueOnce(error)
		const { getChainOverviewData } = await import('../queries.server')

		const data = await getChainOverviewData({
			chain: 'Ethereum',
			chainMetadata: { ethereum },
			protocolMetadata: {},
			categoriesAndTagsMetadata
		})

		expect(data?.stablecoins).toBeNull()
		expect(mocks.recordOptionalPageDataFailure).toHaveBeenCalledWith('chain:Ethereum:stablecoins', error)
	})

	it('still rejects when protocols by chain fail', async () => {
		resetMocks()
		mocks.getProtocolsByChain.mockRejectedValueOnce(new Error('protocols unavailable'))
		const { getChainOverviewData } = await import('../queries.server')

		await expect(
			getChainOverviewData({
				chain: 'Ethereum',
				chainMetadata: { ethereum },
				protocolMetadata: {},
				categoriesAndTagsMetadata
			})
		).rejects.toThrow('Error fetching chainOverview:Ethereum')
	})

	it('still rejects when required protocol aggregation is absent', async () => {
		resetMocks()
		mocks.getProtocolsByChain.mockResolvedValueOnce(null)
		const { getChainOverviewData } = await import('../queries.server')

		await expect(
			getChainOverviewData({
				chain: 'Ethereum',
				chainMetadata: { ethereum },
				protocolMetadata: {},
				categoriesAndTagsMetadata
			})
		).rejects.toThrow('Missing protocol aggregation for Ethereum')
	})

	it('retains an explicit zero NFT volume', async () => {
		resetMocks()
		mocks.fetchJson.mockResolvedValueOnce({ ethereum: 0 })
		const { getChainOverviewData } = await import('../queries.server')

		const data = await getChainOverviewData({
			chain: 'Ethereum',
			chainMetadata: { ethereum },
			protocolMetadata: {},
			categoriesAndTagsMetadata
		})

		expect(data?.nfts).toEqual({ total24h: 0 })
	})

	it('keeps chain-native and app fee/revenue requests on their canonical endpoints', async () => {
		resetMocks()
		const { getChainOverviewData } = await import('../queries.server')
		const metricChain = {
			...ethereum,
			fees: true,
			revenue: true,
			chainFees: true,
			chainRevenue: true
		} satisfies IChainMetadata

		await getChainOverviewData({
			chain: 'Ethereum',
			chainMetadata: { ethereum: metricChain },
			protocolMetadata: {},
			categoriesAndTagsMetadata
		})

		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledTimes(2)
		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledWith({
			adapterType: 'fees',
			chain: 'Ethereum',
			dataType: 'dailyAppFees'
		})
		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledWith({
			adapterType: 'fees',
			chain: 'Ethereum',
			dataType: 'dailyAppRevenue'
		})
		expect(mocks.fetchAdapterProtocolMetrics).toHaveBeenCalledTimes(2)
		expect(mocks.fetchAdapterProtocolMetrics).toHaveBeenCalledWith({
			adapterType: 'fees',
			protocol: 'Ethereum'
		})
		expect(mocks.fetchAdapterProtocolMetrics).toHaveBeenCalledWith({
			adapterType: 'fees',
			protocol: 'Ethereum',
			dataType: 'dailyRevenue'
		})
	})

	it('keeps the top fee protocol ordering, positive-value filter, and 14-row limit', async () => {
		resetMocks()
		const protocols = Array.from({ length: 16 }, (_, index) => ({
			id: `protocol-${index + 1}`,
			name: `Protocol ${index + 1}`,
			slug: `protocol-${index + 1}`,
			tvl: {
				default: { tvl: 100 - index, tvlPrevDay: 100 - index, tvlPrevWeek: 100 - index, tvlPrevMonth: 100 - index }
			},
			fees: { total24h: index + 1 }
		}))
		protocols.push({
			id: 'zero-protocol',
			name: 'Zero Protocol',
			slug: 'zero-protocol',
			tvl: { default: { tvl: 0, tvlPrevDay: 0, tvlPrevWeek: 0, tvlPrevMonth: 0 } },
			fees: { total24h: 0 }
		})
		mocks.getProtocolsByChain.mockResolvedValue({
			protocols,
			chains: [],
			fees: { protocols: [{ slug: 'fee-protocol', total24h: 1 }] },
			dexs: null
		})
		const { getChainOverviewData } = await import('../queries.server')

		const data = await getChainOverviewData({
			chain: 'Ethereum',
			chainMetadata: { ethereum },
			protocolMetadata: {},
			categoriesAndTagsMetadata
		})

		expect(data?.chainFees.topProtocolsChart?.map(([name, total24h]) => [name, total24h])).toEqual(
			Array.from({ length: 14 }, (_, index) => [`Protocol ${16 - index}`, 16 - index])
		)
		expect(data?.protocols.map((protocol) => protocol.name)).toEqual([
			...Array.from({ length: 16 }, (_, index) => `Protocol ${index + 1}`),
			'Zero Protocol'
		])
	})
})
