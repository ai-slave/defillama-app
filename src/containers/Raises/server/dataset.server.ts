/** Typed Raises reads and pure lookups over the current immutable snapshot. */
import type { RawRaise, RawRaisesResponse } from '~/containers/Raises/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { datasetSnapshotReader } from '~/server/datasetSnapshots/reader.server'
import { findRaisesByDefillamaId } from './dataset.transform'

export async function fetchRaisesByDefillamaId(defillamaId: string): Promise<RawRaise[]> {
	const response = await fetchRaises()
	return findRaisesByDefillamaId(response, defillamaId)
}

export function fetchRaises(): Promise<RawRaisesResponse> {
	return datasetSnapshotReader.readJson<RawRaisesResponse>('raises', DATASET_SNAPSHOT_CONTRACT.raises.files.full)
}
