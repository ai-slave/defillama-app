import { DATASET_SNAPSHOT_DOMAINS, type DatasetSnapshotDomain } from './contract'
import { getDatasetSnapshotRoot } from './filePaths.server'
import { FileDatasetSnapshotStore } from './fileStore.server'
import { DATASET_SNAPSHOT_REGISTRY } from './registry.server'
import { DATASET_SNAPSHOT_RETAINED_VERSION_COUNT, type DatasetSnapshotStore } from './store'

/** Build-time/scheduled publisher using the same atomic path as runtime refresh. */

function formatBytes(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

async function maintainPublishedDomain(
	domain: DatasetSnapshotDomain,
	store: DatasetSnapshotStore,
	logger: Pick<Console, 'log'>
): Promise<void> {
	if (store.pruneVersions) {
		try {
			await store.pruneVersions(domain, DATASET_SNAPSHOT_RETAINED_VERSION_COUNT)
		} catch {
			logger.log(`[dev:prepare] Dataset snapshot ${domain}: version cleanup failed; published data is unchanged`)
		}
	}

	if (store.getStats) {
		try {
			const stats = await store.getStats(domain)
			logger.log(
				`[dev:prepare] Dataset snapshot ${domain}: ${formatBytes(stats.totalBytes)}, ${stats.artifactCount} artifacts, ${stats.versionCount} versions`
			)
		} catch {
			logger.log(`[dev:prepare] Dataset snapshot ${domain}: size diagnostics unavailable`)
		}
	}
}

export async function publishDatasetSnapshotDomain(
	domain: DatasetSnapshotDomain,
	store: DatasetSnapshotStore,
	now = Date.now
): Promise<{ status: 'published' } | { status: 'reused' } | { status: 'stale_if_error'; error: unknown }> {
	const registration = DATASET_SNAPSHOT_REGISTRY[domain]
	const current = await store.getCurrent(domain)
	if (current && now() - current.ref.createdAt <= registration.maxAgeMs) return { status: 'reused' }
	try {
		await store.publish(domain, registration.builder)
		return { status: 'published' }
	} catch (error) {
		if (current) return { status: 'stale_if_error', error }
		throw error
	}
}

export async function publishDatasetSnapshots({
	logger = console,
	projectDir = process.cwd(),
	store = new FileDatasetSnapshotStore(getDatasetSnapshotRoot(projectDir))
}: {
	logger?: Pick<Console, 'log'>
	projectDir?: string
	store?: DatasetSnapshotStore
} = {}): Promise<void> {
	const results = await Promise.allSettled(
		DATASET_SNAPSHOT_DOMAINS.map((domain) => publishDatasetSnapshotDomain(domain, store))
	)
	const failures: string[] = []
	let published = 0
	let reused = 0
	let stale = 0
	for (let index = 0; index < results.length; index += 1) {
		const result = results[index]
		const domain = DATASET_SNAPSHOT_DOMAINS[index]
		if (result.status === 'rejected') {
			const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
			failures.push(`${domain}: ${message}`)
		} else if (result.value.status === 'published') {
			published += 1
		} else if (result.value.status === 'reused') {
			reused += 1
		} else {
			stale += 1
			const message = result.value.error instanceof Error ? result.value.error.message : String(result.value.error)
			logger.log(`[dev:prepare] Dataset snapshot ${domain}: refresh failed; keeping previous snapshot (${message})`)
		}
		if (result.status === 'fulfilled') {
			await maintainPublishedDomain(domain, store, logger)
		}
	}
	if (failures.length > 0) throw new Error(`Dataset snapshot publication failed:\n${failures.join('\n')}`)
	logger.log(`[dev:prepare] Dataset snapshots: published ${published}, reused ${reused}, retained stale ${stale}`)
}
