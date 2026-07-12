/** Typed token-risk reads and hydration over the current immutable snapshot. */
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { datasetSnapshotReader } from '~/server/datasetSnapshots/reader.server'
import {
	hydrateIndexedBorrowCapacitySnapshot,
	type IndexedBorrowCapacitySnapshot,
	type IndexedTokenRiskBorrowCapacity
} from './dataset.risk.transform'

export async function getIndexedTokenRiskBorrowCapacity(): Promise<IndexedTokenRiskBorrowCapacity> {
	const snapshot = await datasetSnapshotReader.readJson<IndexedBorrowCapacitySnapshot>(
		'risk',
		DATASET_SNAPSHOT_CONTRACT.risk.files.indexed
	)
	return hydrateIndexedBorrowCapacitySnapshot(snapshot)
}
