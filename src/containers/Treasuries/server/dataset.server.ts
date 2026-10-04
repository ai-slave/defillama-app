/** Typed Treasuries reads and pure lookups over the current immutable snapshot. */
import type { RawTreasuriesResponse } from '~/containers/Treasuries/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { acquireDatasetSnapshot } from '~/server/datasetSnapshots/refresh.server'
import { findTreasuryById } from './dataset.transform'

export async function fetchTreasuryById(treasuryId: string): Promise<RawTreasuriesResponse[number] | null> {
	const { handle } = await acquireDatasetSnapshot('treasuries', 'blocking')
	const treasuries = await handle.readJson<RawTreasuriesResponse>(DATASET_SNAPSHOT_CONTRACT.treasuries.files.full)
	return findTreasuryById(treasuries, treasuryId)
}
