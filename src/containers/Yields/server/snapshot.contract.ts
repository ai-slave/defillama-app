import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'

/** Yields-owned artifact names inside one immutable snapshot generation. */
export const YIELDS_SNAPSHOT_FILES = {
	...DATASET_SNAPSHOT_CONTRACT.yields.files,
	byTokenDir: DATASET_SNAPSHOT_CONTRACT.yields.optionalShardDirs.byToken
} as const
