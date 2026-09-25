import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import { DATASET_SNAPSHOT_CONTRACT, DATASET_SNAPSHOT_DOMAINS } from '../contract'
import { FileDatasetSnapshotStore } from '../fileStore.server'
import { publishDatasetSnapshotDomain, publishDatasetSnapshots } from '../publish.server'
import {
	DATASET_SNAPSHOT_RETAINED_VERSION_COUNT,
	type DatasetSnapshotHandle,
	type DatasetSnapshotStore
} from '../store'

const current: DatasetSnapshotHandle = {
	ref: { domain: 'yields', snapshotId: 'current', formatVersion: 2, schemaVersion: 1, createdAt: 950 },
	readJson: vi.fn()
}

describe('dataset snapshot publisher', () => {
	test('reuses a domain that is still fresh', async () => {
		const store: DatasetSnapshotStore = {
			getCurrent: vi.fn().mockResolvedValue(current),
			publish: vi.fn()
		}

		await expect(publishDatasetSnapshotDomain('yields', store, () => 1000)).resolves.toEqual({ status: 'reused' })
		expect(store.publish).not.toHaveBeenCalled()
	})

	test('keeps a compatible stale snapshot when publication fails', async () => {
		const error = new Error('upstream failed')
		const store: DatasetSnapshotStore = {
			getCurrent: vi.fn().mockResolvedValue(current),
			publish: vi.fn().mockRejectedValue(error)
		}

		await expect(publishDatasetSnapshotDomain('yields', store, () => 1_000_000_000)).resolves.toEqual({
			status: 'stale_if_error',
			error
		})
	})

	test('attempts every domain while preserving independently successful publications', async () => {
		const store: DatasetSnapshotStore = {
			getCurrent: vi.fn().mockResolvedValue(null),
			publish: vi.fn(async (domain) => {
				if (domain === 'yields') throw new Error('upstream failed')
				return { ...current, ref: { ...current.ref, domain } } as DatasetSnapshotHandle
			})
		}

		await expect(publishDatasetSnapshots({ store, logger: { log: vi.fn() } })).rejects.toThrow(
			'yields: upstream failed'
		)
		expect(store.publish).toHaveBeenCalledTimes(DATASET_SNAPSHOT_DOMAINS.length)
	})

	test('prunes every published domain down to the retained versions on disk', async () => {
		const rootDir = await mkdtemp(path.join(os.tmpdir(), 'dataset-snapshot-publish-'))
		try {
			const store = new FileDatasetSnapshotStore(rootDir)
			for (const domain of DATASET_SNAPSHOT_DOMAINS) {
				for (let version = 0; version < DATASET_SNAPSHOT_RETAINED_VERSION_COUNT + 2; version += 1) {
					await store.publish(domain, async (writer) => {
						for (const relativePath of Object.values(DATASET_SNAPSHOT_CONTRACT[domain].files)) {
							await writer.writeJson(relativePath, { version })
						}
					})
				}
			}

			await publishDatasetSnapshots({ store, logger: { log: vi.fn() } })

			for (const domain of DATASET_SNAPSHOT_DOMAINS) {
				expect((await store.getStats(domain)).versionCount, domain).toBe(DATASET_SNAPSHOT_RETAINED_VERSION_COUNT)
			}
		} finally {
			await rm(rootDir, { recursive: true, force: true })
		}
	})

	test('does not turn maintenance failures into publication failures', async () => {
		const logger = { log: vi.fn() }
		const store: DatasetSnapshotStore = {
			getCurrent: vi.fn().mockResolvedValue(current),
			publish: vi.fn(),
			pruneVersions: vi.fn().mockRejectedValue(new Error('cleanup failed')),
			getStats: vi.fn().mockRejectedValue(new Error('stat failed'))
		}

		await expect(publishDatasetSnapshots({ store, logger })).resolves.toBeUndefined()
		expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('version cleanup failed'))
		expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('size diagnostics unavailable'))
	})

	test('reports stale retention without failing the aggregate preparation step', async () => {
		const logger = { log: vi.fn() }
		const store: DatasetSnapshotStore = {
			getCurrent: vi.fn().mockResolvedValue(current),
			publish: vi.fn().mockRejectedValue(new Error('upstream failed'))
		}

		await expect(publishDatasetSnapshots({ store, logger })).resolves.toBeUndefined()
		expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('refresh failed; keeping previous snapshot'))
		expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('retained stale'))
	})
})
