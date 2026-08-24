import { BRIDGES_SERVER_URL } from '~/constants'
import type { RawBridgeTransactionsPage, RawBridgeTransactionsResponse } from '~/containers/Bridges/api.types'
import { queryString } from '~/server/api/params'
import { badRequest, ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { recordRouteRuntimeError } from '~/utils/telemetry'

const TRANSACTIONS_PAGE_LIMIT = 10_000
const cursorPattern = /^[A-Za-z0-9_-]+$/
const digitsPattern = /^\d+$/

export async function fetchBridgeTransactionsPage(
	bridgeId: string,
	startTimestamp: number,
	endTimestamp: number,
	cursor?: string
): Promise<RawBridgeTransactionsPage> {
	const params = new URLSearchParams({
		starttimestamp: String(startTimestamp),
		endtimestamp: String(endTimestamp),
		limit: String(TRANSACTIONS_PAGE_LIMIT),
		...(cursor ? { cursor } : {})
	})
	const response = await fetchWithPoolingOnServer(
		`${BRIDGES_SERVER_URL}/transactions/${encodeURIComponent(bridgeId)}?${params.toString()}`,
		{ cache: 'no-store' }
	)

	if (!response.ok) {
		throw new Error(`Bridge transactions upstream returned ${response.status}`)
	}

	const rows: RawBridgeTransactionsResponse = await response.json()
	const hasMoreHeader = response.headers.get('x-has-more')
	if (hasMoreHeader !== 'true' && hasMoreHeader !== 'false') {
		throw new Error('Bridge transactions upstream omitted X-Has-More')
	}

	const hasMore = hasMoreHeader === 'true'
	const nextCursor = response.headers.get('x-next-cursor') ?? undefined
	if (hasMore && !nextCursor) {
		throw new Error('Bridge transactions upstream omitted X-Next-Cursor')
	}

	return { rows, hasMore, ...(nextCursor ? { nextCursor } : {}) }
}

export const bridgeTransactions = defineApiRoute({
	route: '/api/public/bridges/transactions/[id]',
	cacheControl: 'no-store',
	handle: async (req) => {
		const idParam = queryString(req.query, 'id')
		const startParam = queryString(req.query, 'starttimestamp')
		const endParam = queryString(req.query, 'endtimestamp')
		const cursor = queryString(req.query, 'cursor')

		if (!idParam) {
			return badRequest('id parameter is required')
		}
		if (idParam.length > 20 || (idParam !== 'all' && !digitsPattern.test(idParam))) {
			return badRequest('id parameter must be a bridge id or all')
		}
		if (cursor !== undefined && (cursor.length === 0 || cursor.length > 512 || !cursorPattern.test(cursor))) {
			return badRequest('cursor parameter is invalid')
		}

		if (
			startParam === undefined ||
			endParam === undefined ||
			startParam.length > 20 ||
			endParam.length > 20 ||
			!digitsPattern.test(startParam) ||
			!digitsPattern.test(endParam)
		) {
			return badRequest('starttimestamp and endtimestamp must be valid integer seconds')
		}

		const startTimestamp = Number(startParam)
		const endTimestamp = Number(endParam)
		if (!Number.isSafeInteger(startTimestamp) || !Number.isSafeInteger(endTimestamp)) {
			return badRequest('starttimestamp and endtimestamp must be valid integer seconds')
		}

		if (startTimestamp >= endTimestamp) {
			return badRequest('starttimestamp must be less than endtimestamp')
		}

		try {
			// Single bounded upstream call; the observed multi-second latency lives
			// upstream, and payloads can be large (the pages adapter disables
			// responseLimit), so results are intentionally not memoized in-process.
			const data = await fetchBridgeTransactionsPage(idParam, startTimestamp, endTimestamp, cursor)
			return ok(data, { 'Cache-Control': 'no-store' })
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch bridge transactions')
		}
	}
})
