import { getDatasetIndexFileName } from '~/server/datasetSnapshots/indexKeys.server'
import { YIELDS_SNAPSHOT_FILES } from './snapshot.contract'

/** Maps a token lookup key to its portable optional-shard artifact path. */
export function getYieldsTokenIndexArtifactPath(token: string): string {
	return `${YIELDS_SNAPSHOT_FILES.byTokenDir}/${getDatasetIndexFileName(token)}`
}
