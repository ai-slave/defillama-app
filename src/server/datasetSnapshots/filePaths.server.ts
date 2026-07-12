import path from 'node:path'
import type { DatasetSnapshotDomain } from './contract'

/** Canonical local-disk layout for the filesystem store adapter. */
export const DATASET_SNAPSHOT_RELATIVE_ROOT = '.cache/dataset-snapshots'

export function getDatasetSnapshotRoot(projectDir = process.cwd()): string {
	return path.resolve(projectDir, DATASET_SNAPSHOT_RELATIVE_ROOT)
}

export function getDatasetSnapshotDomainRoot(rootDir: string, domain: DatasetSnapshotDomain): string {
	return path.join(rootDir, domain)
}

export function getDatasetSnapshotCurrentPath(rootDir: string, domain: DatasetSnapshotDomain): string {
	return path.join(getDatasetSnapshotDomainRoot(rootDir, domain), 'current.json')
}

export function getDatasetSnapshotVersionsDir(rootDir: string, domain: DatasetSnapshotDomain): string {
	return path.join(getDatasetSnapshotDomainRoot(rootDir, domain), 'versions')
}

export function getDatasetSnapshotVersionDir(
	rootDir: string,
	domain: DatasetSnapshotDomain,
	snapshotId: string
): string {
	return path.join(getDatasetSnapshotVersionsDir(rootDir, domain), snapshotId)
}
