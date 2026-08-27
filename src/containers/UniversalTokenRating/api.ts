import { timingSafeEqual } from 'node:crypto'
import { ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import type { ApiRequest, ApiResult } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { fetchUtrLeaderboardStrict, leaderboardRowsFromResponse } from './server'
import type { UtrLeaderboardResponse, UtrLeaderboardTableApiResponse } from './types'

const ROUTE = '/api/private/utr/leaderboard'
const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

function headerValue(req: ApiRequest, name: string): string | null {
	const value = req.headers[name]
	if (Array.isArray(value)) return value.find(Boolean) ?? null
	return typeof value === 'string' && value ? value : null
}

function bearerToken(req: ApiRequest): string | null {
	const authorization = headerValue(req, 'authorization')
	const match = authorization?.match(/^Bearer\s+(.+)$/i)
	return match?.[1]?.trim() || null
}

function secretsMatch(provided: string, expected: string): boolean {
	const providedBuffer = Buffer.from(provided)
	const expectedBuffer = Buffer.from(expected)
	return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)
}

function errorResult(status: number, error: string): ApiResult {
	return { status, body: { error }, headers: PRIVATE_NO_STORE }
}

export function leaderboardTableResponse(leaderboard: UtrLeaderboardResponse): UtrLeaderboardTableApiResponse {
	return {
		configVersion: leaderboard.configVersion,
		generatedAt: leaderboard.generatedAt,
		scoredCount: leaderboard.scoredCount,
		totalCount: leaderboard.totalCount,
		rows: leaderboardRowsFromResponse(leaderboard).map((row) => ({
			rank: row.scores.rank,
			asset: row.asset,
			coingeckoId: row.coingeckoId ?? null,
			projectName: row.name,
			symbol: row.symbol,
			sector: row.sector,
			listingStatus: row.listingStatus,
			grade: row.grade ?? null,
			overallScore: row.scores.overall,
			overallMomChangePct: row.scores.overallMomChangePct,
			disclosureScore: row.scores.disclosure,
			performanceScore: row.scores.performance,
			fdvUsd: row.fdvUsd
		}))
	}
}

export function createUtrLeaderboardApi(
	fetchLeaderboard: () => Promise<UtrLeaderboardResponse> = fetchUtrLeaderboardStrict
) {
	return defineApiRoute({
		route: ROUTE,
		methods: ['GET'],
		cacheControl: 'private, no-store, max-age=0',
		handle: async (req) => {
			const expectedKey = process.env.UTR_LEADERBOARD_API_KEY?.trim()
			if (!expectedKey) return errorResult(503, 'UTR leaderboard API is not configured')

			const providedKey = bearerToken(req)
			if (!providedKey || !secretsMatch(providedKey, expectedKey)) {
				return errorResult(401, 'Unauthorized')
			}

			try {
				return ok(leaderboardTableResponse(await fetchLeaderboard()), PRIVATE_NO_STORE)
			} catch (error) {
				recordRouteRuntimeError(error, 'apiRoute')
				return { ...upstreamError('Failed to load UTR leaderboard'), headers: PRIVATE_NO_STORE }
			}
		}
	})
}

export const utrLeaderboardApi = createUtrLeaderboardApi()
