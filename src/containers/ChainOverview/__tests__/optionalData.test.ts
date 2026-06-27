import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ICategoriesAndTags, IChainMetadata } from '~/utils/metadata/types'

const mocks = vi.hoisted(() => ({
	fetchLlamaConfig: vi.fn(),
	fetchCoinGeckoCoinById: vi.fn(),
	fetchAdapterChainMetrics: vi.fn(),
	fetchAdapterProtocolMetrics: vi.fn(),
	fetchCexVolume: vi.fn(),
	fetchChainsAssets: vi.fn(),
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
vi.mock('~/containers/BridgedTVL/api', () => ({ fetchChainsAssets: mocks.fetchChainsAssets }))
vi.mock('~/containers/Bridges/queries.server', () => ({ getBridgeChainNetInflows: mocks.getBridgeChainNetInflows }))
vi.mock('~/containers/Chains/api', () => ({ fetchChainChart: mocks.fetchChainChart }))
vi.mock('~/containers/ETF/queries', () => ({ getETFData: mocks.getETFData }))
vi.mock('~/containers/Incentives/queries', () => ({
	getChainIncentivesFromAggregatedEmissions: mocks.getChainIncentivesFromAggregatedEmissions
}))
vi.mock('~/containers/ProtocolRankings/queries.server', () => ({ getProtocolsByChain: mocks.getProtocolsByChain }))
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
	mocks.fetchCoinGeckoCoinById.mockResolvedValue({})
	mocks.fetchAdapterChainMetrics.mockResolvedValue(null)
	mocks.fetchAdapterProtocolMetrics.mockResolvedValue(null)
	mocks.fetchCexVolume.mockResolvedValue(null)
	mocks.fetchChainsAssets.mockResolvedValue({})
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
})
