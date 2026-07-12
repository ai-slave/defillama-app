import type { DatasetSnapshotDomain, DatasetSnapshotRef } from './contract'

/** Storage-neutral contracts implemented by local disk or a future shared store. */

export const DATASET_SNAPSHOT_RETAINED_VERSION_COUNT = 2

/** Immutable, typed view of one complete domain generation. */
export interface DatasetSnapshotHandle {
	readonly ref: DatasetSnapshotRef
	readJson<T>(relativePath: string): Promise<T>
}

/** Opaque artifact sink used by domain builders; it has no filesystem API. */
export interface DatasetSnapshotWriter {
	writeJson(relativePath: string, value: unknown): Promise<void>
}

export type DatasetSnapshotBuilder = (writer: DatasetSnapshotWriter) => Promise<void>

export type DatasetSnapshotStoreStats = {
	artifactCount: number
	totalBytes: number
	versionCount: number
}

/**
 * Durable snapshot adapter boundary.
 *
 * Implementations publish immutable generations and change the current pointer
 * only after the builder completes and every artifact validates.
 */
export interface DatasetSnapshotStore {
	getCurrent(domain: DatasetSnapshotDomain): Promise<DatasetSnapshotHandle | null>
	publish(domain: DatasetSnapshotDomain, builder: DatasetSnapshotBuilder): Promise<DatasetSnapshotHandle>
	/** Optional adapter maintenance. Publication correctness never depends on cleanup or diagnostics. */
	pruneVersions?(domain: DatasetSnapshotDomain, retainedVersionCount: number): Promise<void>
	getStats?(domain: DatasetSnapshotDomain): Promise<DatasetSnapshotStoreStats>
}
