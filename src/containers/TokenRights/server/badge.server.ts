import { fetchUtrLeaderboardStrict } from '~/containers/UniversalTokenRating/server'
import { cachedResult } from '~/server/api/resultCache'
import metadataCache from '~/utils/metadata'
import { recordRuntimeError } from '~/utils/telemetry'
import type { TokenDirectory } from '~/utils/tokenDirectory'
import type { IRawTokenRightsEntry } from '../api.types'
import {
	buildRightsById,
	buildRightsRouteById,
	buildUtrSummaryIndex,
	type TokenRightsBadgeSources,
	type TokenRightsUtrSummary
} from '../badge'
import { fetchTokenRightsEntries } from './dataset.server'

// UTR comes from Forgd, an external API, so it stays an optional live fetch instead of a dataset snapshot:
// a snapshot domain without an earlier version fails the build whenever its source is down.
const UTR_TTL_MS = 10 * 60 * 1000
// Failed fetches are not cached, so after one, skip UTR for a while instead of making every render wait out the 30s timeout.
const UTR_FAILURE_BACKOFF_MS = 60 * 1000
let utrRetryAt = 0

/** Clears the module-level UTR backoff so each test starts from a fresh process. */
export function resetUtrBackoff() {
	utrRetryAt = 0
}

async function loadUtrSummaries(): Promise<Map<string, TokenRightsUtrSummary>> {
	if (Date.now() < utrRetryAt) return new Map()
	try {
		return await cachedResult(
			'token-rights-badges',
			'utr',
			{ ttlMs: UTR_TTL_MS, staleWhileRevalidateMs: UTR_TTL_MS },
			async () => {
				const leaderboard = await fetchUtrLeaderboardStrict()
				return buildUtrSummaryIndex([...leaderboard.postTge.rows, ...leaderboard.preTge.rows])
			}
		)
	} catch (error) {
		utrRetryAt = Date.now() + UTR_FAILURE_BACKOFF_MS
		recordRuntimeError(error, 'pageBuild', { event: 'tokenRightsBadgeUtr' })
		return new Map()
	}
}

type RightsSources = Pick<TokenRightsBadgeSources, 'rightsById' | 'rightsRouteById'>

// The snapshot handle returns the same parsed entries until a new snapshot is published,
// and a metadata refresh replaces tokenDirectory, so the maps are rebuilt only when either input changes.
let rightsCache: {
	entries: Array<IRawTokenRightsEntry>
	tokenDirectory: TokenDirectory
	sources: RightsSources
} | null = null

async function loadRights(): Promise<RightsSources> {
	try {
		const entries = await fetchTokenRightsEntries()
		const tokenDirectory = metadataCache.tokenDirectory
		if (rightsCache?.entries !== entries || rightsCache.tokenDirectory !== tokenDirectory) {
			rightsCache = {
				entries,
				tokenDirectory,
				sources: {
					rightsById: buildRightsById(entries),
					rightsRouteById: buildRightsRouteById(entries, tokenDirectory)
				}
			}
		}
		return rightsCache.sources
	} catch (error) {
		recordRuntimeError(error, 'pageBuild', { event: 'tokenRightsBadgeRights' })
		return { rightsById: new Map(), rightsRouteById: new Map() }
	}
}

/** Never throws: a source that fails loads as empty, so its badges disappear and the other source's stay. */
export async function loadTokenBadgeSources(): Promise<TokenRightsBadgeSources> {
	const [rights, utrByGeckoId] = await Promise.all([loadRights(), loadUtrSummaries()])
	return {
		...rights,
		utrByGeckoId,
		protocolMetadata: metadataCache.protocolMetadata,
		chainMetadata: metadataCache.chainMetadata
	}
}
