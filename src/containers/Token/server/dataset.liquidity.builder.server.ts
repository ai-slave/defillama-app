/** Builds the unpublished token-liquidity artifact; the snapshot store owns publication. */
import { fetchLiquidityTokensDatasetFromNetwork } from '~/api'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotWriter } from '~/server/datasetSnapshots/store'

export async function buildLiquidityDomain(writer: DatasetSnapshotWriter): Promise<void> {
	const files = DATASET_SNAPSHOT_CONTRACT.liquidity.files

	const liquidity = await fetchLiquidityTokensDatasetFromNetwork()
	await writer.writeJson(files.full, liquidity)
}
