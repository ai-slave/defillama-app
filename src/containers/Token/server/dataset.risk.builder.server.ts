/** Builds the unpublished token-risk artifact; the snapshot store owns publication. */
import { getTokenRiskBorrowCapacityFromNetwork } from '~/containers/Token/api'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotWriter } from '~/server/datasetSnapshots/store'
import { buildIndexedBorrowCapacitySnapshot } from './dataset.risk.transform'

export async function buildRiskDomain(writer: DatasetSnapshotWriter): Promise<void> {
	const files = DATASET_SNAPSHOT_CONTRACT.risk.files

	const data = await getTokenRiskBorrowCapacityFromNetwork()
	await writer.writeJson(files.indexed, buildIndexedBorrowCapacitySnapshot(data))
}
