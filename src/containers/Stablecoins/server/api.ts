import {
	fetchStablecoinChainVolumeChartApi,
	fetchStablecoinChartApi,
	fetchStablecoinTokenVolumeChartApi,
	fetchStablecoinVolumeChartApi
} from '~/containers/Stablecoins/api'
import type {
	StablecoinVolumeChainChartKind,
	StablecoinVolumeChartResponse,
	StablecoinVolumeGlobalChartKind,
	StablecoinVolumeTokenChartKind
} from '~/containers/Stablecoins/api.types'
import {
	STABLECOIN_CHART_CACHE_CONTROL,
	type StablecoinAssetChartType,
	type StablecoinChainsChartType,
	type StablecoinOverviewChartType,
	type StablecoinSeriesSelectionIntent
} from '~/containers/Stablecoins/chartSeries'
import {
	getStablecoinAssetChartSeries,
	getStablecoinChainsChartSeries,
	getStablecoinOverviewChartSeries
} from '~/containers/Stablecoins/queries.server'
import { getStablecoinValueFromPoint } from '~/containers/Stablecoins/utils'
import { buildStablecoinVolumeChartPayload } from '~/containers/Stablecoins/volumeChart'
import { queryString } from '~/server/api/params'
import { badRequest, notFound, ok, upstreamError } from '~/server/api/respond'
import { cachedResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { isTruthyQueryParam } from '~/utils/routerQuery'
import { recordRouteRuntimeError } from '~/utils/telemetry'

type StablecoinMcapSeriesPoint = [number, number]

// ---------------------------------------------------------------------------
// /api/public/stablecoins/chart
// ---------------------------------------------------------------------------

function buildStablecoinMcapSeries(
	aggregated: Awaited<ReturnType<typeof fetchStablecoinChartApi>>['aggregated']
): StablecoinMcapSeriesPoint[] {
	const series: StablecoinMcapSeriesPoint[] = []
	for (const point of aggregated ?? []) {
		const timestamp = +point.date * 1e3
		const mcap = getStablecoinValueFromPoint(point, 'totalCirculatingUSD')
		if (Number.isFinite(timestamp) && Number.isFinite(mcap)) series.push([timestamp, mcap])
	}
	return series
}

export const stablecoinMcapChart = defineApiRoute({
	route: '/api/public/stablecoins/chart',
	cacheControl: 'public, max-age=300',
	handle: async (req) => {
		const chain = queryString(req.query, 'chain')
		if (!chain) {
			return badRequest('chain parameter is required')
		}

		try {
			// The legacy stablecoin chart API uses this special label for the global
			// aggregate instead of accepting "all" directly.
			const chainLabel = chain.toLowerCase() === 'all' ? 'all-llama-app' : chain
			const data = await fetchStablecoinChartApi(chainLabel)

			return ok(buildStablecoinMcapSeries(data.aggregated))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch stablecoin chart')
		}
	}
})

// ---------------------------------------------------------------------------
// /api/public/stablecoins/chart-series
// ---------------------------------------------------------------------------

const parseLimit = (value: string | string[] | undefined): number | undefined => {
	const raw = Array.isArray(value) ? value[0] : value
	if (!raw) return undefined
	const parsed = Math.trunc(Number(raw))
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const parseSeriesSelectionIntent = (
	query: Record<string, string | string[] | undefined>
): StablecoinSeriesSelectionIntent | 'invalid' => {
	const includes = isTruthyQueryParam(query.include) || isTruthyQueryParam(query.selected)
	const excludes = isTruthyQueryParam(query.exclude)
	if (includes && excludes) return 'invalid'
	if (!includes && !excludes) return null
	const names = Array.isArray(query.series) ? query.series : query.series ? [query.series] : []
	if (excludes && names.length === 0) return null
	return { mode: excludes ? 'exclude' : 'include', names }
}

const OVERVIEW_CHARTS = new Set<StablecoinOverviewChartType>([
	'totalMcap',
	'tokenMcaps',
	'dominance',
	'usdInflows',
	'tokenInflows'
])
const CHAINS_CHARTS = new Set<StablecoinChainsChartType>(['totalMcap', 'chainMcaps', 'dominance'])
const ASSET_CHARTS = new Set<StablecoinAssetChartType>(['totalCirc', 'chainMcaps', 'chainDominance'])

export const stablecoinChartSeries = defineApiRoute({
	route: '/api/public/stablecoins/chart-series',
	cacheControl: STABLECOIN_CHART_CACHE_CONTROL,
	handle: async (req) => {
		const scope = queryString(req.query, 'scope')
		const rawChart = queryString(req.query, 'chart')
		if (!scope || !rawChart) {
			return badRequest('scope and chart parameters are required')
		}
		const seriesLimit = parseLimit(req.query.limit)
		const selectionIntent = parseSeriesSelectionIntent(req.query)
		if (selectionIntent === 'invalid') return badRequest('include and exclude cannot be combined')
		const selectedNames = selectionIntent?.mode === 'include' ? selectionIntent.names : null
		const excludedNames = selectionIntent?.mode === 'exclude' ? selectionIntent.names : null

		try {
			if (scope === 'overview') {
				if (!OVERVIEW_CHARTS.has(rawChart as StablecoinOverviewChartType)) {
					return badRequest('unsupported overview chart')
				}
				const chain = queryString(req.query, 'chain')
				if (!chain) return badRequest('chain parameter is required')
				const [{ default: metadataCache }, { resolveChainParamFromMetadata }] = await Promise.all([
					import('~/utils/metadata'),
					import('~/containers/ChainOverview/server/routes')
				])
				const isAllChain = chain.toLowerCase() === 'all'
				const chainRoute = isAllChain ? null : resolveChainParamFromMetadata(chain, metadataCache)
				if (!isAllChain && !chainRoute) return notFound('chain not found')
				const payload = await getStablecoinOverviewChartSeries({
					chain: isAllChain ? null : chainRoute.canonicalName,
					chart: rawChart as StablecoinOverviewChartType,
					...(seriesLimit == null ? {} : { seriesLimit }),
					...(selectedNames == null ? {} : { selectedNames }),
					...(excludedNames == null ? {} : { excludedNames }),
					filters: {
						attribute: req.query.attribute,
						excludeAttribute: req.query.excludeAttribute,
						pegtype: req.query.pegtype,
						excludePegtype: req.query.excludePegtype,
						backing: req.query.backing,
						excludeBacking: req.query.excludeBacking,
						minMcap: req.query.minMcap,
						maxMcap: req.query.maxMcap
					}
				})
				return ok(payload)
			}

			if (scope === 'chains') {
				if (!CHAINS_CHARTS.has(rawChart as StablecoinChainsChartType)) {
					return badRequest('unsupported chains chart')
				}
				const chart = rawChart as StablecoinChainsChartType
				const includeUnreleased = isTruthyQueryParam(req.query.unreleased)
				const payload =
					selectedNames == null && excludedNames == null
						? seriesLimit == null
							? await getStablecoinChainsChartSeries(chart, includeUnreleased)
							: await getStablecoinChainsChartSeries(chart, includeUnreleased, seriesLimit)
						: await getStablecoinChainsChartSeries(chart, includeUnreleased, seriesLimit, selectedNames, excludedNames)
				return ok(payload)
			}

			if (scope === 'asset') {
				if (!ASSET_CHARTS.has(rawChart as StablecoinAssetChartType)) {
					return badRequest('unsupported asset chart')
				}
				const stablecoin = queryString(req.query, 'stablecoin')
				if (!stablecoin) return badRequest('stablecoin parameter is required')
				const [{ default: metadataCache }, { resolveStablecoinAssetParamFromMetadata }] = await Promise.all([
					import('~/utils/metadata'),
					import('~/containers/Stablecoins/server/routes')
				])
				const stablecoinSlug = resolveStablecoinAssetParamFromMetadata(stablecoin, metadataCache)
				if (!stablecoinSlug) return notFound('stablecoin not found')
				const payload = await getStablecoinAssetChartSeries({
					peggedasset: stablecoinSlug,
					chart: rawChart as StablecoinAssetChartType,
					includeUnreleased: isTruthyQueryParam(req.query.unreleased),
					...(seriesLimit == null ? {} : { seriesLimit }),
					...(selectedNames == null ? {} : { selectedNames }),
					...(excludedNames == null ? {} : { excludedNames })
				})
				if (!payload) return notFound('stablecoin not found')
				return ok(payload)
			}

			return badRequest('unsupported scope')
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch stablecoin chart series')
		}
	}
})

// ---------------------------------------------------------------------------
// /api/public/stablecoins/volume-chart
// ---------------------------------------------------------------------------

const GLOBAL_CHARTS = new Set<StablecoinVolumeGlobalChartKind>(['total', 'chain', 'token', 'currency'])
const CHAIN_CHARTS = new Set<StablecoinVolumeChainChartKind>(['total', 'token', 'currency'])
const TOKEN_CHARTS = new Set<StablecoinVolumeTokenChartKind>(['total', 'chain'])
const VOLUME_SOURCE_CACHE_OPTIONS = {
	ttlMs: 5 * 60 * 1000,
	staleWhileRevalidateMs: 5 * 60 * 1000,
	maxEntries: 128
} as const

export const stablecoinVolumeChart = defineApiRoute({
	route: '/api/public/stablecoins/volume-chart',
	cacheControl: STABLECOIN_CHART_CACHE_CONTROL,
	handle: async (req) => {
		const scope = queryString(req.query, 'scope') ?? 'global'
		const rawChart = queryString(req.query, 'chart')
		if (!rawChart) {
			return badRequest('valid chart parameter is required')
		}
		const selectionIntent = parseSeriesSelectionIntent(req.query)
		if (selectionIntent === 'invalid') return badRequest('include and exclude cannot be combined')
		const selectedNames = selectionIntent?.mode === 'include' ? selectionIntent.names : null
		const excludedNames = selectionIntent?.mode === 'exclude' ? selectionIntent.names : null

		try {
			let chart: StablecoinVolumeGlobalChartKind | StablecoinVolumeChainChartKind | StablecoinVolumeTokenChartKind
			let data: StablecoinVolumeChartResponse
			if (scope === 'global') {
				if (!GLOBAL_CHARTS.has(rawChart as StablecoinVolumeGlobalChartKind)) {
					return badRequest('unsupported global volume chart')
				}
				chart = rawChart as StablecoinVolumeGlobalChartKind
				data = await cachedResult('stablecoin-volume-source', `global:${chart}`, VOLUME_SOURCE_CACHE_OPTIONS, () =>
					fetchStablecoinVolumeChartApi(chart as StablecoinVolumeGlobalChartKind)
				)
			} else if (scope === 'chain') {
				if (!CHAIN_CHARTS.has(rawChart as StablecoinVolumeChainChartKind)) {
					return badRequest('unsupported chain volume chart')
				}
				const chain = queryString(req.query, 'chain')
				if (!chain) return badRequest('chain parameter is required')
				const [{ default: metadataCache }, { resolveChainParamFromMetadata }] = await Promise.all([
					import('~/utils/metadata'),
					import('~/containers/ChainOverview/server/routes')
				])
				const chainRoute = resolveChainParamFromMetadata(chain, metadataCache)
				if (!chainRoute) return notFound('chain not found')
				chart = rawChart as StablecoinVolumeChainChartKind
				data = await cachedResult(
					'stablecoin-volume-source',
					`chain:${chainRoute.canonicalName}:${chart}`,
					VOLUME_SOURCE_CACHE_OPTIONS,
					() =>
						fetchStablecoinChainVolumeChartApi(
							chainRoute.canonicalName,
							chart as StablecoinVolumeChainChartKind,
							metadataCache.chainMetadata
						)
				)
			} else if (scope === 'token') {
				if (!TOKEN_CHARTS.has(rawChart as StablecoinVolumeTokenChartKind)) {
					return badRequest('unsupported token volume chart')
				}
				const token = queryString(req.query, 'token')
				if (!token) return badRequest('token parameter is required')
				chart = rawChart as StablecoinVolumeTokenChartKind
				data = await cachedResult(
					'stablecoin-volume-source',
					`token:${token}:${chart}`,
					VOLUME_SOURCE_CACHE_OPTIONS,
					() => fetchStablecoinTokenVolumeChartApi(token, chart as StablecoinVolumeTokenChartKind)
				)
			} else {
				return badRequest('unsupported scope')
			}

			const payload = buildStablecoinVolumeChartPayload(data, {
				chart,
				limit: parseLimit(req.query.limit),
				selectedNames,
				excludedNames,
				trimIncompleteTail: scope === 'global'
			})

			return ok(payload)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch stablecoin volume chart')
		}
	}
})
