import type { DatasetSnapshotDomain } from './contract'
import { acquireDatasetSnapshot } from './refresh.server'

/**
 * Minimal server-only reader used by typed domain acquisition modules.
 *
 * Unlike the old process-pinned reader, every call resolves the current
 * version through the refresh coordinator. Parsed artifacts remain memoized on
 * that immutable version handle and refresh failures serve the last good one.
 */
export interface DatasetSnapshotReader {
	readJson<T>(domain: DatasetSnapshotDomain, relativePath: string): Promise<T>
}

export const datasetSnapshotReader: DatasetSnapshotReader = {
	async readJson<T>(domain: DatasetSnapshotDomain, relativePath: string): Promise<T> {
		const { handle } = await acquireDatasetSnapshot(domain, 'blocking')
		return handle.readJson<T>(relativePath)
	}
}

export {
	DatasetSnapshotIntegrityError,
	isDatasetSnapshotIntegrityError,
	isMissingDatasetSnapshotArtifact
} from './errors'
