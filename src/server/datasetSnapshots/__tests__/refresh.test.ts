import { describe, expect, test, vi } from 'vitest'
import { DATASET_SNAPSHOT_DOMAINS, type DatasetSnapshotDomain } from '../contract'
import { createDatasetSnapshotRefreshCoordinator, type DatasetSnapshotAcquisition } from '../refresh.server'
import type { DatasetSnapshotRegistration } from '../registry.server'
import type {
	DatasetSnapshotBuilder,
	DatasetSnapshotHandle,
	DatasetSnapshotStore,
	DatasetSnapshotWriter
} from '../store'

function handle(snapshotId: string, createdAt: number): DatasetSnapshotHandle {
	return {
		ref: { domain: 'yields', snapshotId, formatVersion: 2, schemaVersion: 1, createdAt },
		readJson: vi.fn()
	}
}

function registry(
	builder: DatasetSnapshotBuilder,
	maxAgeMs = 100
): Record<DatasetSnapshotDomain, DatasetSnapshotRegistration> {
	return Object.fromEntries(DATASET_SNAPSHOT_DOMAINS.map((domain) => [domain, { builder, maxAgeMs }])) as Record<
		DatasetSnapshotDomain,
		DatasetSnapshotRegistration
	>
}

class FakeStore implements DatasetSnapshotStore {
	publishCount = 0
	next: DatasetSnapshotHandle | null = null
	pruneVersions = vi.fn().mockResolvedValue(undefined)

	constructor(public current: DatasetSnapshotHandle | null) {}

	async getCurrent(): Promise<DatasetSnapshotHandle | null> {
		return this.current
	}

	async publish(_domain: DatasetSnapshotDomain, builder: DatasetSnapshotBuilder): Promise<DatasetSnapshotHandle> {
		this.publishCount++
		await builder({ writeJson: vi.fn() } as DatasetSnapshotWriter)
		if (!this.next) throw new Error('Fake store has no next snapshot')
		this.current = this.next
		return this.next
	}
}

describe('dataset snapshot refresh coordinator', () => {
	test('returns a fresh snapshot without invoking its builder', async () => {
		const builder = vi.fn()
		const current = handle('current', 950)
		const store = new FakeStore(current)
		const coordinator = createDatasetSnapshotRefreshCoordinator({
			store,
			registry: registry(builder),
			now: () => 1000
		})

		await expect(coordinator.acquire('yields', 'blocking')).resolves.toEqual({ handle: current, status: 'fresh' })
		expect(builder).not.toHaveBeenCalled()
	})

	test('publishes stale snapshots once for concurrent blocking callers', async () => {
		let release: () => void = () => undefined
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const builder = vi.fn(() => gate)
		const store = new FakeStore(handle('old', 1))
		store.next = handle('new', 1000)
		const coordinator = createDatasetSnapshotRefreshCoordinator({
			store,
			registry: registry(builder),
			now: () => 1000
		})

		const first = coordinator.acquire('yields', 'blocking')
		const second = coordinator.acquire('yields', 'blocking')
		await vi.waitFor(() => expect(store.publishCount).toBe(1))
		release()
		await expect(Promise.all([first, second])).resolves.toEqual([
			{ handle: store.next, status: 'refreshed' },
			{ handle: store.next, status: 'refreshed' }
		])
		expect(store.pruneVersions).toHaveBeenCalledWith('yields', 2)
	})

	test('serves the exact previous snapshot when refresh fails and throws when none exists', async () => {
		const failure = new Error('upstream failed')
		const builder = vi.fn().mockRejectedValue(failure)
		const previous = handle('old', 1)
		const logger = { warn: vi.fn() }
		const staleStore = new FakeStore(previous)
		const staleCoordinator = createDatasetSnapshotRefreshCoordinator({
			store: staleStore,
			registry: registry(builder),
			now: () => 1000,
			logger
		})

		await expect(staleCoordinator.acquire('yields', 'blocking')).resolves.toEqual({
			handle: previous,
			status: 'stale_if_error'
		})

		const emptyCoordinator = createDatasetSnapshotRefreshCoordinator({
			store: new FakeStore(null),
			registry: registry(builder),
			now: () => 1000,
			logger
		})
		await expect(emptyCoordinator.acquire('yields', 'blocking')).rejects.toBe(failure)
	})

	test('returns stale immediately while a successful background refresh publishes the next version', async () => {
		const builder = vi.fn().mockResolvedValue(undefined)
		const previous = handle('old', 1)
		const store = new FakeStore(previous)
		store.next = handle('new', 1000)
		const coordinator = createDatasetSnapshotRefreshCoordinator({
			store,
			registry: registry(builder),
			now: () => 1000
		})

		await expect(coordinator.acquire('yields', 'background')).resolves.toEqual({
			handle: previous,
			status: 'stale_refreshing'
		})
		await vi.waitFor(() => expect(store.current).toBe(store.next))
		expect(store.publishCount).toBe(1)
	})

	test('returns stale immediately for background refresh and applies failure backoff', async () => {
		const failure = new Error('upstream failed')
		const builder = vi.fn().mockRejectedValue(failure)
		const previous = handle('old', 1)
		const store = new FakeStore(previous)
		const logger = { warn: vi.fn() }
		let now = 1000
		const coordinator = createDatasetSnapshotRefreshCoordinator({
			store,
			registry: registry(builder),
			now: () => now,
			retryBackoffMs: 100,
			logger
		})

		const result: DatasetSnapshotAcquisition = await coordinator.acquire('yields', 'background')
		expect(result).toEqual({ handle: previous, status: 'stale_refreshing' })
		await vi.waitFor(() => expect(logger.warn).toHaveBeenCalled())
		expect(store.publishCount).toBe(1)

		await expect(coordinator.acquire('yields', 'blocking')).resolves.toEqual({
			handle: previous,
			status: 'stale_if_error'
		})
		expect(store.publishCount).toBe(1)

		now = 1101
		await coordinator.acquire('yields', 'blocking')
		expect(store.publishCount).toBe(2)
	})
})
