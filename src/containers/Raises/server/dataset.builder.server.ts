/** Builds the unpublished Raises artifact; the snapshot store owns publication. */
import { fetchRaisesFromNetwork } from '~/containers/Raises/api'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotWriter } from '~/server/datasetSnapshots/store'

export async function buildRaisesDomain(writer: DatasetSnapshotWriter): Promise<void> {
	const files = DATASET_SNAPSHOT_CONTRACT.raises.files

	const raises = await fetchRaisesFromNetwork()
	await writer.writeJson(files.full, raises)
}
