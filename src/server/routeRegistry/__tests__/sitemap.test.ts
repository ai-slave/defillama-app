import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	getProtocolSitemapRoutes,
	getStandaloneProtocolSitemapRoutes
} from '~/containers/ProtocolOverview/server/routes'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

const metadataCache = vi.hoisted((): MetadataCache => ({
	chainMetadata: {
		ethereum: { name: 'Ethereum', id: 'ethereum', stablecoins: true, fees: true }
	},
	chainRouteKeyBySlug: {
		ethereum: 'ethereum'
	},
	protocolMetadata: {
		aave: { name: 'aave', displayName: 'Aave', tvl: true, fees: true, emissions: true },
		uniswap: { name: 'uniswap', displayName: 'Uniswap', dexs: true },
		binance: { name: 'binance-cex', displayName: 'Binance CEX', tvl: true, stablecoins: true, cex: true },
		'no-markets': { name: 'no-markets-cex', displayName: 'No Markets CEX', tvl: true, cex: true }
	},
	protocolRouteIdBySlug: {
		aave: 'aave',
		uniswap: 'uniswap'
	},
	categoriesAndTags: { categories: ['Lending'], tags: [], tagCategoryMap: {}, configs: {} },
	protocolCategoryBySlug: {
		lending: 'Lending'
	},
	protocolTagBySlug: {},
	cexs: [
		{ name: 'Binance', slug: 'binance-cex' },
		{ name: 'No Markets', slug: 'no-markets-cex' }
	],
	cexRouteIdBySlug: {
		binance: 'binance',
		'binance-cex': 'binance',
		'no-markets-cex': 'no-markets'
	},
	cexMetadataBySlug: {
		'binance-cex': { name: 'Binance', slug: 'binance-cex' },
		'no-markets-cex': { name: 'No Markets', slug: 'no-markets-cex' }
	},
	rwaList: {
		canonicalMarketIds: ['ondo/usdy'],
		platforms: ['Ondo'],
		chains: ['Ethereum'],
		categories: ['Treasuries'],
		assetGroups: ['US Treasury Bills'],
		idMap: {}
	},
	rwaPlatformsIndex: { generatedAt: 0, byPid: {}, platforms: {} },
	rwaPerpsList: {
		contracts: ['xyz:sp500'],
		venues: ['CME'],
		categories: ['RWA Perps'],
		assets: ['S&P 500 Index'],
		assetGroups: [],
		total: 2
	},
	tokenlist: {},
	tokenDirectory: {
		btc: { name: 'Bitcoin', symbol: 'BTC', route: 'token/btc' }
	},
	tokenDirectoryRecordByRouteSegment: {},
	protocolDisplayNames: new Map(),
	chainDisplayNames: new Map(),
	chainCategories: [],
	liquidationsTokenSymbols: ['WETH'],
	liquidationsTokenSymbolsSet: new Set(['WETH']),
	emissionsProtocolsList: ['aave'],
	emissionsProtocolBySlug: { aave: 'aave' },
	emissionsSupplyMetrics: {},
	emissionsHistoricalPrices: {},
	cgExchangeIdentifiers: [],
	bridgeProtocolSlugs: ['stargate'],
	bridgeProtocolSlugsSet: new Set(['stargate']),
	bridgeChainSlugs: ['ethereum'],
	bridgeChainSlugsSet: new Set(['ethereum']),
	bridgeChainSlugToName: { ethereum: 'Ethereum' },
	narrativeCategories: { ids: ['ai'], nameById: { ai: 'AI' } },
	narrativeCategoryIdsSet: new Set(['ai']),
	oracleRoutes: {
		oracleNameBySlug: { chainlink: 'Chainlink' },
		chainNameBySlug: { ethereum: 'Ethereum' },
		chainSlugsByOracleSlug: { chainlink: ['ethereum'] }
	},
	digitalAssetTreasuryRoutes: { assetSlugs: ['bitcoin'], companySlugs: ['MSTR'] },
	digitalAssetTreasuryAssetSlugsSet: new Set(['bitcoin']),
	digitalAssetTreasuryCompanyRouteBySlug: { mstr: 'MSTR' },
	stablecoinPeggedAssetSlugs: ['tether'],
	stablecoinPeggedAssetSlugsSet: new Set(['tether']),
	equitiesCompanyRoutes: [],
	equitiesCompanySlugsSet: new Set(),
	preIpoCompanyIds: ['anthropic', 'commonwealth-fusion'],
	preIpoCompanyIdsSet: new Set(['anthropic', 'commonwealth-fusion']),
	tokenFilterMetadata: {
		schemaVersion: 2,
		generatedAt: 0,
		sources: { coingeckoCatalogGeneratedAt: 0, rankingsUpdatedAt: null },
		tokens: {},
		categories: []
	}
}))

vi.mock('~/utils/metadata', () => ({
	__esModule: true,
	default: metadataCache
}))

vi.mock('~/containers/LiquidationsV2/server/routeData', () => ({
	getLiquidationsSitemapProtocolChainsFromSnapshot: vi
		.fn()
		.mockResolvedValue([{ protocolId: 'aave', chainIds: ['ethereum'] }])
}))

vi.mock('~/containers/Raises/server/routeData', () => ({
	getRaisesInvestorSlugsFromSnapshot: vi.fn().mockResolvedValue(['paradigm', 'a16z'])
}))

vi.mock('~/containers/Markets/server/dataset.server', () => ({
	fetchExchangeDirectory: vi.fn().mockResolvedValue({ venues: [{ slug: 'binance' }, { slug: 'coinbase' }] }),
	fetchCexExchangeSlugIndex: vi.fn().mockResolvedValue({
		'binance-cex': { exchange: 'binance', defillama_slug: 'binance-cex' }
	})
}))

import { buildAppSitemapSections, getSitemapSection, getSitemapSectionPath } from '~/server/routeRegistry/sitemap'

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input)
			if (url.includes('/dashboards/search')) {
				return new Response(
					JSON.stringify({
						items: [
							{
								id: 'empty-public-dashboard',
								visibility: 'public',
								updated: '2026-01-02T00:00:00.000Z'
							},
							{
								id: 'rich-public-dashboard',
								visibility: 'public',
								editedAt: '2026-01-03T00:00:00.000Z'
							}
						],
						totalPages: 1
					}),
					{ status: 200 }
				)
			}

			return new Response('{}', { status: 404 })
		})
	)
})

afterEach(() => {
	vi.useRealTimers()
	vi.clearAllMocks()
})

describe('cache-backed sitemap sections', () => {
	it('omits governance routes from legacy metadata while retaining token rights and unlocks', () => {
		const originalMetadata = metadataCache.protocolMetadata.aave
		const legacyMetadata = { ...originalMetadata, tokenRights: true, governance: true }
		metadataCache.protocolMetadata.aave = legacyMetadata
		try {
			const standaloneRoutes = getStandaloneProtocolSitemapRoutes(metadataCache)
			const paths = [...getProtocolSitemapRoutes(metadataCache), ...Object.values(standaloneRoutes).flat()]

			expect(standaloneRoutes).not.toHaveProperty('governance')
			expect(paths.some((path) => /^(?:protocol\/)?governance(?:\/|$)/.test(path))).toBe(false)
			expect(paths).toEqual(expect.arrayContaining(['protocol/token-rights/aave', 'protocol/tvl/aave', 'unlocks/aave']))
		} finally {
			metadataCache.protocolMetadata.aave = originalMetadata
		}
	})

	it('builds grouped public routes from metadata and dataset snapshots only', async () => {
		const sections = await buildAppSitemapSections()
		const entriesBySection = new Map(
			sections.map((section) => [section.id, section.entries.map((entry) => entry.path)])
		)
		const allEntryPaths = sections.flatMap((section) => section.entries.map((entry) => entry.path))

		expect(sections.map((section) => String(section.id))).not.toContain('governance')
		expect(allEntryPaths).not.toContain('governance')
		expect(allEntryPaths).toContain('token-rights')
		expect(getSitemapSectionPath('protocols')).toBe('sitemap/protocols.xml')
		expect(entriesBySection.get('protocols')).toEqual(expect.arrayContaining(['protocol/aave', 'protocol/fees/aave']))
		expect(entriesBySection.get('protocols')).not.toContain('protocol/binance-cex')
		expect(entriesBySection.get('chains')).toEqual(expect.arrayContaining(['chain/ethereum', 'fees/chain/ethereum']))
		expect(entriesBySection.get('stablecoins')).toEqual(
			expect.arrayContaining(['stablecoin/tether', 'stablecoins/ethereum'])
		)
		expect(entriesBySection.get('exchanges')).toEqual(expect.arrayContaining(['exchange/binance', 'exchange/coinbase']))
		// Listing pages that remain in the nav data are included in the static section.
		expect(entriesBySection.get('static')).toEqual(expect.arrayContaining(['cexs', 'mica']))
		expect(entriesBySection.get('static')).not.toContain('exchanges')
		expect(entriesBySection.get('static')).not.toContain('exchanges/charts')
		expect(entriesBySection.get('static')).not.toContain('markets')
		expect(entriesBySection.get('cexs')).toEqual(
			expect.arrayContaining([
				'cex/binance-cex',
				'cex/assets/binance-cex',
				'cex/stablecoins/binance-cex',
				'cex/no-markets-cex',
				'cex/assets/no-markets-cex',
				'cex/stablecoins/no-markets-cex'
			])
		)
		expect(entriesBySection.get('bridges')).toEqual(expect.arrayContaining(['bridge/stargate', 'bridges/ethereum']))
		expect(getSitemapSectionPath('protocols-by-category')).toBe('sitemap/protocols-by-category.xml')
		expect(entriesBySection.get('dat')).toEqual(
			expect.arrayContaining(['digital-asset-treasury/MSTR', 'digital-asset-treasuries/bitcoin'])
		)
		expect(entriesBySection.get('pre-ipo')).toEqual(
			expect.arrayContaining(['pre-ipo/anthropic', 'pre-ipo/commonwealth-fusion'])
		)
		expect(entriesBySection.get('rwa')).toEqual(
			expect.arrayContaining([
				'rwa/asset/ondo%2Fusdy',
				'rwa/perps/asset/s-p-500-index',
				'rwa/perps/contract/xyz%3Asp500',
				'rwa/perps/forex'
			])
		)
		expect(entriesBySection.get('rwa')).not.toContain('rwa/perps/category/rwa-perps')
		expect(entriesBySection.get('liquidations')).toEqual(
			expect.arrayContaining(['liquidations/aave', 'liquidations/aave/ethereum'])
		)
		expect(entriesBySection.get('liquidations')).not.toContain('liquidations/token/WETH')
		expect(new Set(allEntryPaths).size).toBe(allEntryPaths.length)
		expect(entriesBySection.get('raises')).toEqual(expect.arrayContaining(['raises/paradigm', 'raises/a16z']))
		expect(sections.map((section) => String(section.id))).not.toContain('tokens')
		expect(entriesBySection.get('narratives')).toEqual(expect.arrayContaining(['narrative-tracker/ai']))
		expect(getSitemapSectionPath('pro-dashboards')).toBe('sitemap/pro-dashboards.xml')
		expect(entriesBySection.get('pro-dashboards')).toEqual(
			expect.arrayContaining(['pro/empty-public-dashboard', 'pro/rich-public-dashboard'])
		)
		expect(sections.find((section) => section.id === 'pro-dashboards')?.entries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: 'pro/empty-public-dashboard',
					lastmod: '2026-01-02T00:00:00.000Z'
				}),
				expect.objectContaining({
					path: 'pro/rich-public-dashboard',
					lastmod: '2026-01-03T00:00:00.000Z'
				})
			])
		)
		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			expect.stringContaining('visibility=public&sortBy=popular&page=1&limit=100'),
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		)
	})

	it('resolves section ids from Next page params that include the .xml suffix', async () => {
		const section = await getSitemapSection('static.xml')

		expect(section?.id).toBe('static')
	})

	it('serves the previous sitemap snapshot while an expired cache refresh fails', async () => {
		const { getRaisesInvestorSlugsFromSnapshot } = await import('~/containers/Raises/server/routeData')
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

		await buildAppSitemapSections()
		vi.useFakeTimers({ now: Date.now() + 60 * 60 * 1000 + 1 })
		vi.mocked(getRaisesInvestorSlugsFromSnapshot).mockRejectedValueOnce(new Error('refresh failed'))

		const section = await getSitemapSection('raises.xml')

		expect(section?.entries.map((entry) => entry.path)).toEqual(
			expect.arrayContaining(['raises/paradigm', 'raises/a16z'])
		)
		await vi.waitFor(() => {
			expect(warnSpy).toHaveBeenCalledWith('[sitemap] failed to build raises section', expect.any(Error))
		})
		warnSpy.mockRestore()
	})

	it('keeps building other sitemap sections when one cold section fails', async () => {
		const { getRaisesInvestorSlugsFromSnapshot } = await import('~/containers/Raises/server/routeData')
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		vi.mocked(getRaisesInvestorSlugsFromSnapshot).mockRejectedValueOnce(new Error('snapshot unavailable'))
		vi.resetModules()
		const sitemapModule = await import('~/server/routeRegistry/sitemap')

		const sections = await sitemapModule.buildAppSitemapSections()
		const entriesBySection = new Map(
			sections.map((section) => [section.id, section.entries.map((entry) => entry.path)])
		)

		expect(entriesBySection.get('chains')).toEqual(expect.arrayContaining(['chain/ethereum']))
		expect(entriesBySection.get('raises')).toEqual([])
		expect(warnSpy).toHaveBeenCalledWith('[sitemap] failed to build raises section', expect.any(Error))
		warnSpy.mockRestore()
	})
})
