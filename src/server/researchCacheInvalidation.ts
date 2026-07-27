import { purgeCloudflareResearchUrls, type CloudflarePurgeResult } from '~/server/cloudflarePurge'
import { fanoutRevalidate, type InstanceRevalidateResult } from '~/server/revalidateInstances'

export type ResearchCacheTargets = {
	purgePaths: string[]
	revalidatePaths: string[]
}

export type ScheduledResearchCacheUpdate = ResearchCacheTargets & {
	status: 'scheduled'
}

export type ResearchCacheUpdateResult = {
	cloudflare: CloudflarePurgeResult
	instances: InstanceRevalidateResult[]
	revalidateErrors: { path: string; reason: string }[]
	revalidated: string[]
}

type RevalidatePath = (path: string) => Promise<void>

type ResearchCacheOptions = {
	logger?: Pick<Console, 'log'>
}

export async function updateResearchCaches(
	targets: ResearchCacheTargets,
	revalidate: RevalidatePath,
	{ logger = console }: ResearchCacheOptions = {}
): Promise<ResearchCacheUpdateResult> {
	const revalidated: string[] = []
	const revalidateErrors: { path: string; reason: string }[] = []

	for (const path of targets.revalidatePaths) {
		try {
			await revalidate(path)
			revalidated.push(path)
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			revalidateErrors.push({ path, reason })
			logger.log(`Research cache: revalidating ${path} failed: ${reason}`)
		}
	}

	const fanout = await fanoutRevalidate(targets.revalidatePaths)
	const cloudflare = await purgeCloudflareResearchUrls(targets.purgePaths)
	if (cloudflare.status === 'failed') {
		logger.log(`Research cache: Cloudflare purge failed: ${cloudflare.reason}`)
	}

	return { cloudflare, instances: fanout.instances, revalidateErrors, revalidated }
}

export function scheduleResearchCacheUpdate(
	targets: ResearchCacheTargets,
	revalidate: RevalidatePath,
	{ logger = console }: ResearchCacheOptions = {}
): ScheduledResearchCacheUpdate {
	updateResearchCaches(targets, revalidate, { logger }).catch((error) => {
		logger.log(`Research cache update failed: ${error instanceof Error ? error.message : String(error)}`)
	})

	return { purgePaths: targets.purgePaths, revalidatePaths: targets.revalidatePaths, status: 'scheduled' }
}
