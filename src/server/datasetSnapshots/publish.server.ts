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
): Promise<'published' | 'reused'> {
	const registration = DATASET_SNAPSHOT_REGISTRY[domain]
	const current = await store.getCurrent(domain)
	if (current && now() - current.ref.createdAt <= registration.maxAgeMs) return 'reused'
	await store.publish(domain, registration.builder)
	return 'published'
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
	for (let index = 0; index < results.length; index += 1) {
		const result = results[index]
		if (result.status === 'rejected') {
			const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
			failures.push(`${DATASET_SNAPSHOT_DOMAINS[index]}: ${message}`)
		} else if (result.value === 'published') {
			published++
		}
		if (result.status === 'fulfilled') {
			await maintainPublishedDomain(DATASET_SNAPSHOT_DOMAINS[index], store, logger)
		}
	}
	if (failures.length > 0) throw new Error(`Dataset snapshot publication failed:\n${failures.join('\n')}`)
	logger.log(
		`[dev:prepare] Dataset snapshots: published ${published}, reused ${DATASET_SNAPSHOT_DOMAINS.length - published}`
	)
}
