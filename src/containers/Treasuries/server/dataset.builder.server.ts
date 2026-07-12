/** Builds the unpublished Treasuries artifact; the snapshot store owns publication. */
import { fetchTreasuriesFromNetwork } from '~/containers/Treasuries/api'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotWriter } from '~/server/datasetSnapshots/store'

export async function buildTreasuriesDomain(writer: DatasetSnapshotWriter): Promise<void> {
	const files = DATASET_SNAPSHOT_CONTRACT.treasuries.files

	const treasuries = await fetchTreasuriesFromNetwork()
	await writer.writeJson(files.full, treasuries)
}
