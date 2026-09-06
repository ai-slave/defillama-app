import { describe, expect, test } from 'vitest'
import {
	METADATA_ARTIFACT_KEYS,
	METADATA_ARTIFACT_FILES,
	METADATA_ARTIFACT_REGISTRY,
	METADATA_CI_STUBS,
	applyMetadataRefresh,
	createMetadataCacheFromArtifacts,
	getMetadataArtifactEntries,
	validateCoreMetadataPayload,
	type CoreMetadataPayload
} from '../artifactContract'

const tokenEntry = {
	symbol: 'AAVE',
	current_price: null,
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

function createPayload(overrides: Partial<CoreMetadataPayload> = {}): CoreMetadataPayload {
	return {
		protocols: { 'parent#aave': { name: 'aave', displayName: 'Aave', tvl: true } },
		chains: { Ethereum: { name: 'Ethereum', id: 'ethereum' } },
		categoriesAndTags: { categories: [], tags: [], tagCategoryMap: {}, configs: {} },
		cexs: [],
		rwaList: { canonicalMarketIds: [], platforms: [], chains: [], categories: [], assetGroups: [], idMap: {} },
		rwaPlatformsIndex: { generatedAt: 0, byPid: {}, platforms: {} },
		rwaPerpsList: { contracts: [], venues: [], categories: [], assets: [], assetGroups: [], total: 0 },
		tokenlist: { aave: tokenEntry },
		tokenDirectory: { aave: { name: 'Aave', symbol: 'AAVE', route: '/token/AAVE' } },
		protocolDisplayNames: { aave: 'Aave' },
		chainDisplayNames: { ethereum: 'Ethereum' },
		chainCategories: ['EVM'],
		liquidationsTokenSymbols: ['ETH'],
		emissionsProtocolsList: ['aave'],
		emissionsSupplyMetrics: {},
		emissionsHistoricalPrices: {},
		cgExchangeIdentifiers: ['binance'],
		bridgeProtocolSlugs: ['stargate'],
		bridgeChainSlugs: ['ethereum'],
		bridgeChainSlugToName: { ethereum: 'Ethereum' },
		narrativeCategories: { ids: ['ai'], nameById: { ai: 'AI' } },
		oracleRoutes: {
			oracleNameBySlug: { chainlink: 'Chainlink' },
			chainNameBySlug: { ethereum: 'Ethereum' },
			chainSlugsByOracleSlug: { chainlink: ['ethereum'] }
		},
		digitalAssetTreasuryRoutes: { assetSlugs: ['bitcoin'], companySlugs: ['MSTR'] },
		stablecoinPeggedAssetSlugs: ['tether'],
		equitiesCompanyRoutes: [{ ticker: 'NVDA', country: 'US' }],
		preIpoCompanyIds: ['anthropic'],
		tokenFilterMetadata: {
			schemaVersion: 2,
			generatedAt: 1,
			sources: { coingeckoCatalogGeneratedAt: 1, rankingsUpdatedAt: null },
			tokens: { aave: { chains: ['ethereum'], primaryChain: null, categories: ['governance'] } },
			categories: [{ id: 'governance', label: 'Governance' }]
		},
		...overrides
	}
}

describe('metadata artifact contract', () => {
	test('declares a registry entry for every payload key', () => {
		expect(METADATA_ARTIFACT_KEYS.toSorted()).toEqual(Object.keys(createPayload()).toSorted())

		for (const key of METADATA_ARTIFACT_KEYS) {
			const artifact = METADATA_ARTIFACT_REGISTRY[key]
			expect(artifact.file).toMatch(/\.json$/)
			expect(artifact.file).not.toContain('..')
			expect(artifact.parse(artifact.stub, artifact.file)).toBe(artifact.stub)
		}
	})

	test('lists every generated artifact filename once', () => {
		const artifactFiles = Object.values(METADATA_ARTIFACT_FILES)
		expect(new Set(artifactFiles).size).toBe(artifactFiles.length)
		expect(
			getMetadataArtifactEntries(createPayload())
				.map(([file]) => file)
				.toSorted()
		).toEqual(artifactFiles.toSorted())
	})

	test('provides CI stubs for every generated artifact', () => {
		expect(
			getMetadataArtifactEntries(METADATA_CI_STUBS)
				.map(([file]) => file)
				.toSorted()
		).toEqual(Object.values(METADATA_ARTIFACT_FILES).toSorted())
	})

	test('creates runtime metadata lookups from artifact payloads', () => {
		const metadata = createMetadataCacheFromArtifacts(createPayload())

		expect(metadata.protocolMetadata['parent#aave']).toMatchObject({ displayName: 'Aave' })
		expect(metadata.protocolRouteIdBySlug.aave).toBe('parent#aave')
		expect(metadata.protocolDisplayNames.get('aave')).toBe('Aave')
		expect(metadata.chainRouteKeyBySlug.ethereum).toBe('Ethereum')
		expect(metadata.chainDisplayNames.get('ethereum')).toBe('Ethereum')
		expect(metadata.chainCategories).toEqual(['EVM'])
		expect(metadata.rwaPlatformsIndex).toEqual({ generatedAt: 0, byPid: {}, platforms: {} })
		expect(metadata.liquidationsTokenSymbolsSet.has('ETH')).toBe(true)
		expect(metadata.emissionsProtocolBySlug.aave).toBe('aave')
		expect(metadata.bridgeProtocolSlugsSet.has('stargate')).toBe(true)
		expect(metadata.bridgeChainSlugsSet.has('ethereum')).toBe(true)
		expect(metadata.narrativeCategoryIdsSet.has('ai')).toBe(true)
		expect(metadata.oracleRoutes.oracleNameBySlug.chainlink).toBe('Chainlink')
		expect(metadata.tokenDirectoryRecordByRouteSegment.AAVE?.symbol).toBe('AAVE')
		expect(metadata.digitalAssetTreasuryAssetSlugsSet.has('bitcoin')).toBe(true)
		expect(metadata.digitalAssetTreasuryCompanyRouteBySlug.mstr).toBe('MSTR')
		expect(metadata.stablecoinPeggedAssetSlugsSet.has('tether')).toBe(true)
		expect(metadata.equitiesCompanySlugsSet.has('NVDA:US')).toBe(true)
		expect(metadata.preIpoCompanyIdsSet.has('anthropic')).toBe(true)
	})

	test('applies refresh payloads directly', () => {
		const metadata = createMetadataCacheFromArtifacts(createPayload())

		applyMetadataRefresh(
			metadata,
			createPayload({
				protocols: {},
				protocolDisplayNames: {},
				tokenDirectory: {},
				tokenlist: {},
				narrativeCategories: { ids: ['meme'], nameById: { meme: 'Meme' } },
				stablecoinPeggedAssetSlugs: ['usd-coin']
			})
		)

		expect(metadata.protocolMetadata).toEqual({})
		expect(metadata.protocolDisplayNames.size).toBe(0)
		expect(metadata.tokenDirectory).toEqual({})
		expect(metadata.tokenlist).toEqual({})
		expect(metadata.narrativeCategoryIdsSet.has('meme')).toBe(true)
		expect(metadata.stablecoinPeggedAssetSlugsSet.has('usd-coin')).toBe(true)
	})

	test('rebuilds chain display-name fallbacks during refresh', () => {
		const metadata = createMetadataCacheFromArtifacts(createPayload())

		applyMetadataRefresh(
			metadata,
			createPayload({
				chains: {
					Arbitrum: { name: 'Arbitrum One', id: 'arbitrum' }
				},
				chainDisplayNames: {}
			})
		)

		expect(metadata.chainDisplayNames.get('Arbitrum')).toBe('Arbitrum One')
		expect(metadata.chainDisplayNames.get('arbitrum-one')).toBe('Arbitrum One')
		expect(metadata.chainDisplayNames.get('arbitrum')).toBe('Arbitrum One')
	})

	test('allows smaller but valid refresh payloads', () => {
		const payload = createPayload({
			chains: {}
		})

		expect(validateCoreMetadataPayload(payload).chains).toEqual({})
	})

	test('accepts backend-owned artifact shapes without revalidating them', () => {
		const payload = createPayload({
			chains: [] as unknown as CoreMetadataPayload['chains']
		})

		expect(validateCoreMetadataPayload(payload).chains).toEqual([])
	})

	test('accepts nested backend-owned fields without revalidating them', () => {
		const payload = createPayload({
			tokenDirectory: {
				aave: { name: 'Aave' }
			} as unknown as CoreMetadataPayload['tokenDirectory'],
			categoriesAndTags: {
				categories: ['Lending'],
				tags: [1],
				tagCategoryMap: {},
				configs: {}
			} as unknown as CoreMetadataPayload['categoriesAndTags']
		})

		expect(validateCoreMetadataPayload(payload).tokenDirectory).toEqual({ aave: { name: 'Aave' } })
	})
})

describe('routes for renamed protocols', () => {
	test('resolves a protocol by a name it used to have', () => {
		const metadata = createMetadataCacheFromArtifacts(
			createPayload({
				protocols: {
					'parent#aave': { name: 'aave', displayName: 'Aave', previousNames: ['Aave V1'], tvl: true }
				}
			})
		)

		expect(metadata.protocolRouteIdBySlug['aave-v1']).toBe('parent#aave')
		expect(metadata.protocolRouteIdBySlug.aave).toBe('parent#aave')
	})

	test('resolves an exchange by every name it used to have', () => {
		const metadata = createMetadataCacheFromArtifacts(
			createPayload({
				protocols: {
					'7248': { name: 'osl-exchange', displayName: 'OSL Exchange', previousNames: ['OSL HK', 'OSL'], cex: true }
				}
			})
		)

		expect(metadata.cexRouteIdBySlug['osl-exchange']).toBe('7248')
		expect(metadata.cexRouteIdBySlug['osl-hk']).toBe('7248')
		expect(metadata.cexRouteIdBySlug['osl']).toBe('7248')
	})

	// setSlugAlias is first-wins, so registering previous names in the same pass as current
	// ones would hand the route to whichever protocol object key order reached first.
	test('never lets an abandoned name outrank the protocol that carries it now', () => {
		const renamed = { name: 'new-name', displayName: 'New Name', previousNames: ['Shared'], tvl: true }
		const current = { name: 'shared', displayName: 'Shared', tvl: true }

		for (const protocols of [
			{ renamed, current },
			{ current, renamed }
		]) {
			const metadata = createMetadataCacheFromArtifacts(createPayload({ protocols }))

			expect(metadata.protocolRouteIdBySlug.shared).toBe('current')
		}
	})

	test('never lets an abandoned exchange name outrank the exchange that carries it now', () => {
		const renamed = { name: 'new-exchange', displayName: 'New Exchange', previousNames: ['Shared'], cex: true }
		const current = { name: 'shared', displayName: 'Shared', cex: true }

		for (const protocols of [
			{ renamed, current },
			{ current, renamed }
		]) {
			const metadata = createMetadataCacheFromArtifacts(createPayload({ protocols }))

			expect(metadata.cexRouteIdBySlug.shared).toBe('current')
		}
	})
})

describe('token filter schema compatibility', () => {
	test('converts legacy native chains only at the artifact boundary', () => {
		const artifact = METADATA_ARTIFACT_REGISTRY.tokenFilterMetadata.parse({
			...createPayload().tokenFilterMetadata,
			schemaVersion: 1,
			tokens: {
				aave: { chains: ['ethereum', 'base'], nativeChains: ['ethereum', 'base'], categories: ['governance'] },
				missing: { chains: ['base'], categories: [] }
			}
		})
		expect(artifact.schemaVersion).toBe(2)
		expect(artifact.tokens.aave.primaryChain).toBe('ethereum')
		expect(artifact.tokens.aave).not.toHaveProperty('nativeChains')
		expect(artifact.tokens.missing.primaryChain).toBeNull()
	})

	test('preserves schema 2 primary chains and rejects unsupported schemas', () => {
		const parse = METADATA_ARTIFACT_REGISTRY.tokenFilterMetadata.parse
		const artifact = createPayload().tokenFilterMetadata
		expect(parse(artifact)).toBe(artifact)
		expect(parse({ ...artifact, schemaVersion: 3 }).tokens).toEqual({})
	})
})
