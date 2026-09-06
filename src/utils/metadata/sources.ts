import { LIQUIDATIONS_SERVER_URL_V2, TOKEN_DIRECTORY_API } from '~/constants'
import type { RawBridgesWithChainsResponse } from '~/containers/Bridges/api.types'
import type { RawCexsResponse } from '~/containers/Cexs/api.types'
import type { IEquitiesCompanyRoute } from '~/containers/Equities/api.types'
import { fetchEquitiesCompanyRouteMetadata } from '~/containers/Equities/server/metadata'
import type { RawAllLiquidationsResponse } from '~/containers/LiquidationsV2/api.types'
import { fetchPreIpoCompanyIds } from '~/containers/PreIPO/server/metadata'
import type { RWAPlatformsIndex } from '~/containers/RWA/PlatformPage/api.types'
import { fetchEmissionsProtocolsList, normalizeProtocolEmissions } from '~/containers/Unlocks/api'
import type {
	ProtocolEmission,
	ProtocolEmissionSupplyMetricsMap,
	RawProtocolEmission
} from '~/containers/Unlocks/api.types'
import { getErrorMessage } from '~/utils/error'
import type { TokenDirectory } from '~/utils/tokenDirectory'
import { getMetadataFetchTimeoutMs } from './config'
import { fetchMetadataJson } from './http'
import type { TokenFilterMetadataArtifact } from './tokenFilters'
import type {
	ICategoriesAndTags,
	IChainMetadata,
	IProtocolMetadata,
	IRWAList,
	IRWAPerpsList,
	ITokenListEntry
} from './types'
import { getMetadataUpstreamBase } from './upstream'

export type RawTokenListItem = ITokenListEntry & { id: string }

export type CoreMetadataSources = {
	protocols: Record<string, IProtocolMetadata>
	chains: Record<string, IChainMetadata>
	categoriesAndTags: ICategoriesAndTags
	chainCategories: Array<string>
	cexsResponse: RawCexsResponse
	rwaList: Omit<IRWAList, 'platformRoutes'>
	rwaPlatformsIndex: RWAPlatformsIndex
	rwaPerpsList: IRWAPerpsList
	tokenlistArray: Array<RawTokenListItem>
	tokenDirectory: TokenDirectory
	liquidationsResponse: RawAllLiquidationsResponse
	bridgesResponse: RawBridgesWithChainsResponse
	emissionsProtocolsList: Array<string>
	emissionsSupplyMetrics: ProtocolEmissionSupplyMetricsMap
	emissions: Array<ProtocolEmission>
	equitiesCompanyRoutes: Array<IEquitiesCompanyRoute>
	preIpoCompanyIds: Array<string>
	tokenFilterMetadata: TokenFilterMetadataArtifact
}

async function fetchNamedMetadataSource<T>(name: string, promise: Promise<T>): Promise<T> {
	try {
		return await promise
	} catch (error) {
		console.warn(`[dev:prepare] Metadata cache: ${name} failed: ${getErrorMessage(error)}`)
		throw error
	}
}

export async function fetchCoreMetadataSources(): Promise<CoreMetadataSources> {
	const coreApiBase = getMetadataUpstreamBase('core')
	const datasetsBase = getMetadataUpstreamBase('datasets')
	const bridgesBase = getMetadataUpstreamBase('bridges')

	const [
		protocols,
		chains,
		categoriesAndTags,
		chainCategoriesResponse,
		cexsResponse,
		rwaList,
		rwaPlatformsIndex,
		rwaPerpsList,
		tokenlistArray,
		tokenDirectory,
		liquidationsResponse,
		bridgesResponse,
		emissionsProtocolsList,
		emissionsSupplyMetrics,
		emissions,
		equitiesCompanyRoutes,
		preIpoCompanyIds,
		tokenFilterMetadata
	] = await Promise.all([
		fetchNamedMetadataSource(
			'protocols API',
			fetchMetadataJson<Record<string, IProtocolMetadata>>(
				`${coreApiBase}/config/smol/appMetadata-protocols.json?zz=19`
			)
		),
		fetchNamedMetadataSource(
			'chains API',
			fetchMetadataJson<Record<string, IChainMetadata>>(`${coreApiBase}/config/smol/appMetadata-chains.json?zz=19`)
		),
		fetchNamedMetadataSource(
			'categories and tags API',
			fetchMetadataJson<ICategoriesAndTags>(`${coreApiBase}/config/smol/appMetadata-categoriesAndTags.json?zz=19`)
		),
		fetchNamedMetadataSource(
			'chain categories API',
			fetchMetadataJson<{ categories: Array<string> }>(`${coreApiBase}/chains2`)
		),
		fetchNamedMetadataSource('CEX metadata API', fetchMetadataJson<RawCexsResponse>(`${coreApiBase}/cexs?zz=19`)),
		fetchNamedMetadataSource(
			'RWA metadata API',
			fetchMetadataJson<Omit<IRWAList, 'platformRoutes'>>(`${getMetadataUpstreamBase('rwa')}/list?zz=19`)
		),
		fetchNamedMetadataSource(
			'RWA platforms metadata API',
			fetchMetadataJson<RWAPlatformsIndex>(`${getMetadataUpstreamBase('rwa')}/rwa/platforms`)
		),
		fetchNamedMetadataSource(
			'RWA perps metadata API',
			fetchMetadataJson<IRWAPerpsList>(`${getMetadataUpstreamBase('rwa-perps')}/list?includeCex=true&zz=19`)
		),
		fetchNamedMetadataSource(
			'token list API',
			fetchMetadataJson<Array<RawTokenListItem>>(`${datasetsBase}/tokenlist/rankings.json?zz=19`)
		),
		fetchNamedMetadataSource('token directory API', fetchMetadataJson<TokenDirectory>(TOKEN_DIRECTORY_API)),
		fetchNamedMetadataSource(
			'liquidations metadata API',
			fetchMetadataJson<RawAllLiquidationsResponse>(`${LIQUIDATIONS_SERVER_URL_V2}/all?zz=19`)
		),
		fetchNamedMetadataSource(
			'bridges metadata API',
			fetchMetadataJson<RawBridgesWithChainsResponse>(`${bridgesBase}/bridges?includeChains=true`)
		),
		fetchNamedMetadataSource(
			'emissions protocols API',
			fetchEmissionsProtocolsList({ timeout: getMetadataFetchTimeoutMs() })
		),
		fetchNamedMetadataSource(
			'emissions supply metrics API',
			fetchMetadataJson<ProtocolEmissionSupplyMetricsMap>(`${datasetsBase}/emissionsSupplyMetrics`)
		),
		fetchNamedMetadataSource(
			'emissions API',
			fetchMetadataJson<Array<RawProtocolEmission>>(`${coreApiBase}/emissions`).then(normalizeProtocolEmissions)
		),
		fetchNamedMetadataSource('equities company routes API', fetchEquitiesCompanyRouteMetadata()),
		fetchNamedMetadataSource('pre-IPO company routes API', fetchPreIpoCompanyIds()),
		fetchNamedMetadataSource(
			'token filter metadata',
			fetchMetadataJson<TokenFilterMetadataArtifact>(`${datasetsBase}/tokenlist/filters.json?zz=19`)
		)
	])

	return {
		protocols,
		chains,
		categoriesAndTags,
		chainCategories: chainCategoriesResponse.categories,
		cexsResponse,
		rwaList,
		rwaPlatformsIndex,
		rwaPerpsList,
		tokenlistArray,
		tokenDirectory,
		liquidationsResponse,
		bridgesResponse,
		emissionsProtocolsList,
		emissionsSupplyMetrics,
		emissions,
		equitiesCompanyRoutes,
		preIpoCompanyIds,
		tokenFilterMetadata
	}
}
