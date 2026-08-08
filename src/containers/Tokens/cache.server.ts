const TOKENS_CACHE_INTERVAL_MS = 5 * 60 * 1000

/** The wall-clock five-minute window a timestamp falls in. */
export function tokensCacheWindow(atMs: number): number {
	return Math.floor(atMs / TOKENS_CACHE_INTERVAL_MS)
}

/** Whether a build belongs to the CURRENT wall-clock window. */
export function isCurrentTokensWindow(generatedAt: number): boolean {
	return tokensCacheWindow(generatedAt) === tokensCacheWindow(Date.now())
}

export const TOKENS_SOURCE_CACHE_TTL_MS = TOKENS_CACHE_INTERVAL_MS

/**
 * Every edge copy of a tokens response expires at the same wall-clock
 * five-minute boundary, so all CDN nodes flip to fresh data together. A
 * response built in an earlier boundary window must not be cached forward
 * into the current one.
 */
export function getTokensCacheControl(generatedAt: number): string {
	const now = Date.now()
	if (!isCurrentTokensWindow(generatedAt)) return 'private, no-store'

	const bucketEndsAt = (tokensCacheWindow(now) + 1) * TOKENS_CACHE_INTERVAL_MS
	const secondsUntilBucketEnd = Math.max(1, Math.ceil((bucketEndsAt - now) / 1000))
	return `public, s-maxage=${secondsUntilBucketEnd}, must-revalidate`
}
