/** Typed Treasuries reads and pure lookups over the current immutable snapshot. */
import type { RawTreasuriesResponse } from '~/containers/Treasuries/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { datasetSnapshotReader } from '~/server/datasetSnapshots/reader.server'
import { findTreasuryById } from './dataset.transform'

export async function fetchTreasuryById(treasuryId: string): Promise<RawTreasuriesResponse[number] | null> {
	const treasuries = await datasetSnapshotReader.readJson<RawTreasuriesResponse>(
		'treasuries',
		DATASET_SNAPSHOT_CONTRACT.treasuries.files.full
	)
	return findTreasuryById(treasuries, treasuryId)
}
