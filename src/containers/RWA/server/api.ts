import { RWA_SERVER_URL } from '~/constants'
import {
	fetchRWAAssetGroupBreakdownChartData,
	fetchRWACategoryBreakdownChartData,
	fetchRWAChainBreakdownChartData,
	fetchRWAPlatformBreakdownChartData,
	rwaUnixSecondsToMilliseconds
} from '~/containers/RWA/api'
import type {
	IRWAChartDataByAsset,
	IRWAChartMetricRows,
	RWAChartMetricKey,
	RWAAssetChartTarget,
	RWAOverviewBreakdownRequest
} from '~/containers/RWA/api.types'
import { toOverviewBreakdownChartDataset } from '~/containers/RWA/breakdownDataset'
import {
	fetchRWAPerpsContractBreakdownChartData,
	fetchRWAPerpsMarketBreakdownChartData,
	fetchRWAPerpsOverviewBreakdownChartData,
	setRWAPerpsChartTarget
} from '~/containers/RWA/Perps/api'
import { toRWAPerpsBreakdownChartDataset } from '~/containers/RWA/Perps/breakdownDataset'
import {
	parseChartMetricKey as parsePerpsChartMetricKey,
	parseOptionalTarget
} from '~/containers/RWA/Perps/requestParsers'
import type {
	IRWAPerpsContractBreakdownRequest,
	IRWAPerpsMarketBreakdownRequest,
	IRWAPerpsOverviewBreakdownRequest,
	RWAPerpsChartTarget
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
import { fetchJson } from '~/utils/async'
import { recordRouteRuntimeError } from '~/utils/telemetry'

type RWAAssetBreakdownRequest = {
	target: RWAAssetChartTarget
	key: RWAChartMetricKey
	includeStablecoin: boolean
	includeGovernance: boolean
}

const RWA_CHART_METRIC_KEYS = ['onChainMcap', 'activeMcap', 'defiActiveTvl'] as const

export function buildAssetBreakdownUrl(request: RWAAssetBreakdownRequest): string {
	let pathname: string

	switch (request.target.kind) {
		case 'all':
			pathname = `${RWA_SERVER_URL}/chart/chain/all/asset-breakdown`
			break
		case 'chain':
			pathname = `${RWA_SERVER_URL}/chart/chain/${encodeURIComponent(rwaSlug(request.target.slug))}/asset-breakdown`
			break
		case 'category':
			pathname = `${RWA_SERVER_URL}/chart/category/${encodeURIComponent(rwaSlug(request.target.slug))}/asset-breakdown`
			break
		case 'platform':
			pathname = `${RWA_SERVER_URL}/chart/platform/${encodeURIComponent(rwaSlug(request.target.slug))}/asset-breakdown`
			break
		case 'assetGroup':
			pathname = `${RWA_SERVER_URL}/chart/assetGroup/${encodeURIComponent(rwaSlug(request.target.slug))}/asset-breakdown`
			break
		default:
			return assertNever(request.target)
	}

	const searchParams = new URLSearchParams({
		includeStablecoin: String(request.includeStablecoin),
		includeGovernance: String(request.includeGovernance)
	})

	return `${pathname}?${searchParams.toString()}`
}

export function normalizeAssetBreakdownRows(rows: IRWAChartMetricRows): IRWAChartMetricRows {
	return rows.map((row) => ({ ...row, timestamp: rwaUnixSecondsToMilliseconds(row.timestamp) }))
}

function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`)
}

function parseChartMetricKey(value: string | string[] | undefined): RWAChartMetricKey | null {
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

	if (target == null || key == null || includeStablecoin == null || includeGovernance == null) {
		return null
	}

	return {
		target,
		key,
		includeStablecoin,
		includeGovernance
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
		includeGovernance: String(request.includeGovernance)
	})
	return `/api/public/rwa/asset-breakdown?${searchParams.toString()}`
}

const RWA_BREAKDOWN_RESULT_TTL_MS = 30 * 60 * 1000
const RWA_BREAKDOWN_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=1800'

const RWA_OVERVIEW_BREAKDOWNS = ['chain', 'category', 'platform', 'assetGroup'] as const

export function parseRWAOverviewBreakdownRequest(req: { query: ApiQuery }): RWAOverviewBreakdownRequest | null {
	const breakdown = parseEnumQueryValue(req.query.breakdown, RWA_OVERVIEW_BREAKDOWNS)
	const key = parseChartMetricKey(req.query.key)
	if (breakdown == null || key == null) return null

	const includeStablecoin = parseBooleanQueryFlag(req.query.includeStablecoin, false)
	const includeGovernance = parseBooleanQueryFlag(req.query.includeGovernance, false)
	if (includeStablecoin == null || includeGovernance == null) return null

	if (breakdown === 'chain') {
		return { breakdown, key, includeStablecoin, includeGovernance }
	}

	if (breakdown === 'category') {
		return { breakdown, key, includeStablecoin, includeGovernance }
	}

	if (breakdown === 'platform') {
		return { breakdown, key, includeStablecoin, includeGovernance }
	}

	if (breakdown === 'assetGroup') {
		return { breakdown, key, includeStablecoin, includeGovernance }
	}

	return null
}

function fetchOverviewBreakdownRows(request: RWAOverviewBreakdownRequest) {
	switch (request.breakdown) {
		case 'chain':
			return fetchRWAChainBreakdownChartData(request)
		case 'category':
			return fetchRWACategoryBreakdownChartData(request)
		case 'platform':
			return fetchRWAPlatformBreakdownChartData(request)
		case 'assetGroup':
			return fetchRWAAssetGroupBreakdownChartData(request)
		default:
			return assertNever(request)
	}
}

function buildOverviewBreakdownCacheKey(request: RWAOverviewBreakdownRequest): string {
	const searchParams = new URLSearchParams({
		breakdown: request.breakdown,
		key: request.key,
		includeStablecoin: String(request.includeStablecoin),
		includeGovernance: String(request.includeGovernance)
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

async function hasKnownPerpsTarget(target: RWAPerpsChartTarget): Promise<boolean> {
	if (target.kind !== 'venue' && target.kind !== 'assetGroup') return true

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	if (target.kind === 'venue') {
		const requestSlug = rwaSlug(target.slug)
		for (const venue of metadataCache.rwaPerpsList.venues) {
			if (rwaSlug(venue) === requestSlug) return true
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
	const venue = parseOptionalTarget(query.venue)
	const assetGroup = parseOptionalTarget(query.assetGroup)
	const assetClass = parseOptionalTarget(query.assetClass)
	const excludeAssetClass = parseOptionalTarget(query.excludeAssetClass)
	if (venue === null || assetGroup === null || assetClass === null || excludeAssetClass === null) return null

	if (!hasExactlyOneTarget([venue, assetGroup, assetClass, excludeAssetClass])) {
		return venue || assetGroup || assetClass || excludeAssetClass ? null : { kind: 'all' }
	}
	if (venue) return { kind: 'venue', slug: venue }
	if (assetGroup) return { kind: 'assetGroup', slug: assetGroup }
	if (assetClass) return { kind: 'assetClass', slug: assetClass }
	return excludeAssetClass ? { kind: 'excludeAssetClass', slug: excludeAssetClass } : null
}

export function parsePerpsOverviewBreakdownRequest(req: { query: ApiQuery }): IRWAPerpsOverviewBreakdownRequest | null {
	const breakdown = parseEnumQueryValue(req.query.breakdown, RWA_PERPS_OVERVIEW_BREAKDOWNS)
	const key = parsePerpsChartMetricKey(req.query.key)
	if (breakdown == null || key == null) return null

	const target = parsePerpsChartTarget(req.query)
	if (target == null) return null
	if (target.kind === 'venue') {
		return breakdown === 'venue' ? null : { breakdown, key, target }
	}
	if (target.kind === 'assetGroup') {
		return breakdown === 'assetGroup' ? null : { breakdown, key, target }
	}
	return { breakdown, key, target }
}

function buildPerpsOverviewBreakdownCacheKey(request: IRWAPerpsOverviewBreakdownRequest): string {
	const searchParams = new URLSearchParams({ breakdown: request.breakdown, key: request.key })
	setRWAPerpsChartTarget(searchParams, request.target)
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
	return target == null ? null : { key, target }
}

function buildPerpsContractBreakdownCacheKey(request: IRWAPerpsContractBreakdownRequest): string {
	const searchParams = new URLSearchParams({ key: request.key })
	setRWAPerpsChartTarget(searchParams, request.target)
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

	const target = parsePerpsChartTarget(req.query)
	if (target == null || target.kind === 'venue' || target.kind === 'assetGroup') return null
	return { key, target }
}

function buildPerpsMarketBreakdownCacheKey(request: IRWAPerpsMarketBreakdownRequest): string {
	const searchParams = new URLSearchParams({ key: request.key })
	setRWAPerpsChartTarget(searchParams, request.target)
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
					const raw = await fetchJson<IRWAChartDataByAsset>(buildAssetBreakdownUrl(request), {
						timeout: 30_000
					})
					return normalizeAssetBreakdownRows(raw[request.key])
				}
			)
			return okSerializedJson(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch upstream chart data')
		}
	}
})
