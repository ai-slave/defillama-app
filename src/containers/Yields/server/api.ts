import { YIELDS_SERVER_URL } from '~/constants'
import { queryString } from '~/server/api/params'
import { badRequest, ok, okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { recordRouteRuntimeError } from '~/utils/telemetry'

// The current immutable snapshot handle memoizes parsed artifacts by snapshot ID.
// Per-request work is light query shaping, so no result cache is needed here.
const YIELDS_RESPONSE_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=3600'

// chartLendBorrow/holders proxy the yields server directly; holders payloads
// are multi-MB and these routes average multiple seconds, so upstream
// fetch+parse is memoized and concurrent identical requests share one fetch.
const YIELDS_SERVER_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=600'
const YIELDS_SERVER_RESULT_TTL_MS = 10 * 60 * 1000

const CONFIG_ID_REGEX = /^[\da-f-]{36}$/i

async function fetchYieldsServerJson(path: string): Promise<unknown> {
	const upstream = await fetchWithPoolingOnServer(`${YIELDS_SERVER_URL}${path}`)
	if (!upstream.ok) {
		throw new Error(`Yields server responded with ${upstream.status} for ${path}`)
	}
	return upstream.json()
}

export const yieldsDataset = defineApiRoute({
	route: '/api/public/yields',
	cacheControl: YIELDS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const { chains, token } = req.query
			const tokenFilter = typeof token === 'string' ? token.trim() : Array.isArray(token) ? token[0]?.trim() : ''
			const { acquireYieldsSnapshot, getTokenYieldsRows } =
				await import('~/containers/Yields/server/snapshot.reader.server')
			const snapshot = await acquireYieldsSnapshot('background')
			return ok(await getTokenYieldsRows(snapshot, tokenFilter, chains))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch yields data')
		}
	}
})

export const yieldsTokenBorrowRoutes = defineApiRoute({
	route: '/api/public/yields/token-borrow-routes',
	cacheControl: YIELDS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		const tokenQuery = req.query.token
		const token =
			typeof tokenQuery === 'string'
				? tokenQuery.trim().toUpperCase()
				: Array.isArray(tokenQuery)
					? tokenQuery[0]?.trim().toUpperCase()
					: ''

		if (!token) {
			return badRequest('Missing token query param')
		}

		try {
			const { acquireYieldsSnapshot, getTokenBorrowRoutes } =
				await import('~/containers/Yields/server/snapshot.reader.server')
			const snapshot = await acquireYieldsSnapshot('background')
			return ok(await getTokenBorrowRoutes(snapshot, token))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			// Historical contract: token pages key off this exact header to skip
			// client-side retry caching on loader failures.
			return {
				...upstreamError('Failed to fetch token borrow routes data'),
				headers: { 'Cache-Control': 'private, no-store' }
			}
		}
	}
})

export const yieldsHalalDataset = defineApiRoute({
	route: '/api/public/yields/halal',
	cacheControl: YIELDS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const { acquireYieldsSnapshot, getYieldHalalPage } =
				await import('~/containers/Yields/server/snapshot.reader.server')
			const snapshot = await acquireYieldsSnapshot('background')
			return ok(await getYieldHalalPage(snapshot, req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch halal yield data')
		}
	}
})

export const yieldsLoopDataset = defineApiRoute({
	route: '/api/public/yields/loop',
	cacheControl: YIELDS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const { acquireYieldsSnapshot, getYieldLoopPage } =
				await import('~/containers/Yields/server/snapshot.reader.server')
			const snapshot = await acquireYieldsSnapshot('background')
			return ok(await getYieldLoopPage(snapshot, req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch yield loop data')
		}
	}
})

export const yieldsPoolsDataset = defineApiRoute({
	route: '/api/public/yields/pools',
	cacheControl: YIELDS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const { acquireYieldsSnapshot, getYieldPoolsPage } =
				await import('~/containers/Yields/server/snapshot.reader.server')
			const snapshot = await acquireYieldsSnapshot('background')
			return ok(await getYieldPoolsPage(snapshot, req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch yield pools data')
		}
	}
})

export const yieldsStrategyLongShortDataset = defineApiRoute({
	route: '/api/public/yields/strategy-long-short',
	cacheControl: YIELDS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const { acquireYieldsSnapshot, getYieldLongShortPage } =
				await import('~/containers/Yields/server/snapshot.reader.server')
			const snapshot = await acquireYieldsSnapshot('background')
			return ok(await getYieldLongShortPage(snapshot, req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch yield long short strategy data')
		}
	}
})

export const yieldsStrategyDataset = defineApiRoute({
	route: '/api/public/yields/strategy',
	cacheControl: YIELDS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const { acquireYieldsSnapshot, getYieldStrategyPage } =
				await import('~/containers/Yields/server/snapshot.reader.server')
			const snapshot = await acquireYieldsSnapshot('background')
			return ok(await getYieldStrategyPage(snapshot, req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch yield strategy data')
		}
	}
})

export const borrowDataset = defineApiRoute({
	route: '/api/public/yields/borrow',
	cacheControl: YIELDS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const { acquireYieldsSnapshot, getBorrowPageRows } =
				await import('~/containers/Yields/server/snapshot.reader.server')
			const snapshot = await acquireYieldsSnapshot('background')
			return ok(await getBorrowPageRows(snapshot, req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch borrow data')
		}
	}
})

export const borrowAdvancedDataset = defineApiRoute({
	route: '/api/public/yields/borrow-advanced',
	cacheControl: YIELDS_RESPONSE_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const { acquireYieldsSnapshot, getBorrowAdvancedPageRows } =
				await import('~/containers/Yields/server/snapshot.reader.server')
			const snapshot = await acquireYieldsSnapshot('background')
			return ok(await getBorrowAdvancedPageRows(snapshot, req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch borrow advanced data')
		}
	}
})

export const chartLendBorrowDataset = defineApiRoute({
	route: '/api/public/yields/lend-borrow/charts/[configID]',
	cacheControl: YIELDS_SERVER_CACHE_CONTROL,
	handle: async (req) => {
		const configID = queryString(req.query, 'configID')
		if (!configID || !CONFIG_ID_REGEX.test(configID)) {
			return badRequest('Invalid configID')
		}

		try {
			const data = await cachedJsonResult(
				'datasets-chart-lend-borrow',
				configID,
				{ ttlMs: YIELDS_SERVER_RESULT_TTL_MS, ttlJitter: 0.2 },
				() => fetchYieldsServerJson(`/chartLendBorrow/${configID}`)
			)
			return okSerializedJson(data)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Upstream error')
		}
	}
})

export const holdersDataset = defineApiRoute({
	route: '/api/public/yields/holders',
	cacheControl: YIELDS_SERVER_CACHE_CONTROL,
	handle: async () => {
		try {
			const data = await cachedJsonResult(
				'datasets-holders',
				'/api/public/yields/holders',
				{ ttlMs: YIELDS_SERVER_RESULT_TTL_MS, ttlJitter: 0.2 },
				() => fetchYieldsServerJson('/holders')
			)
			return okSerializedJson(data)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Upstream error')
		}
	}
})

export const holdersByConfigDataset = defineApiRoute({
	route: '/api/public/yields/holders/[configID]',
	cacheControl: YIELDS_SERVER_CACHE_CONTROL,
	handle: async (req) => {
		const configID = queryString(req.query, 'configID')
		if (!configID || !CONFIG_ID_REGEX.test(configID)) {
			return badRequest('Invalid configID')
		}

		try {
			const data = await cachedJsonResult(
				'datasets-holders-config',
				configID,
				{ ttlMs: YIELDS_SERVER_RESULT_TTL_MS, ttlJitter: 0.2 },
				() => fetchYieldsServerJson(`/holders/${configID}`)
			)
			return okSerializedJson(data)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Upstream error')
		}
	}
})
