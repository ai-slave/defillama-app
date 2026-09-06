import type { NextApiRequest } from 'next'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

const {
	fetchChainMock,
	getObjectCacheMock,
	setObjectCacheMock,
	getCategoryInfoMock,
	getCoinPerformanceMock,
	getOracleDetailPageDataMock,
	getOraclesListPageDataMock,
	getDATOverviewDataByAssetMock,
	getDATCompanyDataMock,
	getProtocolOverviewPageDataMock,
	fetchEntityQuestionsMock,
	fetchStablecoinAssetsApiMock,
	getStablecoinAssetPageDataMock,
	metadataCache
} = vi.hoisted(() => {
	const metadataCache: MetadataCache = {
		chainMetadata: {},
		chainRouteKeyBySlug: {},
		categoriesAndTags: { categories: [], tags: [], tagCategoryMap: {}, configs: {} },
		protocolCategoryBySlug: {},
		protocolTagBySlug: {},
		protocolMetadata: {},
		protocolRouteIdBySlug: {},
		cexs: [],
		cexRouteIdBySlug: {},
		cexMetadataBySlug: {},
		rwaList: {
			canonicalMarketIds: [],
			platforms: [],
			platformRoutes: [],
			chains: [],
			categories: [],
			assetGroups: [],
			idMap: {}
		},
		rwaPlatformsIndex: { generatedAt: 0, byPid: {}, platforms: {} },
		rwaPerpsList: { contracts: [], venues: [], categories: [], assets: [], assetGroups: [], total: 0 },
		tokenlist: {},
		tokenDirectory: {},
		tokenDirectoryRecordByRouteSegment: {},
		protocolDisplayNames: new Map(),
		chainDisplayNames: new Map(),
		chainCategories: [],
		liquidationsTokenSymbols: [],
		liquidationsTokenSymbolsSet: new Set<string>(),
		emissionsProtocolsList: [],
		emissionsProtocolBySlug: {},
		emissionsSupplyMetrics: {},
		emissionsHistoricalPrices: {},
		cgExchangeIdentifiers: [],
		bridgeProtocolSlugs: [],
		bridgeProtocolSlugsSet: new Set<string>(),
		bridgeChainSlugs: [],
		bridgeChainSlugsSet: new Set<string>(),
		bridgeChainSlugToName: {},
		narrativeCategories: { ids: [], nameById: {} },
		narrativeCategoryIdsSet: new Set<string>(),
		oracleRoutes: { oracleNameBySlug: {}, chainNameBySlug: {}, chainSlugsByOracleSlug: {} },
		digitalAssetTreasuryRoutes: { assetSlugs: [], companySlugs: [] },
		digitalAssetTreasuryAssetSlugsSet: new Set<string>(),
		digitalAssetTreasuryCompanyRouteBySlug: {},
		stablecoinPeggedAssetSlugs: [],
		stablecoinPeggedAssetSlugsSet: new Set<string>(),
		equitiesCompanyRoutes: [],
		equitiesCompanySlugsSet: new Set<string>(),
		preIpoCompanyIds: [],
		preIpoCompanyIdsSet: new Set<string>(),
		tokenFilterMetadata: {
			schemaVersion: 2,
			generatedAt: 0,
			sources: { coingeckoCatalogGeneratedAt: 0, rankingsUpdatedAt: null },
			tokens: {},
			categories: []
		}
	}
	return {
		fetchChainMock: vi.fn(),
		getObjectCacheMock: vi.fn(),
		setObjectCacheMock: vi.fn(),
		getCategoryInfoMock: vi.fn(),
		getCoinPerformanceMock: vi.fn(),
		getOracleDetailPageDataMock: vi.fn(),
		getOraclesListPageDataMock: vi.fn(),
		getDATOverviewDataByAssetMock: vi.fn(),
		getDATCompanyDataMock: vi.fn(),
		getProtocolOverviewPageDataMock: vi.fn(),
		fetchEntityQuestionsMock: vi.fn(),
		fetchStablecoinAssetsApiMock: vi.fn(),
		getStablecoinAssetPageDataMock: vi.fn(),
		metadataCache
	}
})

vi.mock('~/constants', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/constants')>()),
	SKIP_BUILD_STATIC_GENERATION: false
}))

vi.mock('~/layout', () => ({
	default: () => null
}))

vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: metadataCache
}))

vi.mock('~/containers/CompareChains/chainFetcher', () => ({
	fetchChain: fetchChainMock
}))

vi.mock('~/utils/cache-client', () => ({
	getObjectCache: getObjectCacheMock,
	setObjectCache: setObjectCacheMock
}))

vi.mock('~/containers/NarrativeTracker', () => ({
	CategoryPerformanceContainer: () => null
}))

vi.mock('~/containers/NarrativeTracker/queries', () => ({
	getCategoryInfo: getCategoryInfoMock,
	getCoinPerformance: getCoinPerformanceMock
}))

vi.mock('~/containers/Oracles/OracleOverview', () => ({
	OracleOverview: () => null
}))

vi.mock('~/containers/Oracles/OraclesByChain', () => ({
	OraclesByChain: () => null
}))

vi.mock('~/containers/Oracles/queries', () => ({
	getOracleDetailPageData: getOracleDetailPageDataMock,
	getOraclesListPageData: getOraclesListPageDataMock
}))

vi.mock('~/containers/DAT/ByAsset', () => ({
	DATByAsset: () => null
}))

vi.mock('~/containers/DAT/Company', () => ({
	DATCompany: () => null
}))

vi.mock('~/containers/DAT/queries', () => ({
	getDATOverviewDataByAsset: getDATOverviewDataByAssetMock,
	getDATCompanyData: getDATCompanyDataMock
}))

vi.mock('~/containers/ProtocolOverview', () => ({
	ProtocolOverview: () => null
}))

vi.mock('~/containers/ProtocolOverview/queries', () => ({
	getProtocolOverviewPageData: getProtocolOverviewPageDataMock
}))

vi.mock('~/containers/LlamaAI/api', () => ({
	fetchEntityQuestions: fetchEntityQuestionsMock
}))

vi.mock('~/containers/Stablecoins/api', () => ({
	fetchStablecoinAssetsApi: fetchStablecoinAssetsApiMock
}))

vi.mock('~/containers/Stablecoins/queries.server', () => ({
	getStablecoinAssetPageData: getStablecoinAssetPageDataMock
}))

vi.mock('~/containers/Stablecoins/StablecoinOverview', () => ({
	default: () => null
}))

import {
	getChainRouteRedirectDestination,
	resolveChainParamFromMetadata
} from '~/containers/ChainOverview/server/routes'
import { resolveProtocolFeatureRouteFromMetadata } from '~/containers/ProtocolOverview/server/routes'
import { chainCacheHandler } from '~/pages/api/dynamic/cache/chain/[chain]'
import * as datAssetPage from '~/pages/digital-asset-treasuries/[asset]'
import * as datCompanyPage from '~/pages/digital-asset-treasury/[company]'
import * as narrativePage from '~/pages/narrative-tracker/[category]'
import * as oraclePage from '~/pages/oracles/[oracle]'
import * as oracleChainPage from '~/pages/oracles/[oracle]/[chain]'
import * as oraclesByChainPage from '~/pages/oracles/chain/[chain]'
import * as protocolPage from '~/pages/protocol/[protocol]'
import * as stablecoinPage from '~/pages/stablecoin/[peggedasset]'

beforeEach(() => {
	vi.clearAllMocks()
	metadataCache.chainMetadata = { ethereum: { name: 'Ethereum', id: 'ethereum' } }
	metadataCache.chainRouteKeyBySlug = { ethereum: 'ethereum' }
	metadataCache.protocolMetadata = {
		aave: { name: 'aave-v3', displayName: 'Aave', tvl: true, fees: true }
	}
	metadataCache.protocolRouteIdBySlug = { aave: 'aave', 'aave-v3': 'aave' }
	metadataCache.cexs = []
	metadataCache.cexRouteIdBySlug = {}
	metadataCache.cexMetadataBySlug = {}
	metadataCache.narrativeCategories = { ids: ['ai'], nameById: { ai: 'AI' } }
	metadataCache.narrativeCategoryIdsSet = new Set(['ai'])
	metadataCache.oracleRoutes = {
		oracleNameBySlug: { chainlink: 'Chainlink' },
		chainNameBySlug: { ethereum: 'Ethereum' },
		chainSlugsByOracleSlug: { chainlink: ['ethereum'] }
	}
	metadataCache.digitalAssetTreasuryRoutes = { assetSlugs: ['bitcoin'], companySlugs: ['MSTR'] }
	metadataCache.digitalAssetTreasuryAssetSlugsSet = new Set(['bitcoin'])
	metadataCache.digitalAssetTreasuryCompanyRouteBySlug = { mstr: 'MSTR' }
	metadataCache.stablecoinPeggedAssetSlugs = ['tether']
	metadataCache.stablecoinPeggedAssetSlugsSet = new Set(['tether'])
	getObjectCacheMock.mockResolvedValue(null)
	setObjectCacheMock.mockResolvedValue(undefined)
	fetchChainMock.mockResolvedValue({ chainOverviewData: null })
	getCoinPerformanceMock.mockResolvedValue({
		pctChanges: [],
		performanceTimeSeries: {},
		areaChartLegend: [],
		isCoinPage: true
	})
	getOracleDetailPageDataMock.mockResolvedValue({ oracle: 'Chainlink', chain: null })
	getOraclesListPageDataMock.mockResolvedValue({ chain: 'Ethereum' })
	getDATOverviewDataByAssetMock.mockResolvedValue({ asset: 'bitcoin', metadata: { name: 'Bitcoin', ticker: 'BTC' } })
	getDATCompanyDataMock.mockResolvedValue({ name: 'Strategy', ticker: 'MSTR' })
	getProtocolOverviewPageDataMock.mockResolvedValue({ name: 'Aave' })
	fetchEntityQuestionsMock.mockResolvedValue({ questions: [] })
	getStablecoinAssetPageDataMock.mockResolvedValue({
		props: {
			peggedAssetData: { name: 'Tether', symbol: 'USDT' }
		}
	})
})

describe('route metadata guards', () => {
	test('chain cache API returns 404 before cache lookup or heavy fetch for invalid chains', async () => {
		const res = createMockNextApiResponse()

		await chainCacheHandler({ query: { chain: 'bad-chain' } } as unknown as NextApiRequest, res)

		expect(res.statusCode).toBe(404)
		expect(getObjectCacheMock).not.toHaveBeenCalled()
		expect(fetchChainMock).not.toHaveBeenCalled()
	})

	test('chain cache API canonicalizes valid chain params for cache and fetch', async () => {
		const res = createMockNextApiResponse()

		await chainCacheHandler({ query: { chain: 'eThEReum' } } as unknown as NextApiRequest, res)

		expect(getObjectCacheMock).toHaveBeenCalledWith('object-chain-ethereum')
		expect(fetchChainMock).toHaveBeenCalledWith(expect.objectContaining({ chain: 'Ethereum' }))
		expect(setObjectCacheMock).toHaveBeenCalledWith('object-chain-ethereum', { chainOverviewData: null })
		expect(res.send).toHaveBeenCalledWith(JSON.stringify({ chainOverviewData: null }))
	})

	test('chain cache API returns cached canonical responses without fetching', async () => {
		const res = createMockNextApiResponse()
		metadataCache.chainMetadata.polygon = { name: 'Polygon', id: 'polygon' }
		metadataCache.chainRouteKeyBySlug.polygon = 'polygon'
		const cachedData = { chainOverviewData: { name: 'Polygon' } }
		getObjectCacheMock.mockResolvedValueOnce(cachedData)

		await chainCacheHandler({ query: { chain: 'polygon' } } as unknown as NextApiRequest, res)

		expect(getObjectCacheMock).toHaveBeenCalledWith('object-chain-polygon')
		expect(res.send).toHaveBeenCalledWith(JSON.stringify(cachedData))
		expect(fetchChainMock).not.toHaveBeenCalled()
		expect(setObjectCacheMock).not.toHaveBeenCalled()
	})

	test('chain cache API unwraps legacy object-cache entries', async () => {
		const res = createMockNextApiResponse()
		metadataCache.chainMetadata.arbitrum = { name: 'Arbitrum', id: 'arbitrum' }
		metadataCache.chainRouteKeyBySlug.arbitrum = 'arbitrum'
		const chainData = { chainOverviewData: { name: 'Arbitrum' } }
		getObjectCacheMock.mockResolvedValueOnce({ chain: chainData })

		await chainCacheHandler({ query: { chain: 'arbitrum' } } as unknown as NextApiRequest, res)

		expect(getObjectCacheMock).toHaveBeenCalledWith('object-chain-arbitrum')
		expect(res.send).toHaveBeenCalledWith(JSON.stringify(chainData))
		expect(fetchChainMock).not.toHaveBeenCalled()
		expect(setObjectCacheMock).not.toHaveBeenCalled()
	})

	test('narrative category route returns notFound before performance fetch for indexed invalid ids', async () => {
		await expect(narrativePage.getStaticProps({ params: { category: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
		expect(getCoinPerformanceMock).not.toHaveBeenCalled()
	})

	test('narrative getStaticPaths uses cached category ids when available', async () => {
		await expect(narrativePage.getStaticPaths()).resolves.toEqual({
			paths: [{ params: { category: 'ai' } }],
			fallback: 'blocking'
		})
		expect(getCategoryInfoMock).not.toHaveBeenCalled()
	})

	test('oracle routes return notFound before page-data fetches for invalid params', async () => {
		await expect(oraclePage.getStaticProps({ params: { oracle: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
		await expect(
			oracleChainPage.getStaticProps({ params: { oracle: 'chainlink', chain: 'solana' } } as never)
		).resolves.toEqual({ notFound: true })
		await expect(oraclesByChainPage.getStaticProps({ params: { chain: 'solana' } } as never)).resolves.toEqual({
			notFound: true
		})
		expect(getOracleDetailPageDataMock).not.toHaveBeenCalled()
		expect(getOraclesListPageDataMock).not.toHaveBeenCalled()
	})

	test('oracle routes resolve indexed slugs to canonical names', async () => {
		await oraclePage.getStaticProps({ params: { oracle: 'chainlink' } } as never)
		await oracleChainPage.getStaticProps({ params: { oracle: 'chainlink', chain: 'ethereum' } } as never)
		await oraclesByChainPage.getStaticProps({ params: { chain: 'ethereum' } } as never)

		expect(getOracleDetailPageDataMock).toHaveBeenCalledWith({ oracle: 'Chainlink' })
		expect(getOracleDetailPageDataMock).toHaveBeenCalledWith({ oracle: 'Chainlink', chain: 'Ethereum' })
		expect(getOraclesListPageDataMock).toHaveBeenCalledWith({ chain: 'Ethereum' })
	})

	test('DAT routes return notFound before data fetches for indexed invalid slugs', async () => {
		await expect(datAssetPage.getStaticProps({ params: { asset: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
		await expect(datCompanyPage.getStaticProps({ params: { company: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
		expect(getDATOverviewDataByAssetMock).not.toHaveBeenCalled()
		expect(getDATCompanyDataMock).not.toHaveBeenCalled()
	})

	test('DAT routes redirect noncanonical params before data fetches', async () => {
		await expect(datAssetPage.getStaticProps({ params: { asset: 'Bitcoin' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/digital-asset-treasuries/bitcoin',
				permanent: false
			}
		})
		await expect(datCompanyPage.getStaticProps({ params: { company: 'mstr' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/digital-asset-treasury/MSTR',
				permanent: false
			}
		})
		expect(getDATOverviewDataByAssetMock).not.toHaveBeenCalled()
		expect(getDATCompanyDataMock).not.toHaveBeenCalled()
	})

	test('DAT company route does not redirect away from the metadata slug when detail ticker differs', async () => {
		getDATCompanyDataMock.mockResolvedValueOnce({ name: 'Strategy', ticker: 'MSTR.US' })

		const result = await datCompanyPage.getStaticProps({ params: { company: 'MSTR' } } as never)

		expect('redirect' in result).toBe(false)
		expect(result).toMatchObject({
			props: {
				name: 'Strategy',
				ticker: 'MSTR.US',
				canonicalCompanyRoute: 'MSTR'
			}
		})
		expect(getDATCompanyDataMock).toHaveBeenCalledWith('mstr')
	})

	test('DAT getStaticPaths uses blocking fallback so canonical redirects can run', async () => {
		metadataCache.digitalAssetTreasuryRoutes = {
			assetSlugs: Array.from({ length: 12 }, (_, index) => `asset-${index + 1}`),
			companySlugs: Array.from({ length: 12 }, (_, index) => `COMPANY-${index + 1}`)
		}
		metadataCache.digitalAssetTreasuryCompanyRouteBySlug = Object.fromEntries(
			metadataCache.digitalAssetTreasuryRoutes.companySlugs.map((company) => [company.toLowerCase(), company])
		)

		await expect(datAssetPage.getStaticPaths()).resolves.toEqual({
			paths: Array.from({ length: 10 }, (_, index) => ({ params: { asset: `asset-${index + 1}` } })),
			fallback: 'blocking'
		})
		await expect(datCompanyPage.getStaticPaths()).resolves.toEqual({
			paths: Array.from({ length: 10 }, (_, index) => ({ params: { company: `COMPANY-${index + 1}` } })),
			fallback: 'blocking'
		})
	})

	test('protocol route redirects noncanonical aliases before page data fetches', async () => {
		await expect(protocolPage.getStaticProps({ params: { protocol: 'aave-v3' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/protocol/aave',
				permanent: false
			}
		})
		expect(getProtocolOverviewPageDataMock).not.toHaveBeenCalled()
		expect(fetchEntityQuestionsMock).not.toHaveBeenCalled()
	})

	test('protocol route keeps structural CEX redirects permanent', async () => {
		metadataCache.protocolMetadata.binance = {
			name: 'binance-cex',
			displayName: 'Binance CEX',
			tvl: true,
			cex: true
		}
		metadataCache.cexs = [{ name: 'Binance', slug: 'binance-cex' }]
		metadataCache.cexRouteIdBySlug = { binance: 'binance', 'binance-cex': 'binance' }
		metadataCache.cexMetadataBySlug = { 'binance-cex': { name: 'Binance', slug: 'binance-cex' } }

		await expect(protocolPage.getStaticProps({ params: { protocol: 'binance-cex' } } as never)).resolves.toEqual({
			redirect: {
				destination: '/cex/binance-cex',
				permanent: true
			}
		})
		expect(getProtocolOverviewPageDataMock).not.toHaveBeenCalled()
		expect(fetchEntityQuestionsMock).not.toHaveBeenCalled()
	})

	test('chain route resolver redirects valid case aliases to the canonical display slug', () => {
		const chainRoute = resolveChainParamFromMetadata('Ethereum', metadataCache)

		expect(chainRoute?.canonicalSlug).toBe('ethereum')
		if (!chainRoute) throw new Error('Expected Ethereum chain route')
		expect(getChainRouteRedirectDestination('Ethereum', chainRoute, 'chain')).toBe('/chain/ethereum')
		expect(getChainRouteRedirectDestination('ethereum', chainRoute, 'chain')).toBe(null)
	})

	test('protocol feature resolver redirects valid aliases and preserves CEX feature redirects', () => {
		metadataCache.protocolMetadata.binance = {
			name: 'binance-cex',
			displayName: 'Binance CEX',
			stablecoins: true,
			tvl: true,
			cex: true
		}
		metadataCache.cexs = [{ name: 'Binance', slug: 'binance-cex' }]
		metadataCache.cexRouteIdBySlug = { binance: 'binance', 'binance-cex': 'binance' }
		metadataCache.cexMetadataBySlug = { 'binance-cex': { name: 'Binance', slug: 'binance-cex' } }

		expect(
			resolveProtocolFeatureRouteFromMetadata({
				hasMetric: (metadata) => Boolean(metadata.fees),
				metadataCache,
				protocol: 'Aave',
				routePrefix: 'protocol/fees'
			})
		).toEqual({
			type: 'redirect',
			destination: '/protocol/fees/aave'
		})
		expect(
			resolveProtocolFeatureRouteFromMetadata({
				cexRoutePrefix: 'cex/stablecoins',
				hasMetric: (metadata) => Boolean(metadata.stablecoins),
				metadataCache,
				protocol: 'binance-cex',
				routePrefix: 'protocol/stablecoins'
			})
		).toEqual({
			type: 'redirect',
			destination: '/cex/stablecoins/binance-cex'
		})
		expect(
			resolveProtocolFeatureRouteFromMetadata({
				hasMetric: (metadata) => Boolean(metadata.fees),
				metadataCache,
				protocol: 'binance-cex',
				routePrefix: 'protocol/fees'
			})
		).toBe(null)
	})

	test('stablecoin route returns notFound before data fetch for indexed invalid slugs', async () => {
		await expect(stablecoinPage.getStaticProps({ params: { peggedasset: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
		expect(getStablecoinAssetPageDataMock).not.toHaveBeenCalled()
	})

	test('stablecoin getStaticPaths uses cached slugs while preserving one pre-rendered path', async () => {
		metadataCache.stablecoinPeggedAssetSlugs = ['tether', 'usd-coin']

		await expect(stablecoinPage.getStaticPaths({} as never)).resolves.toEqual({
			paths: [{ params: { peggedasset: 'tether' } }],
			fallback: 'blocking'
		})
		expect(fetchStablecoinAssetsApiMock).not.toHaveBeenCalled()
	})
})
