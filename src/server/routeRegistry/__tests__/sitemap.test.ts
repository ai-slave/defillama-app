import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { FEATURES_SERVER } from '~/constants'
import {
	getProtocolSitemapRoutes,
	getStandaloneProtocolSitemapRoutes
} from '~/containers/ProtocolOverview/server/routes'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'

const METADATA: MetadataCache = {
	chainMetadata: {
		ethereum: { name: 'Ethereum', id: 'ethereum', stablecoins: true, fees: true }
	},
	chainRouteKeyBySlug: {
		ethereum: 'ethereum'
	},
	protocolMetadata: {
		aave: { name: 'aave', displayName: 'Aave', tvl: true, fees: true, emissions: true, borrowed: true },
		uniswap: { name: 'uniswap', displayName: 'Uniswap', dexs: true },
		'defi-swap': { name: 'Defi Swap', displayName: 'Defi Swap', tvl: true, fees: true, dexs: true, borrowed: true },
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
}

const raisesInvestors = vi.hoisted(() => ({ fail: false }))

vi.mock('~/containers/LiquidationsV2/server/dataset.server', () => ({
	getLiquidationsSitemapProtocolChains: async () => [{ protocolId: 'aave', chainIds: ['ethereum'] }]
}))

vi.mock('~/containers/Raises/server/dataset.server', () => ({
	fetchRaisesFromSnapshot: async () => {
		if (raisesInvestors.fail) throw new Error('snapshot unavailable')
		return { raises: [{ leadInvestors: ['Paradigm'], otherInvestors: ['a16z'] }] }
	}
}))

const yieldsEarn = vi.hoisted(() => ({
	rows: [
		{ id: 'not-a-pool', tvl_usd: 9_000_000_000 },
		{ id: '790dea85-6c21-55d6-89f8-810be03209b0', tvl_usd: 9_000_000_000 },
		{ id: 'aa70268e-4b52-42bf-a116-608b370f9501', tvl_usd: 2_400_000_000 },
		{ id: 'aa70268e-4b52-42bf-a116-608b370f9501', tvl_usd: 1 },
		{ id: '66985a81-9c1e-4b0a-9c1e-4b0a9c1e4b0a', tvl_usd: 1_000_000_000 },
		{ id: '665dc8bc-1111-4111-8111-111111111111', tvl_usd: null }
	],
	borrow: [
		{ id: 'aa70268e-4b52-42bf-a116-608b370f9501', total_supply_usd: 1 },
		{ id: 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0', total_supply_usd: 500 },
		{ id: '790dea85-6c21-55d6-89f8-810be03209b0', total_supply_usd: 9_000_000_000 },
		{ id: 'not-a-market', total_supply_usd: 10 }
	]
}))

vi.mock('~/containers/Yields/server/dataset.server', async (importOriginal) => {
	const actual = await importOriginal<typeof import('~/containers/Yields/server/dataset.server')>()
	const { yieldsSnapshot } = await import('~/utils/testing/yieldsSnapshotFixture')
	return {
		...actual,
		acquireYieldsSnapshot: async () =>
			yieldsSnapshot({ earn: yieldsEarn.rows as never, borrowMarkets: yieldsEarn.borrow as never })
	}
})

vi.mock('~/containers/Markets/server/dataset.server', () => ({
	fetchExchangeDirectory: async () => ({ venues: [{ slug: 'binance' }, { slug: 'coinbase' }] }),
	fetchCexExchangeSlugIndex: async () => ({
		'binance-cex': {
			exchange: 'binance',
			defillama_slug: 'binance-cex',
			rank: null,
			spot_volume_24h: null,
			usd_perp_volume_24h: null,
			usd_perp_oi_usd: null,
			volume_7d: []
		}
	})
}))

const http = installFixtureFetch()
let sitemap: typeof import('~/server/routeRegistry/sitemap')

// Each test loads a cold sitemap cache over the real metadata module, seeded with METADATA.
beforeEach(async () => {
	raisesInvestors.fail = false
	vi.resetModules()
	Object.assign((await import('~/utils/metadata')).default, METADATA)
	sitemap = await import('~/server/routeRegistry/sitemap')
	http.serve({
		[`${FEATURES_SERVER}/dashboards/search`]: {
			items: [
				{ id: 'empty-public-dashboard', visibility: 'public', updated: '2026-01-02T00:00:00.000Z' },
				{
					id: '11111111-1111-4111-8111-111111111111',
					slug: 'rich-public-dashboard',
					visibility: 'public',
					editedAt: '2026-01-03T00:00:00.000Z'
				}
			],
			totalPages: 1
		}
	})
})

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
})

describe('cache-backed sitemap sections', () => {
	test('omits governance and noindex protocol tabs while retaining standalone unlocks', () => {
		// A cache written before governance routes were removed still carries the flag.
		const legacyAave = { ...METADATA.protocolMetadata.aave, tokenRights: true, governance: true }
		const legacy: MetadataCache = {
			...METADATA,
			protocolMetadata: { ...METADATA.protocolMetadata, aave: legacyAave }
		}
		const standaloneRoutes = getStandaloneProtocolSitemapRoutes(legacy)
		const paths = [...getProtocolSitemapRoutes(legacy), ...Object.values(standaloneRoutes).flat()]

		expect(standaloneRoutes).not.toHaveProperty('governance')
		expect(paths.some((path) => /^(?:protocol\/)?governance(?:\/|$)/.test(path))).toBe(false)
		expect(paths).toContain('unlocks/aave')
		expect(paths).toContain('protocol/aave')
		expect(paths).toContain('protocol/active-loans/aave')
		expect(paths).not.toContain('protocol/token-rights/aave')
		expect(paths).not.toContain('protocol/tvl/aave')
		expect(paths).not.toContain('protocol/unlocks/aave')
		expect(paths).not.toContain('protocol/forks/aave')
	})

	test('builds grouped public routes from metadata and dataset snapshots only', async () => {
		const sections = await sitemap.buildAppSitemapSections()
		const entriesBySection = new Map(
			sections.map((section) => [section.id, section.entries.map((entry) => entry.path)])
		)
		const allEntryPaths = sections.flatMap((section) => section.entries.map((entry) => entry.path))

		expect(sections.map((section) => String(section.id))).not.toContain('governance')
		expect(allEntryPaths).not.toContain('governance')
		expect(allEntryPaths).toContain('token-rights')
		expect(entriesBySection.get('protocols')).toEqual(
			expect.arrayContaining(['protocol/aave', 'protocol/active-loans/aave', 'protocol/uniswap'])
		)
		expect(entriesBySection.get('protocols')).not.toContain('protocol/fees/aave')
		expect(entriesBySection.get('protocols')).not.toContain('protocol/tvl/aave')
		expect(entriesBySection.get('protocols')).not.toContain('protocol/dexs/uniswap')
		expect(entriesBySection.get('protocols')).not.toContain('protocol/unlocks/aave')
		expect(entriesBySection.get('protocols')).not.toContain('protocol/defi-swap')
		expect(entriesBySection.get('protocols')).not.toContain('protocol/active-loans/defi-swap')
		expect(entriesBySection.get('protocols')).not.toContain('protocol/binance-cex')
		expect(entriesBySection.get('yields')).toEqual([
			'yields/pool/aa70268e-4b52-42bf-a116-608b370f9501',
			'yields/pool/66985a81-9c1e-4b0a-9c1e-4b0a9c1e4b0a',
			'yields/pool/b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0',
			'yields/pool/665dc8bc-1111-4111-8111-111111111111'
		])
		expect(entriesBySection.get('yields')).not.toContain('yields/pool/790dea85-6c21-55d6-89f8-810be03209b0')
		expect(entriesBySection.get('chains')).toEqual(expect.arrayContaining(['chain/ethereum', 'fees/chain/ethereum']))
		expect(entriesBySection.get('stablecoins')).toEqual(
			expect.arrayContaining(['stablecoin/tether', 'stablecoins/ethereum'])
		)
		expect(entriesBySection.get('exchanges')).toEqual(expect.arrayContaining(['exchange/binance', 'exchange/coinbase']))
		// Listing pages that remain in the nav data are included in the static section.
		expect(entriesBySection.get('static')).toEqual(expect.arrayContaining(['cexs', 'mica']))
		// Pages kept out of the nav but still indexable are added to the static section.
		expect(entriesBySection.get('static')).toContain('yields/stablecoins')
		expect(entriesBySection.get('static')).toEqual(
			expect.arrayContaining(['exchanges', 'exchanges/rank', 'exchanges/tokens', 'ramp'])
		)
		expect(entriesBySection.get('static')).toContain('exchanges/charts')
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
				'rwa/perps/contract/xyz%3Asp500'
			])
		)
		expect(entriesBySection.get('rwa')).not.toContain('rwa/perps/category/rwa-perps')
		expect(entriesBySection.get('rwa')).not.toContain('rwa/perps/forex')
		expect(entriesBySection.get('liquidations')).toEqual(
			expect.arrayContaining(['liquidations/aave', 'liquidations/aave/ethereum'])
		)
		expect(entriesBySection.get('liquidations')).not.toContain('liquidations/token/WETH')
		expect(new Set(allEntryPaths).size).toBe(allEntryPaths.length)
		expect(entriesBySection.get('raises')).toEqual(expect.arrayContaining(['raises/paradigm', 'raises/a16z']))
		expect(sections.map((section) => String(section.id))).not.toContain('tokens')
		expect(entriesBySection.get('narratives')).toEqual(expect.arrayContaining(['narrative-tracker/ai']))
		expect(entriesBySection.get('pro-dashboards')).toEqual(
			expect.arrayContaining(['pro/empty-public-dashboard', 'pro/rich-public-dashboard'])
		)
		expect(allEntryPaths).not.toContain('pro/11111111-1111-4111-8111-111111111111')
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
	})

	test('resolves section ids from Next page params that include the .xml suffix', async () => {
		const section = await sitemap.getSitemapSection('static.xml')

		expect(section?.id).toBe('static')
	})

	test('serves the previous sitemap snapshot while an expired cache refresh fails', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

		await sitemap.buildAppSitemapSections()
		vi.useFakeTimers({ now: Date.now() + 60 * 60 * 1000 + 1 })
		raisesInvestors.fail = true

		const section = await sitemap.getSitemapSection('raises.xml')

		expect(section?.entries.map((entry) => entry.path)).toEqual(
			expect.arrayContaining(['raises/paradigm', 'raises/a16z'])
		)
		await vi.waitFor(
			() => expect(warnSpy).toHaveBeenCalledWith('[sitemap] failed to build raises section', expect.any(Error)),
			{ timeout: 500 }
		)
	})

	test('keeps building other sitemap sections when one cold section fails', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
		raisesInvestors.fail = true

		const sections = await sitemap.buildAppSitemapSections()
		const entriesBySection = new Map(
			sections.map((section) => [section.id, section.entries.map((entry) => entry.path)])
		)

		expect(entriesBySection.get('chains')).toEqual(expect.arrayContaining(['chain/ethereum']))
		expect(entriesBySection.get('raises')).toEqual([])
		expect(warnSpy).toHaveBeenCalledWith('[sitemap] failed to build raises section', expect.any(Error))
	})
})
