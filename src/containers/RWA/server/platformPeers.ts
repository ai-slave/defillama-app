import { fetchRWAStats } from '~/containers/RWA/api'
import { buildRWAPlatformPeerRows } from '~/containers/RWA/PlatformPage/buildPlatformPageData'
import { okSerializedJson, upstreamError } from '~/server/api/respond'
import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'

const RWA_PLATFORM_PEERS_ROUTE = '/api/public/rwa/platform-peers'
const RWA_PLATFORM_PEERS_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=1800'

export const rwaPlatformPeers = defineApiRoute({
	route: RWA_PLATFORM_PEERS_ROUTE,
	cacheControl: RWA_PLATFORM_PEERS_CACHE_CONTROL,
	handle: async () => {
		try {
			const result = await cachedJsonResult(
				'rwa-platform-peers',
				RWA_PLATFORM_PEERS_ROUTE,
				{ ttlMs: 60 * 60 * 1000, ttlJitter: 0.2 },
				async () => {
					const [metadataCache, stats] = await Promise.all([
						import('~/utils/metadata').then((module) => module.default),
						fetchRWAStats()
					])
					return buildRWAPlatformPeerRows(metadataCache.rwaPlatformsIndex, stats)
				}
			)
			return okSerializedJson(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to load RWA platform peers')
		}
	}
})
