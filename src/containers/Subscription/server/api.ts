import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { fetchRWAStats } from '~/containers/RWA/api'
import { ok, upstreamError } from '~/server/api/respond'
import { cachedResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import type { SubscriptionCoverageData } from '../coverage'

export const subscriptionCoverage = defineApiRoute({
	route: '/api/public/subscription/coverage',
	cacheControl:
		process.env.NODE_ENV === 'production' ? 'public, s-maxage=300, stale-while-revalidate=3600' : 'no-store',
	handle: async () => {
		try {
			const { acquireYieldsSnapshot, readEarn } = await import('~/containers/Yields/server/dataset.server')
			const [coverage, yields] = await Promise.all([
				// Only live upstream work is cached here; the yield count always comes from the pinned snapshot.
				cachedResult('subscription-coverage', 'current', { ttlMs: 5 * 60 * 1000 }, async () => {
					const [listing, rwa] = await Promise.all([fetchProtocols(), fetchRWAStats()])
					const nowSec = Math.floor(Date.now() / 1000)
					return {
						protocols: listing.protocols.length,
						protocolsAddedThisWeek: listing.protocols.filter(
							({ listedAt }) => listedAt != null && listedAt > nowSec - 7 * 24 * 60 * 60 && listedAt <= nowSec
						).length,
						chains: listing.chains.length,
						rwaAssets: rwa.assetCount
					}
				}),
				acquireYieldsSnapshot('background').then(readEarn)
			])
			return ok({ ...coverage, yieldPools: yields.length } satisfies SubscriptionCoverageData)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Coverage data is temporarily unavailable')
		}
	}
})
