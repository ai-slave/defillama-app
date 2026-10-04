/** Typed token-risk reads and hydration over the current immutable snapshot. */
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { acquireDatasetSnapshot } from '~/server/datasetSnapshots/refresh.server'
import {
	hydrateIndexedBorrowCapacitySnapshot,
	type IndexedBorrowCapacitySnapshot,
	type IndexedTokenRiskBorrowCapacity
} from './dataset.risk.transform'

export async function getIndexedTokenRiskBorrowCapacity(): Promise<IndexedTokenRiskBorrowCapacity> {
	const { handle } = await acquireDatasetSnapshot('risk', 'blocking')
	const snapshot = await handle.readJson<IndexedBorrowCapacitySnapshot>(DATASET_SNAPSHOT_CONTRACT.risk.files.indexed)
	return hydrateIndexedBorrowCapacitySnapshot(snapshot)
}
