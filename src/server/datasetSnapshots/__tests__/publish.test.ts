import { describe, expect, it, vi } from 'vitest'
import { DATASET_SNAPSHOT_DOMAINS } from '../contract'
import { publishDatasetSnapshotDomain, publishDatasetSnapshots } from '../publish.server'
import type { DatasetSnapshotHandle, DatasetSnapshotStore } from '../store'

const current: DatasetSnapshotHandle = {
	ref: { domain: 'yields', snapshotId: 'current', formatVersion: 2, schemaVersion: 1, createdAt: 950 },
	readJson: vi.fn()
}

describe('dataset snapshot publisher', () => {
	it('reuses a domain that is still fresh', async () => {
		const store: DatasetSnapshotStore = {
			getCurrent: vi.fn().mockResolvedValue(current),
			publish: vi.fn()
		}

		await expect(publishDatasetSnapshotDomain('yields', store, () => 1000)).resolves.toEqual({ status: 'reused' })
		expect(store.publish).not.toHaveBeenCalled()
	})

	it('keeps a compatible stale snapshot when publication fails', async () => {
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

	it('attempts every domain while preserving independently successful publications', async () => {
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

	it('prunes successful domains and logs aggregate storage diagnostics', async () => {
		const logger = { log: vi.fn() }
		const store: DatasetSnapshotStore = {
			getCurrent: vi.fn().mockResolvedValue(current),
			publish: vi.fn(),
			pruneVersions: vi.fn().mockResolvedValue(undefined),
			getStats: vi.fn().mockResolvedValue({ artifactCount: 12, totalBytes: 1024 * 1024, versionCount: 2 })
		}

		await publishDatasetSnapshots({ store, logger })

		expect(store.pruneVersions).toHaveBeenCalledTimes(DATASET_SNAPSHOT_DOMAINS.length)
		expect(store.getStats).toHaveBeenCalledTimes(DATASET_SNAPSHOT_DOMAINS.length)
		expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('1.0 MiB, 12 artifacts, 2 versions'))
	})

	it('does not turn maintenance failures into publication failures', async () => {
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

	it('reports stale retention without failing the aggregate preparation step', async () => {
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
