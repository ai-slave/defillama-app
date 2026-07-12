/** Builds unpublished Liquidations artifacts; the snapshot store owns publication. */
import { fetchBlockExplorers } from '~/api'
import { fetchAllLiquidations, fetchProtocolsList } from '~/containers/LiquidationsV2/api'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotWriter } from '~/server/datasetSnapshots/store'

export async function buildLiquidationsDomain(writer: DatasetSnapshotWriter): Promise<void> {
	const files = DATASET_SNAPSHOT_CONTRACT.liquidations.files

	const [protocolsResponse, allResponse, blockExplorers] = await Promise.all([
		fetchProtocolsList(),
		fetchAllLiquidations(),
		fetchBlockExplorers()
	])

	await Promise.all([
		writer.writeJson(files.rawProtocols, protocolsResponse),
		writer.writeJson(files.rawAll, allResponse),
		writer.writeJson(files.rawBlockExplorers, blockExplorers)
	])
}
