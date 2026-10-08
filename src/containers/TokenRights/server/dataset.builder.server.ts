/** Builds unpublished Token Rights artifacts; the snapshot store owns publication. */
import { SERVER_URL } from '~/constants'
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotWriter } from '~/server/datasetSnapshots/store'
import { fetchJson } from '~/utils/async'
import { buildTokenRightsIndexes } from './dataset.index'

export async function buildTokenRightsDomain(writer: DatasetSnapshotWriter): Promise<void> {
	const files = DATASET_SNAPSHOT_CONTRACT['token-rights'].files

	// The rows come from an Airtable table, where a blank row arrives as `{}`: Airtable omits empty fields. A row
	// without a protocol name describes nothing, and every reader expects the name, so it never enters the snapshot.
	const rows = await fetchJson<Array<Partial<IRawTokenRightsEntry>>>(`${SERVER_URL}/token-rights`)
	const entries = rows.filter((row): row is IRawTokenRightsEntry => typeof row['Protocol Name'] === 'string')
	const indexes = buildTokenRightsIndexes(entries)

	await Promise.all([
		writer.writeJson(files.full, entries),
		writer.writeJson(files.byDefillamaId, indexes.byDefillamaId),
		writer.writeJson(files.byProtocolName, indexes.byProtocolName)
	])
}
