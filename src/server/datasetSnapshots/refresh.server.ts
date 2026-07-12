import { recordRuntimeError } from '~/utils/telemetry'
import type { DatasetSnapshotDomain } from './contract'
import { fileDatasetSnapshotStore } from './fileStore.server'
import { DATASET_SNAPSHOT_REGISTRY, type DatasetSnapshotRegistration } from './registry.server'
import { DATASET_SNAPSHOT_RETAINED_VERSION_COUNT, type DatasetSnapshotHandle, type DatasetSnapshotStore } from './store'

/**
 * Runtime freshness coordinator.
 *
 * Lifetime: process-local decisions over a durable store. Stale reads coalesce
 * to one refresh per domain. Failed refreshes retain and return the last good
 * snapshot, while a missing initial snapshot still fails loudly.
 */

export type DatasetSnapshotRefreshMode = 'blocking' | 'background'

export type DatasetSnapshotAcquisition = {
	handle: DatasetSnapshotHandle
	status: 'fresh' | 'refreshed' | 'stale_refreshing' | 'stale_if_error'
}

type RefreshCoordinatorOptions = {
	store: DatasetSnapshotStore
	registry: Record<DatasetSnapshotDomain, DatasetSnapshotRegistration>
	now?: () => number
	retryBackoffMs?: number
	logger?: Pick<Console, 'warn'>
}

export class DatasetSnapshotRefreshCoordinator {
	private readonly refreshes = new Map<DatasetSnapshotDomain, Promise<DatasetSnapshotHandle>>()
	private readonly failures = new Map<DatasetSnapshotDomain, { failedAt: number; error: unknown }>()
	private readonly now: () => number
	private readonly retryBackoffMs: number
	private readonly logger: Pick<Console, 'warn'>

	constructor(
		private readonly store: DatasetSnapshotStore,
		private readonly registry: Record<DatasetSnapshotDomain, DatasetSnapshotRegistration>,
		options: Omit<RefreshCoordinatorOptions, 'store' | 'registry'> = {}
	) {
		this.now = options.now ?? Date.now
		this.retryBackoffMs = options.retryBackoffMs ?? 60_000
		this.logger = options.logger ?? console
	}

	private getBackoffFailure(domain: DatasetSnapshotDomain): unknown | null {
		const failure = this.failures.get(domain)
		return failure && this.now() - failure.failedAt < this.retryBackoffMs ? failure.error : null
	}

	private refresh(domain: DatasetSnapshotDomain): Promise<DatasetSnapshotHandle> {
		const active = this.refreshes.get(domain)
		if (active) return active

		const backoffFailure = this.getBackoffFailure(domain)
		if (backoffFailure) return Promise.reject(backoffFailure)

		const refresh = this.store
			.publish(domain, this.registry[domain].builder)
			.then((handle) => {
				this.failures.delete(domain)
				if (this.store.pruneVersions) {
					void this.store.pruneVersions(domain, DATASET_SNAPSHOT_RETAINED_VERSION_COUNT).catch(() => {
						this.logger.warn(`[dataset-snapshots] ${domain} version cleanup failed; published snapshot remains current`)
					})
				}
				return handle
			})
			.catch((error) => {
				this.failures.set(domain, { failedAt: this.now(), error })
				throw error
			})
			.finally(() => {
				this.refreshes.delete(domain)
			})
		this.refreshes.set(domain, refresh)
		return refresh
	}

	async acquire(
		domain: DatasetSnapshotDomain,
		refreshMode: DatasetSnapshotRefreshMode
	): Promise<DatasetSnapshotAcquisition> {
		const current = await this.store.getCurrent(domain)
		const maxAgeMs = this.registry[domain].maxAgeMs
		if (current && this.now() - current.ref.createdAt <= maxAgeMs) {
			return { handle: current, status: 'fresh' }
		}
		const backoffFailure = this.getBackoffFailure(domain)
		if (backoffFailure) {
			if (current) return { handle: current, status: 'stale_if_error' }
			throw backoffFailure
		}

		if (current && refreshMode === 'background') {
			void this.refresh(domain).catch((error) => {
				recordRuntimeError(error, 'unknown', { dataset_snapshot_domain: domain, refresh_mode: 'background' })
				this.logger.warn(`[dataset-snapshots] ${domain} background refresh failed; keeping previous snapshot`)
			})
			return { handle: current, status: 'stale_refreshing' }
		}

		try {
			return { handle: await this.refresh(domain), status: 'refreshed' }
		} catch (error) {
			if (current) {
				recordRuntimeError(error, 'unknown', { dataset_snapshot_domain: domain, refresh_mode: 'blocking' })
				this.logger.warn(`[dataset-snapshots] ${domain} refresh failed; serving previous snapshot`)
				return { handle: current, status: 'stale_if_error' }
			}
			throw error
		}
	}
}

export function createDatasetSnapshotRefreshCoordinator({
	store,
	registry,
	now,
	retryBackoffMs,
	logger
}: RefreshCoordinatorOptions): DatasetSnapshotRefreshCoordinator {
	return new DatasetSnapshotRefreshCoordinator(store, registry, { now, retryBackoffMs, logger })
}

export const datasetSnapshotRefreshCoordinator = new DatasetSnapshotRefreshCoordinator(
	fileDatasetSnapshotStore,
	DATASET_SNAPSHOT_REGISTRY
)

export function acquireDatasetSnapshot(
	domain: DatasetSnapshotDomain,
	refreshMode: DatasetSnapshotRefreshMode
): Promise<DatasetSnapshotAcquisition> {
	return datasetSnapshotRefreshCoordinator.acquire(domain, refreshMode)
}
