import type { IEquitiesCompanyRoute } from '~/containers/Equities/api.types'
import type { RWAPlatformsIndex } from '~/containers/RWA/PlatformPage/api.types'
import type { ProtocolEmissionSupplyMetricsMap } from '~/containers/Unlocks/api.types'
import { slug } from '~/utils'
import {
	createTokenDirectoryRecordByRouteSegment,
	type TokenDirectory,
	type TokenDirectoryRecordByRouteSegment
} from '~/utils/tokenDirectory'
import { buildChainDisplayNameLookupRecord, createStringLookupMap } from './displayLookups'
import type {
	DigitalAssetTreasuryRoutesMetadata,
	NarrativeCategoriesMetadata,
	OracleRoutesMetadata
} from './routeIndexes'
import { EMPTY_TOKEN_FILTER_METADATA, parseTokenFilterMetadata, type TokenFilterMetadataArtifact } from './tokenFilters'
import type {
	ICategoriesAndTags,
	ICexItem,
	IChainMetadata,
	IEmissionsHistoricalPrices,
	IProtocolMetadata,
	IRWAList,
	IRWAPerpsList,
	ITokenListEntry
} from './types'

export type CoreMetadataPayload = {
	protocols: Record<string, IProtocolMetadata>
	chains: Record<string, IChainMetadata>
	categoriesAndTags: ICategoriesAndTags
	cexs: Array<ICexItem>
	rwaList: IRWAList
	rwaPlatformsIndex: RWAPlatformsIndex
	rwaPerpsList: IRWAPerpsList
	tokenlist: Record<string, ITokenListEntry>
	tokenDirectory: TokenDirectory
	protocolDisplayNames: Record<string, string>
	chainDisplayNames: Record<string, string>
	chainCategories: Array<string>
	liquidationsTokenSymbols: Array<string>
	emissionsProtocolsList: Array<string>
	emissionsSupplyMetrics: ProtocolEmissionSupplyMetricsMap
	emissionsHistoricalPrices: IEmissionsHistoricalPrices
	cgExchangeIdentifiers: Array<string>
	bridgeProtocolSlugs: Array<string>
	bridgeChainSlugs: Array<string>
	bridgeChainSlugToName: Record<string, string>
	narrativeCategories: NarrativeCategoriesMetadata
	oracleRoutes: OracleRoutesMetadata
	digitalAssetTreasuryRoutes: DigitalAssetTreasuryRoutesMetadata
	stablecoinPeggedAssetSlugs: Array<string>
	equitiesCompanyRoutes: Array<IEquitiesCompanyRoute>
	preIpoCompanyIds: Array<string>
	tokenFilterMetadata: TokenFilterMetadataArtifact
}

// Serialized artifacts intentionally differ from this runtime shape: the cache
// adds Maps/Sets and historical field names that are consumed throughout pages.
export type MetadataCache = {
	chainMetadata: Record<string, IChainMetadata>
	chainRouteKeyBySlug: Record<string, string>
	protocolMetadata: Record<string, IProtocolMetadata>
	protocolRouteIdBySlug: Record<string, string>
	categoriesAndTags: ICategoriesAndTags
	protocolCategoryBySlug: Record<string, string>
	protocolTagBySlug: Record<string, string>
	cexs: Array<ICexItem>
	cexRouteIdBySlug: Record<string, string>
	cexMetadataBySlug: Record<string, ICexItem>
	rwaList: IRWAList
	rwaPlatformsIndex: RWAPlatformsIndex
	rwaPerpsList: IRWAPerpsList
	tokenlist: Record<string, ITokenListEntry>
	tokenDirectory: TokenDirectory
	tokenDirectoryRecordByRouteSegment: TokenDirectoryRecordByRouteSegment
	protocolDisplayNames: Map<string, string>
	chainDisplayNames: Map<string, string>
	chainCategories: Array<string>
	liquidationsTokenSymbols: Array<string>
	liquidationsTokenSymbolsSet: Set<string>
	emissionsProtocolsList: Array<string>
	emissionsProtocolBySlug: Record<string, string>
	emissionsSupplyMetrics: ProtocolEmissionSupplyMetricsMap
	emissionsHistoricalPrices: IEmissionsHistoricalPrices
	cgExchangeIdentifiers: Array<string>
	bridgeProtocolSlugs: Array<string>
	bridgeProtocolSlugsSet: Set<string>
	bridgeChainSlugs: Array<string>
	bridgeChainSlugsSet: Set<string>
	bridgeChainSlugToName: Record<string, string>
	narrativeCategories: NarrativeCategoriesMetadata
	narrativeCategoryIdsSet: Set<string>
	oracleRoutes: OracleRoutesMetadata
	digitalAssetTreasuryRoutes: DigitalAssetTreasuryRoutesMetadata
	digitalAssetTreasuryAssetSlugsSet: Set<string>
	digitalAssetTreasuryCompanyRouteBySlug: Record<string, string>
	stablecoinPeggedAssetSlugs: Array<string>
	stablecoinPeggedAssetSlugsSet: Set<string>
	equitiesCompanyRoutes: Array<IEquitiesCompanyRoute>
	equitiesCompanySlugsSet: Set<string>
	preIpoCompanyIds: Array<string>
	preIpoCompanyIdsSet: Set<string>
	tokenFilterMetadata: TokenFilterMetadataArtifact
}

export type MetadataArtifactKey = keyof CoreMetadataPayload

type MetadataArtifactDefinition<Key extends MetadataArtifactKey> = {
	file: string
	stub: CoreMetadataPayload[Key]
	parse: (value: unknown, file: string) => CoreMetadataPayload[Key]
}

type MetadataArtifactRegistry = {
	[Key in MetadataArtifactKey]: MetadataArtifactDefinition<Key>
}

function defineMetadataArtifactRegistry<const Registry extends MetadataArtifactRegistry>(registry: Registry): Registry {
	return registry
}

function parseArtifact<T>(value: unknown, _file?: string): T {
	return value as T
}

export const METADATA_ARTIFACT_REGISTRY = defineMetadataArtifactRegistry({
	chains: {
		file: 'chains.json',
		stub: {},
		parse: parseArtifact<Record<string, IChainMetadata>>
	},
	protocols: {
		file: 'protocols.json',
		stub: {},
		parse: parseArtifact<Record<string, IProtocolMetadata>>
	},
	categoriesAndTags: {
		file: 'categoriesAndTags.json',
		stub: { categories: [], tags: [], tagCategoryMap: {}, configs: {} },
		parse: parseArtifact<ICategoriesAndTags>
	},
	cexs: {
		file: 'cexs.json',
		stub: [],
		parse: parseArtifact<Array<ICexItem>>
	},
	rwaList: {
		file: 'rwa.json',
		stub: {
			canonicalMarketIds: [],
			platforms: [],
			platformRoutes: [],
			chains: [],
			categories: [],
			assetGroups: [],
			idMap: {}
		},
		parse: parseArtifact<IRWAList>
	},
	rwaPlatformsIndex: {
		file: 'rwaPlatforms.json',
		stub: { generatedAt: 0, byPid: {}, platforms: {} },
		parse: parseArtifact<RWAPlatformsIndex>
	},
	rwaPerpsList: {
		file: 'rwaPerps.json',
		stub: { contracts: [], venues: [], categories: [], assets: [], assetGroups: [], total: 0 },
		parse: parseArtifact<IRWAPerpsList>
	},
	tokenlist: {
		file: 'tokenlist.json',
		stub: {},
		parse: parseArtifact<Record<string, ITokenListEntry>>
	},
	tokenDirectory: {
		file: 'tokens.json',
		stub: {},
		parse: parseArtifact<TokenDirectory>
	},
	protocolDisplayNames: {
		file: 'protocolDisplayNames.json',
		stub: {},
		parse: parseArtifact<Record<string, string>>
	},
	chainDisplayNames: {
		file: 'chainDisplayNames.json',
		stub: {},
		parse: parseArtifact<Record<string, string>>
	},
	chainCategories: {
		file: 'chainCategories.json',
		stub: [],
		parse: parseArtifact<Array<string>>
	},
	liquidationsTokenSymbols: {
		file: 'liquidationsTokenSymbols.json',
		stub: [],
		parse: parseArtifact<Array<string>>
	},
	emissionsProtocolsList: {
		file: 'emissionsProtocolsList.json',
		stub: [],
		parse: parseArtifact<Array<string>>
	},
	emissionsSupplyMetrics: {
		file: 'emissionsSupplyMetrics.json',
		stub: {},
		parse: parseArtifact<ProtocolEmissionSupplyMetricsMap>
	},
	emissionsHistoricalPrices: {
		file: 'emissionsHistoricalPrices.json',
		stub: {},
		parse: parseArtifact<IEmissionsHistoricalPrices>
	},
	cgExchangeIdentifiers: {
		file: 'cgExchangeIdentifiers.json',
		stub: [],
		parse: parseArtifact<Array<string>>
	},
	bridgeProtocolSlugs: {
		file: 'bridgeProtocolSlugs.json',
		stub: [],
		parse: parseArtifact<Array<string>>
	},
	bridgeChainSlugs: {
		file: 'bridgeChainSlugs.json',
		stub: [],
		parse: parseArtifact<Array<string>>
	},
	bridgeChainSlugToName: {
		file: 'bridgeChainSlugToName.json',
		stub: {},
		parse: parseArtifact<Record<string, string>>
	},
	narrativeCategories: {
		file: 'narrativeCategories.json',
		stub: { ids: [], nameById: {} },
		parse: parseArtifact<NarrativeCategoriesMetadata>
	},
	oracleRoutes: {
		file: 'oracleRoutes.json',
		stub: { oracleNameBySlug: {}, chainNameBySlug: {}, chainSlugsByOracleSlug: {} },
		parse: parseArtifact<OracleRoutesMetadata>
	},
	digitalAssetTreasuryRoutes: {
		file: 'digitalAssetTreasuryRoutes.json',
		stub: { assetSlugs: [], companySlugs: [] },
		parse: parseArtifact<DigitalAssetTreasuryRoutesMetadata>
	},
	stablecoinPeggedAssetSlugs: {
		file: 'stablecoinPeggedAssetSlugs.json',
		stub: [],
		parse: parseArtifact<Array<string>>
	},
	equitiesCompanyRoutes: {
		file: 'equitiesCompanyRoutes.json',
		stub: [],
		parse: parseArtifact<Array<IEquitiesCompanyRoute>>
	},
	preIpoCompanyIds: {
		file: 'preIpoCompanyIds.json',
		stub: [],
		parse: parseArtifact<Array<string>>
	},
	tokenFilterMetadata: {
		file: 'tokenFilters.json',
		stub: EMPTY_TOKEN_FILTER_METADATA,
		parse: parseTokenFilterMetadata
	}
})

export const METADATA_ARTIFACT_KEYS = Object.keys(METADATA_ARTIFACT_REGISTRY) as Array<MetadataArtifactKey>

export const METADATA_ARTIFACT_FILES = Object.fromEntries(
	METADATA_ARTIFACT_KEYS.map((key) => [key, METADATA_ARTIFACT_REGISTRY[key].file])
) as { readonly [Key in MetadataArtifactKey]: string }

export const METADATA_CI_STUBS = Object.fromEntries(
	METADATA_ARTIFACT_KEYS.map((key) => [key, METADATA_ARTIFACT_REGISTRY[key].stub])
) as CoreMetadataPayload

export function parseMetadataArtifact<Key extends MetadataArtifactKey>(
	key: Key,
	value: unknown
): CoreMetadataPayload[Key] {
	const artifact = METADATA_ARTIFACT_REGISTRY[key]
	return artifact.parse(value, artifact.file) as CoreMetadataPayload[Key]
}

export function getMetadataArtifactEntries(payload: CoreMetadataPayload): Array<[string, unknown]> {
	const entries: Array<[string, unknown]> = []
	for (const key of METADATA_ARTIFACT_KEYS) {
		entries.push([METADATA_ARTIFACT_REGISTRY[key].file, payload[key]])
	}
	return entries
}
export function validateCoreMetadataPayload(payload: CoreMetadataPayload): CoreMetadataPayload {
	const validatedPayload = {} as CoreMetadataPayload
	const writablePayload = validatedPayload as Record<MetadataArtifactKey, unknown>
	for (const key of METADATA_ARTIFACT_KEYS) {
		writablePayload[key] = parseMetadataArtifact(key, payload[key])
	}
	return validatedPayload
}

export function hydrateMetadataCache(payload: CoreMetadataPayload): MetadataCache {
	const cexRouteIndexes = createCexRouteIndexes(payload.protocols, payload.cexs)
	return {
		chainMetadata: payload.chains,
		chainRouteKeyBySlug: createChainRouteKeyBySlug(payload.chains),
		protocolMetadata: payload.protocols,
		protocolRouteIdBySlug: createProtocolRouteIdBySlug(payload.protocols),
		categoriesAndTags: payload.categoriesAndTags,
		protocolCategoryBySlug: createSlugLookup(payload.categoriesAndTags.categories),
		protocolTagBySlug: createSlugLookup(payload.categoriesAndTags.tags),
		cexs: payload.cexs,
		cexRouteIdBySlug: cexRouteIndexes.routeIdBySlug,
		cexMetadataBySlug: cexRouteIndexes.metadataBySlug,
		rwaList: payload.rwaList,
		rwaPlatformsIndex: payload.rwaPlatformsIndex,
		rwaPerpsList: payload.rwaPerpsList,
		tokenlist: payload.tokenlist,
		tokenDirectory: payload.tokenDirectory,
		tokenDirectoryRecordByRouteSegment: createTokenDirectoryRecordByRouteSegment(payload.tokenDirectory),
		protocolDisplayNames: createStringLookupMap(payload.protocolDisplayNames),
		chainDisplayNames: createChainDisplayNameMap(payload),
		chainCategories: payload.chainCategories,
		liquidationsTokenSymbols: payload.liquidationsTokenSymbols,
		liquidationsTokenSymbolsSet: new Set(payload.liquidationsTokenSymbols),
		emissionsProtocolsList: payload.emissionsProtocolsList,
		emissionsProtocolBySlug: createSlugLookup(payload.emissionsProtocolsList),
		emissionsSupplyMetrics: payload.emissionsSupplyMetrics,
		emissionsHistoricalPrices: payload.emissionsHistoricalPrices,
		cgExchangeIdentifiers: payload.cgExchangeIdentifiers,
		bridgeProtocolSlugs: payload.bridgeProtocolSlugs,
		bridgeProtocolSlugsSet: new Set(payload.bridgeProtocolSlugs),
		bridgeChainSlugs: payload.bridgeChainSlugs,
		bridgeChainSlugsSet: new Set(payload.bridgeChainSlugs),
		bridgeChainSlugToName: payload.bridgeChainSlugToName,
		narrativeCategories: payload.narrativeCategories,
		narrativeCategoryIdsSet: new Set(payload.narrativeCategories.ids),
		oracleRoutes: payload.oracleRoutes,
		digitalAssetTreasuryRoutes: payload.digitalAssetTreasuryRoutes,
		digitalAssetTreasuryAssetSlugsSet: new Set(payload.digitalAssetTreasuryRoutes.assetSlugs),
		digitalAssetTreasuryCompanyRouteBySlug: createDigitalAssetTreasuryCompanyRouteBySlug(
			payload.digitalAssetTreasuryRoutes.companySlugs
		),
		stablecoinPeggedAssetSlugs: payload.stablecoinPeggedAssetSlugs,
		stablecoinPeggedAssetSlugsSet: new Set(payload.stablecoinPeggedAssetSlugs),
		equitiesCompanyRoutes: payload.equitiesCompanyRoutes,
		equitiesCompanySlugsSet: new Set(payload.equitiesCompanyRoutes.map(getEquityCompanySlug)),
		preIpoCompanyIds: payload.preIpoCompanyIds,
		preIpoCompanyIdsSet: new Set(payload.preIpoCompanyIds),
		tokenFilterMetadata: payload.tokenFilterMetadata
	}
}

function createChainDisplayNameMap(payload: CoreMetadataPayload): Map<string, string> {
	return createStringLookupMap({
		...payload.chainDisplayNames,
		...buildChainDisplayNameLookupRecord(payload.chains)
	})
}

function setSlugAlias(index: Record<string, string>, value: unknown, target: string): void {
	const key = slug(value)
	if (key && !index[key]) index[key] = target
}

function createSlugLookup(values: Array<string>): Record<string, string> {
	const lookup: Record<string, string> = {}

	for (const value of values) {
		setSlugAlias(lookup, value, value)
	}

	return lookup
}

function createChainRouteKeyBySlug(chains: Record<string, IChainMetadata>): Record<string, string> {
	const routeKeyBySlug: Record<string, string> = {}

	for (const [chainKey, metadata] of Object.entries(chains)) {
		setSlugAlias(routeKeyBySlug, chainKey, chainKey)
		setSlugAlias(routeKeyBySlug, metadata.name, chainKey)
		setSlugAlias(routeKeyBySlug, metadata.id, chainKey)
	}

	return routeKeyBySlug
}

function createProtocolRouteIdBySlug(protocols: Record<string, IProtocolMetadata>): Record<string, string> {
	const routeIdBySlug: Record<string, string> = {}

	for (const [protocolId, metadata] of Object.entries(protocols)) {
		if (metadata.cex) continue
		setSlugAlias(routeIdBySlug, metadata.displayName, protocolId)
		setSlugAlias(routeIdBySlug, metadata.name, protocolId)
		setSlugAlias(routeIdBySlug, protocolId, protocolId)
	}

	// Previous names are registered only after every current name is claimed. setSlugAlias is
	// first-wins, so running them in the loop above would let a name a protocol has abandoned
	// beat the protocol that carries it now, decided by object key order.
	for (const [protocolId, metadata] of Object.entries(protocols)) {
		if (metadata.cex || !metadata.previousNames?.length) continue
		for (const previousName of metadata.previousNames) {
			setSlugAlias(routeIdBySlug, previousName, protocolId)
		}
	}

	return routeIdBySlug
}

function createCexRouteIndexes(
	protocols: Record<string, IProtocolMetadata>,
	cexs: Array<ICexItem>
): {
	routeIdBySlug: Record<string, string>
	metadataBySlug: Record<string, ICexItem>
} {
	// CEX API names and protocol metadata names can differ, so index both and
	// cross-reference by slug while preserving first-wins route aliases.
	const routeIdBySlug: Record<string, string> = {}
	const metadataBySlug: Record<string, ICexItem> = {}
	const cexSlugByNameSlug: Record<string, string> = {}
	const protocolIdByCanonicalSlug: Record<string, string> = {}

	for (const cexMetadata of cexs) {
		const cexSlug = slug(cexMetadata.slug)
		if (!cexSlug) continue
		metadataBySlug[cexSlug] = cexMetadata

		const nameSlug = slug(cexMetadata.name)
		if (nameSlug) cexSlugByNameSlug[nameSlug] = cexSlug
	}

	for (const [protocolId, metadata] of Object.entries(protocols)) {
		if (!metadata.cex || !metadata.name) continue

		const canonicalSlug = slug(metadata.name)
		if (!canonicalSlug) continue

		if (!protocolIdByCanonicalSlug[canonicalSlug]) {
			protocolIdByCanonicalSlug[canonicalSlug] = protocolId
		}
		setSlugAlias(routeIdBySlug, canonicalSlug, protocolId)
		setSlugAlias(routeIdBySlug, metadata.displayName, protocolId)
		setSlugAlias(routeIdBySlug, protocolId, protocolId)
	}

	for (const [nameSlug, cexSlug] of Object.entries(cexSlugByNameSlug)) {
		const protocolId = protocolIdByCanonicalSlug[cexSlug]
		if (protocolId && !routeIdBySlug[nameSlug]) {
			routeIdBySlug[nameSlug] = protocolId
		}
	}

	// Same ordering rule as the protocol routes: an exchange's old name must never outrank
	// the exchange that answers to that name today.
	for (const [protocolId, metadata] of Object.entries(protocols)) {
		if (!metadata.cex || !metadata.previousNames?.length) continue
		for (const previousName of metadata.previousNames) {
			setSlugAlias(routeIdBySlug, previousName, protocolId)
		}
	}

	return { routeIdBySlug, metadataBySlug }
}

function createDigitalAssetTreasuryCompanyRouteBySlug(companyRoutes: Array<string>): Record<string, string> {
	const routeBySlug: Record<string, string> = {}

	for (const companyRoute of companyRoutes) {
		const companySlug = slug(companyRoute)
		if (!companySlug || routeBySlug[companySlug]) continue
		routeBySlug[companySlug] = companyRoute
	}

	return routeBySlug
}

function getEquityCompanySlug(company: IEquitiesCompanyRoute): string {
	return `${company.ticker}:${company.country}`
}

export function replaceMetadataCacheContents(metadataCache: MetadataCache, payload: CoreMetadataPayload): void {
	Object.assign(metadataCache, hydrateMetadataCache(payload))
}
