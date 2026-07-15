import Redis from 'ioredis'

const TOKENS_CACHE_INTERVAL_MS = 5 * 60 * 1000
const TOKENS_SHARED_SNAPSHOT_TTL_SECONDS = (TOKENS_CACHE_INTERVAL_MS * 2) / 1000

let sharedSnapshotCache: Redis | null | undefined

function getSharedSnapshotCache(): Redis | null {
	if (sharedSnapshotCache !== undefined) return sharedSnapshotCache

	const redisUrl = process.env.REDIS_URL
	if (!redisUrl) {
		sharedSnapshotCache = null
		return null
	}

	sharedSnapshotCache = new Redis(redisUrl, { connectTimeout: 2_000, maxRetriesPerRequest: 1 })
	sharedSnapshotCache.on('error', () => {})
	return sharedSnapshotCache
}

export function getTokensCacheRevision(): number {
	return Math.floor(Date.now() / TOKENS_CACHE_INTERVAL_MS)
}

export function getTokensCacheControl(revision: number): string {
	if (revision !== getTokensCacheRevision()) return 'private, no-store'

	const nextRevisionAt = (revision + 1) * TOKENS_CACHE_INTERVAL_MS
	const secondsUntilNextRevision = Math.max(1, Math.ceil((nextRevisionAt - Date.now()) / 1000))
	return `public, s-maxage=${secondsUntilNextRevision}, must-revalidate`
}

export const TOKENS_SOURCE_CACHE_TTL_MS = TOKENS_CACHE_INTERVAL_MS
export const TOKENS_MARKET_SNAPSHOT_CACHE_TTL_MS = TOKENS_CACHE_INTERVAL_MS * 2

/**
 * The first runtime to publish a revision wins. Other runtimes read that same
 * immutable value instead of independently sampling the mutable upstream file.
 */
export async function getOrCreateSharedTokensSnapshot<T>(revision: number, create: () => Promise<T>): Promise<T> {
	const cache = getSharedSnapshotCache()
	if (!cache) return create()

	const key = `tokens-market-snapshot:v1:${revision}`
	try {
		const cached = await cache.get(key)
		if (cached) return JSON.parse(cached) as T
	} catch {}

	const candidate = await create()
	try {
		const serialized = JSON.stringify(candidate)
		const stored = await cache.set(key, serialized, 'EX', TOKENS_SHARED_SNAPSHOT_TTL_SECONDS, 'NX')
		if (stored === 'OK') return candidate

		const winner = await cache.get(key)
		if (winner) return JSON.parse(winner) as T
	} catch {}

	return candidate
}
