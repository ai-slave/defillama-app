import { MARKETS_SERVER_URL } from '~/constants'
import { isHttpNotFoundMessage, MARKETS_CACHE_CONTROL } from '~/server/api/common'
import { queryString } from '~/server/api/params'
import { proxyJsonRoute } from '~/server/api/proxy'
import { badRequest, notFound, ok, okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult, cachedResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { resolveCountryAvailability } from '../countryAvailability'
import { mapMasterDirectoryOverview } from '../master.mappers'
import {
	MASTER_CHART_PARTS,
	type MasterChartPart,
	type MasterColumnarSeriesResponse,
	type MasterExchangeMetadataResponse,
	type MasterExchangeRegionCatalogResponse,
	type MasterExchangeRegionManifestResponse,
	type MasterExchangeRegionalMetadataResponse
} from '../master.types'
import { getResearchRange, type ExchangeResearchRange } from '../queryState'
import { isCanonicalExchangeSlug } from '../slugs'
import { MasterExchangeNotFoundError } from './master.loaders'
import {
	fetchMasterExchangeHistoryFromNetwork,
	fetchMasterExchangeRegionCatalogFromNetwork,
	fetchMasterExchangeRegionManifestFromNetwork,
	fetchMasterExchangeRegionalMetadataFromNetwork,
	fetchMasterExchangeSeriesFromNetwork
} from './master.upstream'

const MASTER_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000
const MASTER_CHART_TIMEOUT_MS = 60_000

const getCachedMasterExchangeSeries = (range: ExchangeResearchRange) =>
	cachedResult<MasterColumnarSeriesResponse>(
		`exchanges-master-series-source:${range}`,
		`${MARKETS_SERVER_URL}/exchanges/series/${range}.json`,
		{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
		() => fetchMasterExchangeSeriesFromNetwork(range)
	)

const getCachedMasterExchangeHistory = (exchange: string, range: ExchangeResearchRange) =>
	cachedResult<MasterColumnarSeriesResponse>(
		`exchanges-master-history-source:${exchange}:${range}`,
		`${MARKETS_SERVER_URL}/exchanges/${encodeURIComponent(exchange)}/series/${range}.json`,
		{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
		() => fetchMasterExchangeHistoryFromNetwork(exchange, range)
	)

const getCachedMasterExchangeRegionCatalog = () =>
	cachedResult<MasterExchangeRegionCatalogResponse>(
		'exchanges-master-region-catalog-source',
		`${MARKETS_SERVER_URL}/exchanges/regions.json`,
		{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
		fetchMasterExchangeRegionCatalogFromNetwork
	)

const getCachedMasterExchangeRegionManifest = (exchange: string) =>
	cachedResult<MasterExchangeRegionManifestResponse>(
		'exchanges-master-region-manifest-source',
		exchange,
		{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
		() => fetchMasterExchangeRegionManifestFromNetwork(exchange)
	)

const getCachedMasterExchangeRegionalMetadata = (exchange: string, region: string) =>
	cachedResult<MasterExchangeMetadataResponse>(
		'exchanges-master-regional-metadata-source',
		`${exchange}:${region}`,
		{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
		() => fetchMasterExchangeRegionalMetadataFromNetwork(exchange, region)
	)

/** Upstream 404 on a venue-scoped regional file means the venue has no regional data, not an outage. */
async function venueRegionalFileOrNotFound<T>(exchange: string, load: () => Promise<T>): Promise<T> {
	try {
		return await load()
	} catch (error) {
		if (isHttpNotFoundMessage(error)) throw new MasterExchangeNotFoundError(exchange)
		throw error
	}
}

export const masterExchangeSeries = defineApiRoute({
	route: '/api/public/exchanges/series',
	cacheControl: MARKETS_CACHE_CONTROL,
	handle: async (req) => {
		const range = getResearchRange(req.query)
		try {
			const payload = await cachedJsonResult(
				'exchanges-master-series-response',
				range,
				{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
				() => getCachedMasterExchangeSeries(range)
			)
			return okSerializedJson(payload)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to load exchange series')
		}
	}
})

export const masterExchangeHistory = defineApiRoute({
	route: '/api/public/exchanges/[exchange]/history',
	cacheControl: MARKETS_CACHE_CONTROL,
	handle: async (req) => {
		const exchange = queryString(req.query, 'exchange')
		if (!exchange) return badRequest('Missing exchange')
		if (!isCanonicalExchangeSlug(exchange)) return badRequest('Invalid exchange')
		const range = getResearchRange(req.query)
		try {
			const payload = await cachedJsonResult(
				'exchanges-master-profile-history',
				`${exchange}:${range}`,
				{ ttlMs: MASTER_RESPONSE_CACHE_TTL_MS, ttlJitter: 0.2 },
				async () => mapMasterDirectoryOverview(await getCachedMasterExchangeHistory(exchange, range))
			)
			return okSerializedJson(payload)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to load exchange history')
		}
	}
})

export const masterExchangeRegions = defineApiRoute({
	route: '/api/public/exchanges/regions',
	cacheControl: MARKETS_CACHE_CONTROL,
	handle: async () => {
		try {
			return ok(await getCachedMasterExchangeRegionCatalog())
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to load exchange regions')
		}
	}
})

export const masterExchangeRegionalMetadata = defineApiRoute({
	route: '/api/public/exchanges/[exchange]/metadata',
	cacheControl: MARKETS_CACHE_CONTROL,
	handle: async (req) => {
		const exchange = queryString(req.query, 'exchange')
		if (!exchange) return badRequest('Missing exchange')
		if (!isCanonicalExchangeSlug(exchange)) return badRequest('Invalid exchange')
		const countryQuery = queryString(req.query, 'country')
		if (!countryQuery || !/^[a-z]{2}$/i.test(countryQuery)) return badRequest('Invalid country')
		const country = countryQuery.toUpperCase()
		try {
			const catalog = await getCachedMasterExchangeRegionCatalog()
			if (!(country in catalog.country_regions)) return badRequest('Unknown country')
			const manifest = await venueRegionalFileOrNotFound(exchange, () =>
				getCachedMasterExchangeRegionManifest(exchange)
			)
			const resolved = resolveCountryAvailability(catalog, manifest, country)
			const responseBase = {
				country: resolved.country,
				region: resolved.region,
				availability: resolved.availability,
				segments: resolved.segments,
				note: resolved.note,
				source: resolved.source,
				used_fallback: resolved.usedFallback
			}
			if (resolved.availability === 'unavailable') {
				const payload: MasterExchangeRegionalMetadataResponse = {
					...responseBase,
					availability: 'unavailable',
					segments: []
				}
				return ok(payload)
			}

			const variantRegion = resolved.usedFallback ? 'global' : resolved.region.key
			const metadata = await venueRegionalFileOrNotFound(exchange, () =>
				getCachedMasterExchangeRegionalMetadata(exchange, variantRegion)
			)
			const payload: MasterExchangeRegionalMetadataResponse = {
				...responseBase,
				availability: resolved.availability,
				metadata
			}
			return ok(payload)
		} catch (error) {
			if (error instanceof MasterExchangeNotFoundError) return notFound('Unknown exchange or no regional data')
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to load regional exchange metadata')
		}
	}
})

export const masterExchangeChart = proxyJsonRoute({
	route: '/api/public/exchanges/charts/[part]',
	cacheControl: MARKETS_CACHE_CONTROL,
	resultTtlMs: MASTER_RESPONSE_CACHE_TTL_MS,
	timeoutMs: MASTER_CHART_TIMEOUT_MS,
	upstreamUrl: (req) => {
		const part = queryString(req.query, 'part') as MasterChartPart | null
		if (!part || !MASTER_CHART_PARTS.includes(part)) return badRequest('Unknown exchange chart')
		const range = getResearchRange(req.query)
		return `${MARKETS_SERVER_URL}/charts/${part}/${range}.json`
	},
	upstreamErrorMessage: 'Failed to load exchange chart'
})
