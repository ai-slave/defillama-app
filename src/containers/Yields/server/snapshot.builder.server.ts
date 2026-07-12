/** Builds one unpublished Yields candidate; the snapshot store owns publication and fallback. */
import { buildYieldTableRowsWithBorrowData } from '~/containers/Yields/poolsPipeline'
import {
	fetchYieldConfigFromNetwork,
	getLendBorrowDataFromYieldPageData,
	getYieldPageDataFromNetwork
} from '~/containers/Yields/queries.server'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import type { DatasetSnapshotWriter } from '~/server/datasetSnapshots/store'
import { YIELDS_SNAPSHOT_FILES } from './snapshot.contract'
import { buildYieldsTokenIndexes } from './snapshot.index'
import { getYieldsTokenIndexArtifactPath } from './snapshot.indexPath.server'

const YIELDS_SNAPSHOT_FETCH_TIMEOUT_MS = 180_000

async function writeTokenYieldIndexes(writer: DatasetSnapshotWriter, rows: IYieldTableRow[]): Promise<void> {
	const writes = []
	for (const [token, rowIds] of buildYieldsTokenIndexes(rows)) {
		writes.push(writer.writeJson(getYieldsTokenIndexArtifactPath(token), rowIds))
	}
	await Promise.all(writes)
}

export async function buildYieldsSnapshotCandidate(writer: DatasetSnapshotWriter): Promise<void> {
	const timeout = YIELDS_SNAPSHOT_FETCH_TIMEOUT_MS
	const yieldPageData = await getYieldPageDataFromNetwork({ timeout })
	const [lendBorrowData, yieldConfig] = await Promise.all([
		getLendBorrowDataFromYieldPageData(yieldPageData, { timeout }),
		fetchYieldConfigFromNetwork({ timeout })
	])
	const transformedPools = buildYieldTableRowsWithBorrowData(
		yieldPageData.props.pools ?? [],
		lendBorrowData.props.pools ?? []
	)

	await Promise.all([
		writer.writeJson(YIELDS_SNAPSHOT_FILES.rows, transformedPools),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.pageData, yieldPageData),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.config, yieldConfig),
		writer.writeJson(YIELDS_SNAPSHOT_FILES.lendBorrow, lendBorrowData),
		writeTokenYieldIndexes(writer, transformedPools)
	])
}
