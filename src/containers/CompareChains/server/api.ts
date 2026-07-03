import { fetchChain } from '~/containers/CompareChains/chainFetcher'
import { queryString } from '~/server/api/params'
import { badRequest, notFound, okSerializedJson } from '~/server/api/respond'
import { cachedJsonResult } from '~/server/api/resultCache'
import { defineApiRoute } from '~/server/api/types'
import { getObjectCache, setObjectCache } from '~/utils/cache-client'

// fetchChain fans out to many upstream calls and averages multiple seconds,
// so on top of the shared object cache the assembled response is memoized in
// process (keyed by canonical chain slug) and concurrent identical requests
// share one computation.
const CHAIN_RESULT_TTL_MS = 5 * 60 * 1000
const CHAIN_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600'

type ChainCachePayload = Awaited<ReturnType<typeof fetchChain>>

function unwrapChainCachePayload(value: unknown): ChainCachePayload {
	if (value && typeof value === 'object' && 'chain' in value) {
		return (value as { chain: ChainCachePayload }).chain
	}
	return value as ChainCachePayload
}

export const chainCache = defineApiRoute({
	route: '/api/dynamic/cache/chain/[chain]',
	cacheControl: CHAIN_CACHE_CONTROL,
	handle: async (req) => {
		const chainParam = queryString(req.query, 'chain')
		if (typeof chainParam !== 'string' || chainParam.length === 0) {
			return badRequest('Missing chain parameter')
		}

		const [{ default: metadataCache }, { resolveChainParamFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ChainOverview/server/routes')
		])
		const chainRoute = resolveChainParamFromMetadata(chainParam, metadataCache)
		if (!chainRoute) {
			return notFound('Chain not found')
		}

		const response = await cachedJsonResult(
			'chain-cache',
			chainRoute.canonicalSlug,
			{ ttlMs: CHAIN_RESULT_TTL_MS, ttlJitter: 0.2 },
			async () => {
				const cacheKey = `object-chain-${chainRoute.canonicalSlug}`

				const cachedData = await getObjectCache(cacheKey)
				if (cachedData) {
					return unwrapChainCachePayload(cachedData)
				}

				const chainData = await fetchChain({
					chain: chainRoute.canonicalName,
					chainMetadata: metadataCache.chainMetadata,
					categoriesAndTagsMetadata: metadataCache.categoriesAndTags,
					protocolMetadata: metadataCache.protocolMetadata
				})

				await setObjectCache(cacheKey, chainData)
				return chainData
			}
		)
		return okSerializedJson(response)
	}
})
