import type { GetServerSidePropsContext } from 'next'
import { fetchEntityQuestions } from '~/containers/LlamaAI/api'
import { getAuthTokenFromRequest } from '~/containers/ProDashboard/server/auth'
import { cachedResult } from '~/server/api/resultCache'
import { jitterCacheControlHeader, maxAgeForNext } from '~/utils/maxAgeForNext'
import type { EarnViewProps } from '../views/EarnView'
import { resolveSubscription } from './requestSubscription'

const PRIVATE_CACHE_CONTROL = 'private, no-store'
const QUESTIONS_MEMORY = { ttlMs: 10 * 60 * 1000, ttlJitter: 0.2, maxEntries: 8, maxBytes: 256 * 1024 }

/**
 * Props for an earn document. Anonymous requests are publicly cached and redacted. A request
 * carrying the session cookie is rendered per user, so a subscriber's first paint already holds
 * the measured rows and the response never enters the shared cache.
 */
export async function loadEarnPageProps(
	{ req, res }: Pick<GetServerSidePropsContext, 'req' | 'res'>,
	route: string,
	query: Record<string, string> = {}
): Promise<EarnViewProps> {
	const [{ getEarnPageMeta }, { getEarnPage }, { acquireYieldsSnapshot }] = await Promise.all([
		import('../data/earnMeta.server'),
		import('../data/earn.server'),
		import('./dataset.server')
	])
	const token = getAuthTokenFromRequest(req)
	const [snapshot, subscription] = await Promise.all([acquireYieldsSnapshot('blocking'), resolveSubscription(token)])
	const verifiedAccess = subscription === true
	const [metadata, initialEarnPage, { questions: entityQuestions }] = await Promise.all([
		getEarnPageMeta(snapshot),
		// Unresolved entitlement ships no rows: the client fetches its own tier instead of seeing the wrong one.
		subscription === null ? Promise.resolve(null) : getEarnPage(snapshot, query, { verifiedAccess }),
		cachedResult(
			'yields:entity-questions',
			'page',
			QUESTIONS_MEMORY,
			() => fetchEntityQuestions('yields', 'page'),
			() => 2048
		)
	])

	res.setHeader('Vary', 'Cookie, Authorization')
	res.setHeader(
		'Cache-Control',
		token
			? PRIVATE_CACHE_CONTROL
			: jitterCacheControlHeader(`public, s-maxage=${maxAgeForNext([23])}, stale-while-revalidate=3600`, route)
	)

	return {
		...metadata,
		entityQuestions,
		initialEarnPage,
		initialEarnPageGeneratedAt: snapshot.generatedAt,
		initialEarnPageVerifiedAccess: verifiedAccess
	}
}
