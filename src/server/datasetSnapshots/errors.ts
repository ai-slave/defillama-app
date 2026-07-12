import type { DatasetSnapshotDomain } from './contract'

/** Integrity errors distinguish corrupt durable data from ordinary upstream failures. */

export class DatasetSnapshotIntegrityError extends Error {
	constructor(
		public readonly domain: DatasetSnapshotDomain,
		public readonly relativePath: string,
		cause: unknown
	) {
		const message = cause instanceof Error ? cause.message : String(cause)
		super(`Dataset snapshot "${domain}/${relativePath}" is invalid: ${message}`, { cause })
		this.name = 'DatasetSnapshotIntegrityError'
	}
}

export function isDatasetSnapshotIntegrityError(error: unknown): error is DatasetSnapshotIntegrityError {
	return error instanceof DatasetSnapshotIntegrityError
}

export function isMissingDatasetSnapshotArtifact(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false
	if ('code' in error && error.code === 'ENOENT') return true
	return 'cause' in error && isMissingDatasetSnapshotArtifact(error.cause)
}
