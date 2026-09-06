import { CATEGORY_INFO_API } from '~/constants'
import { fetchDATInstitutions } from '~/containers/DAT/api'
import type { ICategoryInfoApiItem } from '~/containers/NarrativeTracker/api.types'
import { fetchOracleMetrics } from '~/containers/Oracles/api'
import type { IOracleMetrics } from '~/containers/Oracles/api.types'
import { fetchStablecoinPeggedConfigApi } from '~/containers/Stablecoins/api'
import { slug } from '~/utils'
import { fetchMetadataJson } from './http'
import { dedupeNonEmpty } from './strings'

export type NarrativeCategoriesMetadata = {
	ids: Array<string>
	nameById: Record<string, string>
}

export type OracleRoutesMetadata = {
	oracleNameBySlug: Record<string, string>
	chainNameBySlug: Record<string, string>
	chainSlugsByOracleSlug: Record<string, Array<string>>
}

export type DigitalAssetTreasuryRoutesMetadata = {
	assetSlugs: Array<string>
	companySlugs: Array<string>
}

export const EMPTY_NARRATIVE_CATEGORIES: NarrativeCategoriesMetadata = {
	ids: [],
	nameById: {}
}

export const EMPTY_ORACLE_ROUTES: OracleRoutesMetadata = {
	oracleNameBySlug: {},
	chainNameBySlug: {},
	chainSlugsByOracleSlug: {}
}

export const EMPTY_DIGITAL_ASSET_TREASURY_ROUTES: DigitalAssetTreasuryRoutesMetadata = {
	assetSlugs: [],
	companySlugs: []
}

export type RouteIndexesMetadata = {
	narrativeCategories: NarrativeCategoriesMetadata
	oracleRoutes: OracleRoutesMetadata
	digitalAssetTreasuryRoutes: DigitalAssetTreasuryRoutesMetadata
	stablecoinPeggedAssetSlugs: Array<string>
}

export const EMPTY_ROUTE_INDEXES: RouteIndexesMetadata = {
	narrativeCategories: EMPTY_NARRATIVE_CATEGORIES,
	oracleRoutes: EMPTY_ORACLE_ROUTES,
	digitalAssetTreasuryRoutes: EMPTY_DIGITAL_ASSET_TREASURY_ROUTES,
	stablecoinPeggedAssetSlugs: []
}

function dedupeRouteValuesBySlug(values: Array<string>): Array<string> {
	const slugs = new Set<string>()
	const routes: Array<string> = []

	for (const value of values) {
		const valueSlug = slug(value)
		if (!valueSlug || slugs.has(valueSlug)) continue
		slugs.add(valueSlug)
		routes.push(value)
	}

	return routes
}

export function buildNarrativeCategoriesMetadata(info: Array<ICategoryInfoApiItem>): NarrativeCategoriesMetadata {
	const ids: Array<string> = []
	const nameById: Record<string, string> = {}

	for (const item of info) {
		const id = item.id
		if (!id) continue
		ids.push(id)
		nameById[id] = item.name
	}

	return {
		ids: dedupeNonEmpty(ids),
		nameById
	}
}

export function buildOracleRoutesMetadata({
	oracles,
	chainsByOracle,
	protocolsByOracleChain
}: Pick<IOracleMetrics, 'oracles' | 'chainsByOracle' | 'protocolsByOracleChain'>): OracleRoutesMetadata {
	const oracleNameBySlug: Record<string, string> = {}
	const chainNameBySlug: Record<string, string> = {}
	const chainSlugsByOracleSlug: Record<string, Array<string>> = {}

	for (const oracleName in oracles) {
		const oracleSlug = slug(oracleName)
		if (!oracleSlug) continue
		oracleNameBySlug[oracleSlug] = oracleName

		const membersByChain = protocolsByOracleChain[oracleName] ?? {}
		const chainNames: Array<string> = []
		for (const chainName of chainsByOracle[oracleName] ?? []) {
			if (membersByChain[chainName] !== undefined) chainNames.push(chainName)
		}
		for (const chainName in membersByChain) {
			if (!chainNames.includes(chainName)) chainNames.push(chainName)
		}

		const chainSlugs: Array<string> = []
		for (const chainName of chainNames) {
			const chainSlug = slug(chainName)
			if (!chainSlug) continue
			chainNameBySlug[chainSlug] = chainName
			chainSlugs.push(chainSlug)
		}
		chainSlugsByOracleSlug[oracleSlug] = dedupeNonEmpty(chainSlugs)
	}

	return {
		oracleNameBySlug,
		chainNameBySlug,
		chainSlugsByOracleSlug
	}
}

export function buildDigitalAssetTreasuryRoutesMetadata(
	data: Awaited<ReturnType<typeof fetchDATInstitutions>>
): DigitalAssetTreasuryRoutesMetadata {
	const assetSlugs = Object.entries(data.assetMetadata)
		.sort(([, a], [, b]) => (b.totalUsdValue ?? 0) - (a.totalUsdValue ?? 0))
		.map(([asset]) => slug(asset))

	const companySlugs: Array<string> = []
	const includedInstitutionIds = new Set<number>()
	for (const institution of data.institutions) {
		includedInstitutionIds.add(institution.institutionId)
		const ticker = data.institutionMetadata[institution.institutionId]?.ticker
		if (ticker) companySlugs.push(ticker)
	}
	for (const institutionId in data.institutionMetadata) {
		const institution = data.institutionMetadata[institutionId]
		if (institution === undefined) continue
		if (includedInstitutionIds.has(institution.institutionId)) continue
		const ticker = institution.ticker
		if (ticker) companySlugs.push(ticker)
	}

	return {
		assetSlugs: dedupeNonEmpty(assetSlugs),
		companySlugs: dedupeRouteValuesBySlug(companySlugs)
	}
}

export function buildStablecoinPeggedAssetSlugs(config: Record<string, string>): Array<string> {
	const assetSlugs: Array<string> = []
	for (const asset in config) assetSlugs.push(slug(asset))
	return dedupeNonEmpty(assetSlugs)
}

export async function fetchMetadataRouteIndexes(): Promise<RouteIndexesMetadata> {
	const [narrativeCategories, oracleRoutes, digitalAssetTreasuryRoutes, stablecoinPeggedAssetSlugs] = await Promise.all(
		[
			(async () =>
				buildNarrativeCategoriesMetadata(await fetchMetadataJson<Array<ICategoryInfoApiItem>>(CATEGORY_INFO_API)))(),
			(async () => {
				const metrics = await fetchOracleMetrics()
				return buildOracleRoutesMetadata(metrics)
			})(),
			(async () => buildDigitalAssetTreasuryRoutesMetadata(await fetchDATInstitutions()))(),
			(async () => buildStablecoinPeggedAssetSlugs(await fetchStablecoinPeggedConfigApi()))()
		]
	)

	return {
		narrativeCategories,
		oracleRoutes,
		digitalAssetTreasuryRoutes,
		stablecoinPeggedAssetSlugs
	}
}
