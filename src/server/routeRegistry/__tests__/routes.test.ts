import { describe, expect, it } from 'vitest'
import { getCanonicalCexSlugsFromMetadata, resolveCexParamFromMetadata } from '~/containers/Cexs/server/routes'
import {
	getChainMetricSlugsFromMetadata,
	getChainSlugsFromMetadata,
	resolveChainParamFromMetadata
} from '~/containers/ChainOverview/server/routes'
import {
	getProtocolFeatureSlugsFromMetadata,
	getProtocolOverviewSlugsFromMetadata,
	resolveProtocolParamFromMetadata
} from '~/containers/ProtocolOverview/server/routes'
import {
	getProtocolListingSlugsFromMetadata,
	resolveProtocolListingParamFromMetadata
} from '~/containers/ProtocolTaxonomy/server/routes'
import type { MetadataCache } from '~/utils/metadata/artifactContract'

function metadataFixture(): MetadataCache {
	return {
		chainMetadata: {
			ethereum: { name: 'Ethereum', id: 'ethereum', stablecoins: true, fees: true },
			'zkSync-era': { name: 'zkSync Era', id: 'era', stablecoins: true }
		},
		chainRouteKeyBySlug: {
			ethereum: 'ethereum',
			'zksync-era': 'zkSync-era',
			era: 'zkSync-era'
		},
		protocolMetadata: {
			aave: { name: 'aave', displayName: 'Aave V3', tvl: true, fees: true },
			uniswap: { name: 'uniswap-v3', displayName: 'Uniswap V3', tvl: true, dexs: true },
			bridge: { name: 'bridge', displayName: 'Bridge Child', tvl: true, category: 'Bridge' },
			child: { name: 'child-v2', displayName: 'Child V2', tvl: true, parentProtocol: 'parent#child' },
			binance: { name: 'binance-cex', displayName: 'Binance CEX', tvl: true, stablecoins: true, cex: true },
			nameless: { tvl: true }
		},
		protocolRouteIdBySlug: {
			aave: 'aave',
			'aave-v3': 'aave',
			'uniswap-v3': 'uniswap',
			bridge: 'bridge',
			'bridge-child': 'bridge',
			child: 'child',
			'child-v2': 'child',
			nameless: 'nameless'
		},
		categoriesAndTags: {
			categories: ['Dexs', 'Lending'],
			tags: ['Lending'],
			tagCategoryMap: { Lending: 'Lending' },
			configs: {}
		},
		protocolCategoryBySlug: {
			dexs: 'Dexs',
			lending: 'Lending'
		},
		protocolTagBySlug: {
			lending: 'Lending'
		},
		cexs: [
			{ name: 'Binance', slug: 'binance-cex', coin: 'BNB' },
			{ name: 'Binance Alias', slug: 'binance-alias' }
		],
		cexRouteIdBySlug: {
			binance: 'binance',
			'binance-cex': 'binance'
		},
		cexMetadataBySlug: {
			'binance-cex': { name: 'Binance', slug: 'binance-cex', coin: 'BNB' },
			'binance-alias': { name: 'Binance Alias', slug: 'binance-alias' }
		},
		rwaList: { canonicalMarketIds: [], platforms: [], chains: [], categories: [], assetGroups: [], idMap: {} },
		rwaPlatformsIndex: { generatedAt: 0, byPid: {}, platforms: {} },
		rwaPerpsList: { contracts: [], venues: [], categories: [], assetGroups: [], total: 0 },
		tokenlist: {},
		tokenDirectory: {},
		tokenDirectoryRecordByRouteSegment: {},
		protocolDisplayNames: new Map(),
		chainDisplayNames: new Map(),
		chainCategories: [],
		liquidationsTokenSymbols: [],
		liquidationsTokenSymbolsSet: new Set(),
		emissionsProtocolsList: [],
		emissionsProtocolBySlug: {},
		emissionsSupplyMetrics: {},
		emissionsHistoricalPrices: {},
		cgExchangeIdentifiers: [],
		bridgeProtocolSlugs: [],
		bridgeProtocolSlugsSet: new Set(),
		bridgeChainSlugs: [],
		bridgeChainSlugsSet: new Set(),
		bridgeChainSlugToName: {},
		protocolLlamaswapDataset: {},
		narrativeCategories: { ids: [], nameById: {} },
		narrativeCategoryIdsSet: new Set(),
		oracleRoutes: { oracleNameBySlug: {}, chainNameBySlug: {}, chainSlugsByOracleSlug: {} },
		digitalAssetTreasuryRoutes: { assetSlugs: [], companySlugs: [] },
		digitalAssetTreasuryAssetSlugsSet: new Set(),
		digitalAssetTreasuryCompanyRouteBySlug: {},
		stablecoinPeggedAssetSlugs: [],
		stablecoinPeggedAssetSlugsSet: new Set(),
		equitiesCompanyRoutes: [],
		equitiesCompanySlugsSet: new Set()
	}
}

describe('route cache readers', () => {
	it('resolves protocol params through display-name slugs first', () => {
		const route = resolveProtocolParamFromMetadata('Aave-V3', metadataFixture())

		expect(route).toEqual({
			id: 'aave',
			metadata: expect.objectContaining({ displayName: 'Aave V3' }),
			canonicalSlug: 'aave-v3'
		})
	})

	it('keeps protocol overview caps and route filters in cache-backed recipes', () => {
		const slugs = getProtocolOverviewSlugsFromMetadata(metadataFixture(), 10)

		expect(slugs).toEqual(['aave-v3', 'uniswap-v3', 'child'])
	})

	it('excludes CEX metadata from generic protocol routes', () => {
		const metadata = metadataFixture()

		expect(resolveProtocolParamFromMetadata('Binance CEX', metadata)).toBeNull()
		expect(getProtocolFeatureSlugsFromMetadata(metadata, (protocol) => Boolean(protocol.tvl))).not.toContain(
			'binance-cex'
		)
	})

	it('falls back to protocol slugs when parent protocol normalizes empty', () => {
		const metadata = metadataFixture()
		metadata.protocolMetadata.emptyParent = {
			name: 'empty-parent',
			displayName: 'Empty Parent',
			tvl: true,
			parentProtocol: 'parent#'
		}

		const slugs = getProtocolOverviewSlugsFromMetadata(metadata, 10)

		expect(slugs).toContain('empty-parent')
		expect(slugs).not.toContain('')
	})

	it('generates feature slugs from protocol metadata flags', () => {
		expect(getProtocolFeatureSlugsFromMetadata(metadataFixture(), (metadata) => Boolean(metadata.dexs))).toEqual([
			'uniswap-v3'
		])
	})

	it('resolves chain variants to canonical names', () => {
		const route = resolveChainParamFromMetadata('zksync era', metadataFixture())

		expect(route).toEqual({
			metadata: expect.objectContaining({ name: 'zkSync Era' }),
			canonicalSlug: 'zksync-era',
			canonicalName: 'zkSync Era'
		})
	})

	it('builds chain feature slugs from chain metadata flags', () => {
		const metadata = metadataFixture()
		const ethereum = metadata.chainMetadata.ethereum
		const zkSyncEra = metadata.chainMetadata['zkSync-era']
		if (!ethereum || !zkSyncEra) throw new Error('Expected route metadata fixtures')
		ethereum.optionsNotionalVolume = true
		zkSyncEra.optionsPremiumVolume = true

		expect(getChainSlugsFromMetadata(metadata)).toEqual(['ethereum', 'zksync-era'])
		expect(getChainMetricSlugsFromMetadata(metadata, 'fees')).toEqual(['ethereum'])
		expect(getChainMetricSlugsFromMetadata(metadata, 'optionsNotionalVolume')).toEqual(['ethereum'])
		expect(getChainMetricSlugsFromMetadata(metadata, 'optionsPremiumVolume')).toEqual(['zksync-era'])
	})

	it('resolves CEX params through canonical slug or aliases', () => {
		const metadata = metadataFixture()

		expect(getCanonicalCexSlugsFromMetadata(metadata)).toEqual(['binance-cex'])
		expect(resolveCexParamFromMetadata('Binance', metadata)).toEqual({
			id: 'binance',
			metadata: expect.objectContaining({ name: 'binance-cex' }),
			cexMetadata: expect.objectContaining({ name: 'Binance', coin: 'BNB' }),
			canonicalSlug: 'binance-cex'
		})
		expect(resolveCexParamFromMetadata('Binance CEX', metadata)).toEqual({
			id: 'binance',
			metadata: expect.objectContaining({ name: 'binance-cex' }),
			cexMetadata: expect.objectContaining({ name: 'Binance', coin: 'BNB' }),
			canonicalSlug: 'binance-cex'
		})
		expect(resolveCexParamFromMetadata('binance-cex', metadata)).toEqual({
			id: 'binance',
			metadata: expect.objectContaining({ name: 'binance-cex' }),
			cexMetadata: expect.objectContaining({ name: 'Binance', coin: 'BNB' }),
			canonicalSlug: 'binance-cex'
		})
	})

	it('dedupes protocol listing slugs from categories and tags', () => {
		expect(getProtocolListingSlugsFromMetadata(metadataFixture())).toEqual(['lending'])
	})

	it('resolves protocol listing params to canonical slug routes', () => {
		expect(resolveProtocolListingParamFromMetadata('Lending', metadataFixture())).toEqual({
			kind: 'category',
			value: 'Lending',
			canonicalSlug: 'lending'
		})
	})
})
