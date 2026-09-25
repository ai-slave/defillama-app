import {
	fetchStablecoinChainVolumeChartApi,
	fetchStablecoinTokenVolumeChartApi,
	fetchStablecoinVolumeChartApi
} from '~/containers/Stablecoins/api'
import type {
	StablecoinVolumeChainChartKind,
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
import {
	buildStablecoinVolumeChartPayload,
	type StablecoinVolumeChartSource
} from '~/containers/Stablecoins/volumeChart'
import { queryString } from '~/server/api/params'
import { badRequest, notFound, ok, upstreamError } from '~/server/api/respond'
import { cachedResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { isTruthyQueryParam } from '~/utils/routerQuery'
import { recordRouteRuntimeError } from '~/utils/telemetry'

type StablecoinMcapSeriesPoint = [number, number]

const resolveStablecoinOverviewChain = async (chain: string): Promise<{ chain: string | null } | null> => {
	if (chain.toLowerCase() === 'all') return { chain: null }
	const [{ default: metadataCache }, { resolveChainParamFromMetadata }] = await Promise.all([
		import('~/utils/metadata'),
		import('~/containers/ChainOverview/server/routes')
	])
	const route = resolveChainParamFromMetadata(chain, metadataCache)
	return route ? { chain: route.canonicalName } : null
}

// ---------------------------------------------------------------------------
// /api/public/stablecoins/chart
// ---------------------------------------------------------------------------

export const stablecoinMcapChart = defineApiRoute({
	route: '/api/public/stablecoins/chart',
	cacheControl: 'public, max-age=300',
	handle: async (req) => {
		const chain = queryString(req.query, 'chain')
		if (!chain) {
			return badRequest('chain parameter is required')
		}

		try {
			const resolvedChain = await resolveStablecoinOverviewChain(chain)
			if (!resolvedChain) return notFound('chain not found')
			const payload = await getStablecoinOverviewChartSeries({
				chain: resolvedChain.chain,
				chart: 'totalMcap'
			})
			const series: Array<StablecoinMcapSeriesPoint> = []
			for (const row of payload.dataset.source) {
				const timestamp = row[0]
				const mcap = row[1]
				if (typeof timestamp === 'number' && typeof mcap === 'number') series.push([timestamp, mcap])
			}
			return ok(series)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch stablecoin chart')
		}
	}
})

// ---------------------------------------------------------------------------
// /api/public/stablecoins/chart-series
// ---------------------------------------------------------------------------

export const parseLimit = (value: string | Array<string> | undefined): number | undefined => {
	const raw = Array.isArray(value) ? value[0] : value
	if (!raw) return undefined
	const parsed = Math.trunc(Number(raw))
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export const parseSeriesSelectionIntent = (
	query: Record<string, string | Array<string> | undefined>
): StablecoinSeriesSelectionIntent | 'invalid' => {
	const includes = isTruthyQueryParam(query.include) || isTruthyQueryParam(query.selected)
	const excludes = isTruthyQueryParam(query.exclude)
	if (includes && excludes) return 'invalid'
	if (!includes && !excludes) return null
	const names = Array.isArray(query.series) ? query.series : query.series ? [query.series] : []
	return { mode: excludes ? 'exclude' : 'include', names }
}

const parseOverviewChart = (value: string): StablecoinOverviewChartType | null => {
	switch (value) {
		case 'totalMcap':
		case 'tokenMcaps':
		case 'dominance':
		case 'usdInflows':
		case 'tokenInflows':
			return value
		default:
			return null
	}
}

const parseChainsChart = (value: string): StablecoinChainsChartType | null => {
	switch (value) {
		case 'totalMcap':
		case 'chainMcaps':
		case 'dominance':
			return value
		default:
			return null
	}
}

const parseAssetChart = (value: string): StablecoinAssetChartType | null => {
	switch (value) {
		case 'totalCirc':
		case 'chainMcaps':
		case 'chainDominance':
			return value
		default:
			return null
	}
}

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
				const chart = parseOverviewChart(rawChart)
				if (!chart) return badRequest('unsupported overview chart')
				const chain = queryString(req.query, 'chain')
				if (!chain) return badRequest('chain parameter is required')
				const resolvedChain = await resolveStablecoinOverviewChain(chain)
				if (!resolvedChain) return notFound('chain not found')
				const payload = await getStablecoinOverviewChartSeries({
					chain: resolvedChain.chain,
					chart,
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
				const chart = parseChainsChart(rawChart)
				if (!chart) return badRequest('unsupported chains chart')
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
				const chart = parseAssetChart(rawChart)
				if (!chart) return badRequest('unsupported asset chart')
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
					chart,
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

const parseGlobalVolumeChart = (value: string): StablecoinVolumeGlobalChartKind | null => {
	switch (value) {
		case 'total':
		case 'chain':
		case 'token':
		case 'currency':
			return value
		default:
			return null
	}
}

const parseChainVolumeChart = (value: string): StablecoinVolumeChainChartKind | null => {
	switch (value) {
		case 'total':
		case 'token':
		case 'currency':
			return value
		default:
			return null
	}
}

const parseTokenVolumeChart = (value: string): StablecoinVolumeTokenChartKind | null => {
	switch (value) {
		case 'total':
		case 'chain':
			return value
		default:
			return null
	}
}
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
			let source: StablecoinVolumeChartSource
			if (scope === 'global') {
				const chart = parseGlobalVolumeChart(rawChart)
				if (!chart) return badRequest('unsupported global volume chart')
				if (chart === 'total') {
					const data = await cachedResult('stablecoin-volume-source', 'global:total', VOLUME_SOURCE_CACHE_OPTIONS, () =>
						fetchStablecoinVolumeChartApi('total')
					)
					source = { chart, data }
				} else {
					const data = await cachedResult(
						'stablecoin-volume-source',
						`global:${chart}`,
						VOLUME_SOURCE_CACHE_OPTIONS,
						() => fetchStablecoinVolumeChartApi(chart)
					)
					source = { chart, data }
				}
			} else if (scope === 'chain') {
				const chart = parseChainVolumeChart(rawChart)
				if (!chart) return badRequest('unsupported chain volume chart')
				const chain = queryString(req.query, 'chain')
				if (!chain) return badRequest('chain parameter is required')
				const [{ default: metadataCache }, { resolveChainParamFromMetadata }] = await Promise.all([
					import('~/utils/metadata'),
					import('~/containers/ChainOverview/server/routes')
				])
				const chainRoute = resolveChainParamFromMetadata(chain, metadataCache)
				if (!chainRoute) return notFound('chain not found')
				if (chart === 'total') {
					const data = await cachedResult(
						'stablecoin-volume-source',
						`chain:${chainRoute.canonicalName}:total`,
						VOLUME_SOURCE_CACHE_OPTIONS,
						() => fetchStablecoinChainVolumeChartApi(chainRoute.canonicalName, 'total', metadataCache.chainMetadata)
					)
					source = { chart, data }
				} else {
					const data = await cachedResult(
						'stablecoin-volume-source',
						`chain:${chainRoute.canonicalName}:${chart}`,
						VOLUME_SOURCE_CACHE_OPTIONS,
						() => fetchStablecoinChainVolumeChartApi(chainRoute.canonicalName, chart, metadataCache.chainMetadata)
					)
					source = { chart, data }
				}
			} else if (scope === 'token') {
				const chart = parseTokenVolumeChart(rawChart)
				if (!chart) return badRequest('unsupported token volume chart')
				const token = queryString(req.query, 'token')
				if (!token) return badRequest('token parameter is required')
				if (chart === 'total') {
					const data = await cachedResult(
						'stablecoin-volume-source',
						`token:${token}:total`,
						VOLUME_SOURCE_CACHE_OPTIONS,
						() => fetchStablecoinTokenVolumeChartApi(token, 'total')
					)
					source = { chart, data }
				} else {
					const data = await cachedResult(
						'stablecoin-volume-source',
						`token:${token}:${chart}`,
						VOLUME_SOURCE_CACHE_OPTIONS,
						() => fetchStablecoinTokenVolumeChartApi(token, chart)
					)
					source = { chart, data }
				}
			} else {
				return badRequest('unsupported scope')
			}

			const limit = isTruthyQueryParam(req.query.all) ? null : parseLimit(req.query.limit)
			const payload = buildStablecoinVolumeChartPayload({
				...source,
				...(limit === undefined ? {} : { limit }),
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
