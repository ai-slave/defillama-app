import {
	fetchRWAAssetBreakdownRows,
	fetchRWAAssetGroupBreakdownChartData,
	fetchRWACategoryBreakdownChartData,
	fetchRWAChainBreakdownChartData,
	fetchRWAPlatformBreakdownChartData,
	rwaRowsInMilliseconds,
	subtractBridgeFromMetricRows
} from '~/containers/RWA/api'
import type {
	RWAChartMetricKey,
	RWAAssetChartTarget,
	RWAOverviewBreakdownRouteRequest
} from '~/containers/RWA/api.types'
import { toOverviewBreakdownChartDataset } from '~/containers/RWA/breakdownDataset'
import {
	fetchRWAPerpsContractBreakdownChartData,
	fetchRWAPerpsMarketBreakdownChartData,
	fetchRWAPerpsOverviewBreakdownChartData,
	setRWAPerpsChartScope
} from '~/containers/RWA/Perps/api'
import { toRWAPerpsBreakdownChartDataset } from '~/containers/RWA/Perps/breakdownDataset'
import { parseChartMetricKey as parsePerpsChartMetricKey } from '~/containers/RWA/Perps/requestParsers'
import type {
	IRWAPerpsContractBreakdownRequest,
	IRWAPerpsMarketBreakdownRequest,
	IRWAPerpsOverviewBreakdownRequest,
	RWAPerpsChartTarget,
	RWAPerpsMarketBreakdownTarget
} from '~/containers/RWA/Perps/types'
import {
	hasExactlyOneTarget,
	parseBooleanQueryFlag,
	parseEnumQueryValue,
	parseOptionalStringTarget
} from '~/containers/RWA/requestParsers'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import { notFound, okSerializedJson, badRequest, upstreamError } from '~/server/api/respond'
import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute, type ApiQuery } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'

type RWAAssetBreakdownRequest = {
	target: RWAAssetChartTarget
	key: RWAChartMetricKey
	includeStablecoin: boolean
	includeGovernance: boolean
	// Only affects the defiActiveTvl metric; when false the bridge portion is subtracted.
	includeBridgeTvl: boolean
}

const RWA_CHART_METRIC_KEYS = ['onChainMcap', 'activeMcap', 'defiActiveTvl'] as const

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

function parseChartMetricKey(value: string | Array<string> | undefined): RWAChartMetricKey | null {
	return parseEnumQueryValue(value, RWA_CHART_METRIC_KEYS)
}

function parseTarget(query: ApiQuery): RWAAssetChartTarget | null {
	const chain = parseOptionalStringTarget(query.chain)
	const category = parseOptionalStringTarget(query.category)
	const platform = parseOptionalStringTarget(query.platform)
	const assetGroup = parseOptionalStringTarget(query.assetGroup)

	if (chain === null || category === null || platform === null || assetGroup === null) return null
	if (!hasExactlyOneTarget([chain, category, platform, assetGroup])) {
		return chain || category || platform || assetGroup ? null : { kind: 'all' }
	}
	if (chain) return { kind: 'chain', slug: chain }
	if (category) return { kind: 'category', slug: category }
	if (platform) return { kind: 'platform', slug: platform }
	return assetGroup ? { kind: 'assetGroup', slug: assetGroup } : null
}

export function parseAssetBreakdownRequest(req: { query: ApiQuery }): RWAAssetBreakdownRequest | null {
	const target = parseTarget(req.query)
	const key = parseChartMetricKey(req.query.key)
	const includeStablecoin = parseBooleanQueryFlag(req.query.includeStablecoin)
	const includeGovernance = parseBooleanQueryFlag(req.query.includeGovernance)
	// Absent param => include bridge TVL (today's default behaviour).
	const includeBridgeTvl = parseBooleanQueryFlag(req.query.includeBridgeTvl, true)

	if (
		target == null ||
		key == null ||
		includeStablecoin == null ||
		includeGovernance == null ||
		includeBridgeTvl == null
	) {
		return null
	}

	return {
		target,
		key,
		includeStablecoin,
		includeGovernance,
		includeBridgeTvl
	}
}

async function isKnownAssetBreakdownTarget(target: RWAAssetChartTarget): Promise<boolean> {
	if (target.kind === 'all') return true

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const rwaList = metadataCache.rwaList
	const targetSlug = rwaSlug(target.slug)
	const values =
		target.kind === 'chain'
			? rwaList.chains
			: target.kind === 'category'
				? rwaList.categories
				: target.kind === 'platform'
					? rwaList.platforms
					: rwaList.assetGroups

	for (const value of values) {
		if (rwaSlug(value) === targetSlug) return true
	}

	return false
}

function buildAssetBreakdownCacheKey(request: RWAAssetBreakdownRequest): string {
	const searchParams = new URLSearchParams({
		target: request.target.kind === 'all' ? 'all' : `${request.target.kind}:${rwaSlug(request.target.slug)}`,
		key: request.key,
		includeStablecoin: String(request.includeStablecoin),
		includeGovernance: String(request.includeGovernance),
		includeBridgeTvl: String(request.includeBridgeTvl)
	})
	return `/api/public/rwa/asset-breakdown?${searchParams.toString()}`
}

const RWA_BREAKDOWN_RESULT_TTL_MS = 30 * 60 * 1000
const RWA_BREAKDOWN_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=1800'

const RWA_OVERVIEW_BREAKDOWNS = ['chain', 'category', 'platform', 'assetGroup'] as const

export function parseRWAOverviewBreakdownRequest(req: { query: ApiQuery }): RWAOverviewBreakdownRouteRequest | null {
	const breakdown = parseEnumQueryValue(req.query.breakdown, RWA_OVERVIEW_BREAKDOWNS)
	const key = parseChartMetricKey(req.query.key)
	if (breakdown == null || key == null) return null

	const includeStablecoin = parseBooleanQueryFlag(req.query.includeStablecoin, false)
	const includeGovernance = parseBooleanQueryFlag(req.query.includeGovernance, false)
	const includeBridgeTvl = parseBooleanQueryFlag(req.query.includeBridgeTvl, true)
	if (includeStablecoin == null || includeGovernance == null || includeBridgeTvl == null) return null

	if (breakdown === 'chain') {
		return { breakdown, key, includeStablecoin, includeGovernance, includeBridgeTvl }
	}

	if (breakdown === 'category') {
		return { breakdown, key, includeStablecoin, includeGovernance, includeBridgeTvl }
	}

	if (breakdown === 'platform') {
		return { breakdown, key, includeStablecoin, includeGovernance, includeBridgeTvl }
	}

	if (breakdown === 'assetGroup') {
		return { breakdown, key, includeStablecoin, includeGovernance, includeBridgeTvl }
	}

	return null
}

function fetchOverviewBreakdownRows(
	request: RWAOverviewBreakdownRouteRequest,
	key: RWAChartMetricKey | 'bridgeTvl' = request.key
) {
	const params = {
		key,
		includeStablecoin: request.includeStablecoin,
		includeGovernance: request.includeGovernance
	}

	switch (request.breakdown) {
		case 'chain':
			return fetchRWAChainBreakdownChartData(params)
		case 'category':
			return fetchRWACategoryBreakdownChartData(params)
		case 'platform':
			return fetchRWAPlatformBreakdownChartData(params)
		case 'assetGroup':
			return fetchRWAAssetGroupBreakdownChartData(params)
		default:
			return assertNever(request)
	}
}

function buildOverviewBreakdownCacheKey(request: RWAOverviewBreakdownRouteRequest): string {
	const searchParams = new URLSearchParams({
		breakdown: request.breakdown,
		key: request.key,
		includeStablecoin: String(request.includeStablecoin),
		includeGovernance: String(request.includeGovernance),
		includeBridgeTvl: String(request.includeBridgeTvl)
	})
	return `/api/public/rwa/overview-breakdown?${searchParams.toString()}`
}

export const rwaOverviewBreakdown = defineApiRoute({
	route: '/api/public/rwa/overview-breakdown',
	cacheControl: RWA_BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const request = parseRWAOverviewBreakdownRequest(req)

		if (request == null) {
			return badRequest('Invalid query parameters')
		}

		try {
			const result = await cachedJsonResult(
				'rwa-overview-breakdown',
				buildOverviewBreakdownCacheKey(request),
				{ ttlMs: RWA_BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2 },
				async () => {
					if (request.key === 'defiActiveTvl' && !request.includeBridgeTvl) {
						const [rows, bridgeRows] = await Promise.all([
							fetchOverviewBreakdownRows(request),
							fetchOverviewBreakdownRows(request, 'bridgeTvl')
						])
						if (rows == null || bridgeRows == null) {
							throw new Error('RWA overview breakdown upstream returned incomplete bridge data')
						}
						return toOverviewBreakdownChartDataset(subtractBridgeFromMetricRows(rows, bridgeRows), request)
					}

					const rows = await fetchOverviewBreakdownRows(request)
					if (rows == null) {
						throw new Error('RWA overview breakdown upstream returned no data')
					}
					return toOverviewBreakdownChartDataset(rows, request)
				}
			)
			return okSerializedJson(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch upstream chart data')
		}
	}
})

async function hasKnownPerpsTarget(target: RWAPerpsMarketBreakdownTarget): Promise<boolean> {
	if (target.kind !== 'venue' && target.kind !== 'assetGroup' && target.kind !== 'baseAsset') return true

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	if (target.kind === 'venue') {
		const requestSlug = rwaSlug(target.slug)
		for (const venue of metadataCache.rwaPerpsList.venues) {
			if (rwaSlug(venue) === requestSlug) return true
		}
		return false
	}
	if (target.kind === 'baseAsset') {
		const requestSlug = rwaSlug(target.slug)
		for (const asset of metadataCache.rwaPerpsList.assets) {
			if (rwaSlug(asset) === requestSlug) return true
		}
		return false
	}

	const requestSlug = rwaSlug(target.slug)
	for (const assetGroup of metadataCache.rwaPerpsList.assetGroups) {
		if (rwaSlug(assetGroup) === requestSlug) return true
	}
	return false
}

const RWA_PERPS_OVERVIEW_BREAKDOWNS = ['venue', 'assetClass', 'assetGroup', 'baseAsset'] as const

function parsePerpsChartTarget(query: ApiQuery): RWAPerpsChartTarget | null {
	// venueType belonged to the pre-rollout API. Reject it so callers cannot
	// silently get the DEX default when they intended a different scope.
	if (query.venueType !== undefined || query.baseAsset !== undefined) return null

	const venue = parseOptionalStringTarget(query.venue)
	const assetGroup = parseOptionalStringTarget(query.assetGroup)
	const assetClass = parseOptionalStringTarget(query.assetClass)
	const excludeAssetClass = parseOptionalStringTarget(query.excludeAssetClass)
	if (venue === null || assetGroup === null || assetClass === null || excludeAssetClass === null) return null

	if (!hasExactlyOneTarget([venue, assetGroup, assetClass, excludeAssetClass])) {
		if (venue || assetGroup || assetClass || excludeAssetClass) return null
		return { kind: 'all' }
	}
	if (venue) return { kind: 'venue', slug: venue }
	if (assetGroup) return { kind: 'assetGroup', slug: assetGroup }
	if (assetClass) return { kind: 'assetClass', slug: assetClass }
	if (!excludeAssetClass) return null
	return { kind: 'excludeAssetClass', slug: excludeAssetClass }
}

function parsePerpsMarketChartTarget(query: ApiQuery): RWAPerpsMarketBreakdownTarget | null {
	const baseAsset = parseOptionalStringTarget(query.baseAsset)
	if (baseAsset === null) return null
	if (baseAsset === undefined) return parsePerpsChartTarget(query)
	if (
		query.venue !== undefined ||
		query.assetGroup !== undefined ||
		query.assetClass !== undefined ||
		query.excludeAssetClass !== undefined ||
		query.venueType !== undefined
	) {
		return null
	}
	return { kind: 'baseAsset', slug: baseAsset }
}

export function parsePerpsOverviewBreakdownRequest(req: { query: ApiQuery }): IRWAPerpsOverviewBreakdownRequest | null {
	const breakdown = parseEnumQueryValue(req.query.breakdown, RWA_PERPS_OVERVIEW_BREAKDOWNS)
	const key = parsePerpsChartMetricKey(req.query.key)
	if (breakdown == null || key == null) return null

	const target = parsePerpsChartTarget(req.query)
	const includeCex = parseBooleanQueryFlag(req.query.includeCex, false)
	if (target == null || includeCex == null) return null
	if (target.kind === 'venue') {
		return breakdown === 'venue' ? null : { breakdown, key, target, includeCex }
	}
	if (target.kind === 'assetGroup') {
		return breakdown === 'assetGroup' ? null : { breakdown, key, target, includeCex }
	}
	return { breakdown, key, target, includeCex }
}

function buildPerpsOverviewBreakdownCacheKey(request: IRWAPerpsOverviewBreakdownRequest): string {
	const searchParams = new URLSearchParams({ breakdown: request.breakdown, key: request.key })
	setRWAPerpsChartScope(searchParams, request)
	return `/api/public/rwa/perps/overview-breakdown?${searchParams.toString()}`
}

export const rwaPerpsOverviewBreakdown = defineApiRoute({
	route: '/api/public/rwa/perps/overview-breakdown',
	cacheControl: RWA_BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const request = parsePerpsOverviewBreakdownRequest(req)

		if (request == null) {
			return badRequest('Invalid query parameters')
		}

		try {
			if (!(await hasKnownPerpsTarget(request.target))) {
				return notFound('RWA perps target not found')
			}

			const result = await cachedJsonResult(
				'rwa-perps-overview-breakdown',
				buildPerpsOverviewBreakdownCacheKey(request),
				{ ttlMs: RWA_BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2 },
				async () => {
					const rows = await fetchRWAPerpsOverviewBreakdownChartData(request)
					if (rows == null) {
						throw new Error('RWA perps overview breakdown upstream returned no data')
					}
					return toRWAPerpsBreakdownChartDataset(rows)
				}
			)
			return okSerializedJson(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch upstream chart data')
		}
	}
})

export function parsePerpsContractBreakdownRequest(req: { query: ApiQuery }): IRWAPerpsContractBreakdownRequest | null {
	const key = parsePerpsChartMetricKey(req.query.key)
	if (key == null) return null

	const target = parsePerpsChartTarget(req.query)
	const includeCex = parseBooleanQueryFlag(req.query.includeCex, false)
	return target == null || includeCex == null ? null : { key, target, includeCex }
}

function buildPerpsContractBreakdownCacheKey(request: IRWAPerpsContractBreakdownRequest): string {
	const searchParams = new URLSearchParams({ key: request.key })
	setRWAPerpsChartScope(searchParams, request)
	return `/api/public/rwa/perps/contract-breakdown?${searchParams.toString()}`
}

export const rwaPerpsContractBreakdown = defineApiRoute({
	route: '/api/public/rwa/perps/contract-breakdown',
	cacheControl: RWA_BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const request = parsePerpsContractBreakdownRequest(req)

		if (request == null) {
			return badRequest('Invalid query parameters')
		}

		try {
			if (!(await hasKnownPerpsTarget(request.target))) {
				return notFound('RWA perps target not found')
			}

			const result = await cachedJsonResult(
				'rwa-perps-contract-breakdown',
				buildPerpsContractBreakdownCacheKey(request),
				{ ttlMs: RWA_BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2 },
				async () => {
					const rows = await fetchRWAPerpsContractBreakdownChartData(request)
					if (rows == null) {
						throw new Error('RWA perps contract breakdown upstream returned no data')
					}
					return toRWAPerpsBreakdownChartDataset(rows)
				}
			)
			return okSerializedJson(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch upstream chart data')
		}
	}
})

export function parsePerpsMarketBreakdownRequest(req: { query: ApiQuery }): IRWAPerpsMarketBreakdownRequest | null {
	const key = parsePerpsChartMetricKey(req.query.key)
	if (key == null) return null

	const target = parsePerpsMarketChartTarget(req.query)
	const includeCex = parseBooleanQueryFlag(req.query.includeCex, false)
	return target == null || includeCex == null ? null : { key, target, includeCex }
}

function buildPerpsMarketBreakdownCacheKey(request: IRWAPerpsMarketBreakdownRequest): string {
	const searchParams = new URLSearchParams({ key: request.key })
	setRWAPerpsChartScope(searchParams, request)
	return `/api/public/rwa/perps/market-breakdown?${searchParams.toString()}`
}

export const rwaPerpsMarketBreakdown = defineApiRoute({
	route: '/api/public/rwa/perps/market-breakdown',
	cacheControl: RWA_BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const request = parsePerpsMarketBreakdownRequest(req)

		if (request == null) {
			return badRequest('Invalid query parameters')
		}

		try {
			if (!(await hasKnownPerpsTarget(request.target))) {
				return notFound('RWA perps target not found')
			}

			const result = await cachedJsonResult(
				'rwa-perps-market-breakdown',
				buildPerpsMarketBreakdownCacheKey(request),
				{ ttlMs: RWA_BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2, maxEntries: 48 },
				async () => {
					const rows = await fetchRWAPerpsMarketBreakdownChartData(request)
					if (rows == null) {
						throw new Error('RWA perps market breakdown upstream returned no data')
					}
					return toRWAPerpsBreakdownChartDataset(rows)
				}
			)
			return okSerializedJson(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch upstream chart data')
		}
	}
})

export const rwaAssetBreakdown = defineApiRoute({
	route: '/api/public/rwa/asset-breakdown',
	cacheControl: RWA_BREAKDOWN_CACHE_CONTROL,
	handle: async (req) => {
		const request = parseAssetBreakdownRequest(req)

		if (request == null) {
			return badRequest('Invalid query parameters')
		}

		try {
			if (!(await isKnownAssetBreakdownTarget(request.target))) {
				return notFound('RWA target not found')
			}

			const cacheKey = buildAssetBreakdownCacheKey(request)
			const result = await cachedJsonResult(
				'rwa-asset-breakdown',
				cacheKey,
				{ ttlMs: RWA_BREAKDOWN_RESULT_TTL_MS, ttlJitter: 0.2, maxEntries: 192 },
				async () => {
					const rows = await fetchRWAAssetBreakdownRows({
						target: request.target,
						metric: request.key,
						includeStablecoins: request.includeStablecoin,
						includeGovernance: request.includeGovernance,
						includeBridgeTvl: request.includeBridgeTvl,
						timeout: 30_000
					})
					return rwaRowsInMilliseconds(rows)
				}
			)
			return okSerializedJson(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch upstream chart data')
		}
	}
})
