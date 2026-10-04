/** Typed Token Rights reads and pure lookups over the current immutable snapshot. */
import type { IRawTokenRightsEntry } from '~/containers/TokenRights/api.types'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import { acquireDatasetSnapshot } from '~/server/datasetSnapshots/refresh.server'
import type { DatasetSnapshotHandle } from '~/server/datasetSnapshots/store'
import { findTokenRightsByDefillamaId, findTokenRightsByProtocolName } from './dataset.index'

const TOKEN_RIGHTS_FILES = DATASET_SNAPSHOT_CONTRACT['token-rights'].files

// Each export serves one response and reads every artifact it needs from this one handle.
async function acquireTokenRightsSnapshot(): Promise<DatasetSnapshotHandle> {
	return (await acquireDatasetSnapshot('token-rights', 'blocking')).handle
}

export async function fetchTokenRightsEntries(): Promise<Array<IRawTokenRightsEntry>> {
	return (await acquireTokenRightsSnapshot()).readJson<Array<IRawTokenRightsEntry>>(TOKEN_RIGHTS_FILES.full)
}

/** The entry for the first id that has one, so a miss and the next id's hit come from the same generation. */
export async function fetchTokenRightsEntryByDefillamaIds(
	defillamaIds: Array<string>
): Promise<IRawTokenRightsEntry | null> {
	const byDefillamaId = await (
		await acquireTokenRightsSnapshot()
	).readJson<Record<string, IRawTokenRightsEntry>>(TOKEN_RIGHTS_FILES.byDefillamaId)
	for (const defillamaId of defillamaIds) {
		const entry = findTokenRightsByDefillamaId(byDefillamaId, defillamaId)
		if (entry) return entry
	}
	return null
}

export async function fetchTokenRightsEntryByName(protocolName: string): Promise<IRawTokenRightsEntry | null> {
	if (!protocolName) return null
	const byProtocolName = await (
		await acquireTokenRightsSnapshot()
	).readJson<Record<string, IRawTokenRightsEntry>>(TOKEN_RIGHTS_FILES.byProtocolName)
	return findTokenRightsByProtocolName(byProtocolName, protocolName)
}
