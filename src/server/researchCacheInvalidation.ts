import { purgeCloudflareResearchUrls, type CloudflarePurgeResult } from '~/server/cloudflarePurge'

export type ScheduledResearchCacheUpdate = {
	purgePaths: Array<string>
	status: 'scheduled'
}

type ResearchCacheOptions = {
	logger?: Pick<Console, 'log'>
}

export async function purgeResearchCaches(
	purgePaths: Array<string>,
	{ logger = console }: ResearchCacheOptions = {}
): Promise<CloudflarePurgeResult> {
	const cloudflare = await purgeCloudflareResearchUrls(purgePaths)
	if (cloudflare.status === 'failed') {
		logger.log(`Research cache: Cloudflare purge failed: ${cloudflare.reason}`)
	}
	return cloudflare
}

export function scheduleResearchCachePurge(
	purgePaths: Array<string>,
	{ logger = console }: ResearchCacheOptions = {}
): ScheduledResearchCacheUpdate {
	purgeResearchCaches(purgePaths, { logger }).catch((error) => {
		logger.log(`Research cache purge failed: ${error instanceof Error ? error.message : String(error)}`)
	})

	return { purgePaths, status: 'scheduled' }
}
