/** Typed Raises reads and pure lookups over the current immutable snapshot. */
import type { RaisesApiResponse } from '~/containers/Raises/api.types'
import { normalizeRaisesApiResponse, type Raise, type RaisesResponse } from '~/containers/Raises/model'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { acquireDatasetSnapshot } from '~/server/datasetSnapshots/refresh.server'
import { findRaisesByDefillamaId } from './dataset.transform'

export async function fetchRaisesByDefillamaId(defillamaId: string): Promise<Array<Raise>> {
	const response = await fetchRaises()
	return findRaisesByDefillamaId(response, defillamaId)
}

export async function fetchRaises(): Promise<RaisesResponse> {
	const { handle } = await acquireDatasetSnapshot('raises', 'blocking')
	const response = await handle.readJson<RaisesApiResponse>(DATASET_SNAPSHOT_CONTRACT.raises.files.full)
	return normalizeRaisesApiResponse(response)
}
