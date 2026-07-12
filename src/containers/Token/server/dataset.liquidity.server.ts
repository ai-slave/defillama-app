/** Typed token-liquidity reads and pure lookups over the current immutable snapshot. */
import type { ProtocolLiquidityTokensResponse } from '~/api/types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { datasetSnapshotReader } from '~/server/datasetSnapshots/reader.server'
import { findLiquidityEntryByProtocolId } from './dataset.liquidity.transform'

export async function fetchLiquidityEntryByProtocolId(
	protocolId: string
): Promise<ProtocolLiquidityTokensResponse[number] | null> {
	if (!protocolId) return null

	const snapshot = await datasetSnapshotReader.readJson<ProtocolLiquidityTokensResponse>(
		'liquidity',
		DATASET_SNAPSHOT_CONTRACT.liquidity.files.full
	)
	return findLiquidityEntryByProtocolId(snapshot, protocolId)
}
