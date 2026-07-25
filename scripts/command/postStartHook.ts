import type { LogLike } from './logger'

type PostStartHookOptions = {
	env?: NodeJS.ProcessEnv
	fetchImpl?: typeof fetch
	logger?: LogLike
}

type PostStartHookResult =
	| { reason: string; status: 'skipped' }
	| { status: 'triggered' }
	| { reason: string; status: 'failed' }

const DEFAULT_INVALIDATION_URL = 'https://defillama.com/_wipe-cache'

export async function runPostStartHook({
	env = process.env,
	fetchImpl = fetch,
	logger = console
}: PostStartHookOptions = {}): Promise<PostStartHookResult> {
	const invalidationAuth = env.LB_CACHE_INVALIDATION_AUTH?.trim()
	if (!invalidationAuth) {
		logger.log('LB_CACHE_INVALIDATION_AUTH is not set, skipping cache invalidation')
		return { reason: 'missing LB cache invalidation auth', status: 'skipped' }
	}

	const buildId = env.NEXT_BUILD_ID?.trim()
	if (!buildId) {
		logger.log('NEXT_BUILD_ID is not set, skipping cache invalidation')
		return { reason: 'missing Next build ID', status: 'skipped' }
	}

	const invalidationUrl = env.LB_CACHE_INVALIDATION_URL?.trim() || DEFAULT_INVALIDATION_URL
	logger.log(`Triggering load-balancer cache invalidation for build ${buildId}`)

	let response: Response
	try {
		response = await fetchImpl(invalidationUrl, {
			headers: {
				'X-Build-ID': buildId,
				'X-Purge-Token': invalidationAuth
			},
			method: 'POST'
		})
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error)
		logger.log(`Load-balancer cache invalidation trigger failed: ${reason}`)
		return { reason, status: 'failed' }
	}

	if (!response.ok) {
		const body = await response.text()
		const reason = body || `HTTP ${response.status}`
		logger.log(`Load-balancer cache invalidation trigger failed: ${reason}`)
		return { reason, status: 'failed' }
	}

	return { status: 'triggered' }
}
