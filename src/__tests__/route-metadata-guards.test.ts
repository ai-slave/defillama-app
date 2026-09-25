import type { NextApiRequest } from 'next'
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
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
import metadataCache from '~/utils/metadata'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { installMetadataSeeder } from '~/utils/test/metadataCache'
import { createMockNextApiResponse } from '~/utils/test/nextApiMocks'

vi.hoisted(() => vi.stubEnv('SKIP_BUILD_STATIC_GENERATION', 'false'))
afterAll(() => vi.unstubAllEnvs())
installFixtureFetch()
const { seed } = installMetadataSeeder()
beforeEach(() => {
	const emptyMetadata: MetadataCache = {
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
	seed(emptyMetadata)
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
})

describe('route metadata guards', () => {
	test('chain cache API returns 404 before cache lookup or heavy fetch for invalid chains', async () => {
		const res = createMockNextApiResponse()

		await chainCacheHandler({ query: { chain: 'bad-chain' } } as unknown as NextApiRequest, res)

		expect(res.statusCode).toBe(404)
	})

	test('narrative category route returns notFound before performance fetch for indexed invalid ids', async () => {
		await expect(narrativePage.getStaticProps({ params: { category: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
	})

	test('narrative getStaticPaths uses cached category ids when available', async () => {
		await expect(narrativePage.getStaticPaths()).resolves.toEqual({
			paths: [{ params: { category: 'ai' } }],
			fallback: 'blocking'
		})
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
	})

	test('DAT routes return notFound before data fetches for indexed invalid slugs', async () => {
		await expect(datAssetPage.getStaticProps({ params: { asset: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
		await expect(datCompanyPage.getStaticProps({ params: { company: 'bad' } } as never)).resolves.toEqual({
			notFound: true
		})
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
	})

	test('stablecoin getStaticPaths prerenders from cached slugs and renders the rest on demand', async () => {
		metadataCache.stablecoinPeggedAssetSlugs = ['tether', 'usd-coin']

		const result = await stablecoinPage.getStaticPaths({} as never)

		expect(result.fallback).toBe('blocking')
		expect(result.paths).toContainEqual({ params: { peggedasset: 'tether' } })
	})
})
