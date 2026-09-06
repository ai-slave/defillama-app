/** Typed Token Rights reads and pure lookups over the current immutable snapshot. */
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { datasetSnapshotReader } from '~/server/datasetSnapshots/reader.server'
import { findTokenRightsByDefillamaId, findTokenRightsByProtocolName } from './dataset.index'

const TOKEN_RIGHTS_FILES = DATASET_SNAPSHOT_CONTRACT['token-rights'].files

export function fetchTokenRightsEntries(): Promise<Array<IRawTokenRightsEntry>> {
	return datasetSnapshotReader.readJson<Array<IRawTokenRightsEntry>>('token-rights', TOKEN_RIGHTS_FILES.full)
}

export async function fetchTokenRightsEntryByDefillamaId(defillamaId: string): Promise<IRawTokenRightsEntry | null> {
	if (!defillamaId) return null
	const byDefillamaId = await datasetSnapshotReader.readJson<Record<string, IRawTokenRightsEntry>>(
		'token-rights',
		TOKEN_RIGHTS_FILES.byDefillamaId
	)
	return findTokenRightsByDefillamaId(byDefillamaId, defillamaId)
}

export async function fetchTokenRightsEntryByName(protocolName: string): Promise<IRawTokenRightsEntry | null> {
	if (!protocolName) return null
	const byProtocolName = await datasetSnapshotReader.readJson<Record<string, IRawTokenRightsEntry>>(
		'token-rights',
		TOKEN_RIGHTS_FILES.byProtocolName
	)
	return findTokenRightsByProtocolName(byProtocolName, protocolName)
}
