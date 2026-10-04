import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, vi } from 'vitest'
import type { DatasetSnapshotDomain } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotBuilder } from '~/server/datasetSnapshots/store'

/** Load the real snapshot store against a fresh directory for each test. */
export function installSnapshotDirectory(prefix: string) {
	let directory: string
	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), `${prefix}-`))
		vi.spyOn(process, 'cwd').mockReturnValue(directory)
		vi.resetModules()
	})
	afterEach(async () => {
		vi.mocked(process.cwd).mockRestore()
		await rm(directory, { recursive: true, force: true })
	})
}

/**
 * A refresh that lands mid-response: once the first acquisition has read the current generation, the real
 * store publishes `next`, and every later acquisition waits for it and gets `next`.
 */
export async function publishAfterFirstAcquisition(domain: DatasetSnapshotDomain, next: DatasetSnapshotBuilder) {
	const { fileDatasetSnapshotStore } = await import('~/server/datasetSnapshots/fileStore.server')
	const getCurrent = fileDatasetSnapshotStore.getCurrent.bind(fileDatasetSnapshotStore)
	let published: Promise<unknown> | null = null
	vi.spyOn(fileDatasetSnapshotStore, 'getCurrent').mockImplementation(async (requested) => {
		if (published) {
			await published
			return getCurrent(requested)
		}
		const current = getCurrent(requested)
		// Set before awaiting, so a concurrent acquisition waits for the publish instead of reading first.
		published = current.then(() => fileDatasetSnapshotStore.publish(domain, next))
		await published
		return current
	})
}
