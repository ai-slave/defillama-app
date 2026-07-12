export const VERCEL_STATIC_GENERATION_MAX_CONCURRENCY = 2

/** Keep high-memory prerenders bounded on Vercel without slowing Coolify builds. */
export function getStaticGenerationConfig(vercel: string | undefined) {
	return vercel
		? {
				staticGenerationMaxConcurrency: VERCEL_STATIC_GENERATION_MAX_CONCURRENCY
			}
		: undefined
}
