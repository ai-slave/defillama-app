import { expect, test } from 'vitest'
import { SERVER_URL } from '~/constants'
import { DATASET_SNAPSHOT_CONTRACT } from '~/server/datasetSnapshots/contract'
import type { DatasetSnapshotBuilder } from '~/server/datasetSnapshots/store'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installSnapshotDirectory, publishAfterFirstAcquisition } from '~/utils/testing/snapshotDirectory'
import type { IRawTokenRightsEntry } from '../api.types'
import { buildTokenRightsIndexes } from '../server/dataset.index'

const http = installFixtureFetch()
installSnapshotDirectory('token-rights-test')

const entry: IRawTokenRightsEntry = {
	'Protocol Name': "Aave DAO's",
	Token: ['AAVE'],
	'Governance Decisions': ['AAVE'],
	'Treasury Decisions': ['AAVE'],
	'Revenue Decisions': ['AAVE'],
	'Fee Switch Status': 'OFF',
	Buybacks: ['N/A'],
	Dividends: ['N/A'],
	Burns: 'N/A',
	'DefiLlama ID': 'parent#aave'
}
const chainEntry: IRawTokenRightsEntry = { ...entry, 'Protocol Name': 'Aave Chain', 'DefiLlama ID': 'aave-chain' }

function tokenRightsGeneration(entries: Array<IRawTokenRightsEntry>): DatasetSnapshotBuilder {
	const files = DATASET_SNAPSHOT_CONTRACT['token-rights'].files
	const { byDefillamaId, byProtocolName } = buildTokenRightsIndexes(entries)
	return async (writer) => {
		await writer.writeJson(files.full, entries)
		await writer.writeJson(files.byDefillamaId, byDefillamaId)
		await writer.writeJson(files.byProtocolName, byProtocolName)
	}
}

test('publishes and reads entries through both on-disk indexes', async () => {
	http.serve({ [`${SERVER_URL}/token-rights`]: [entry, chainEntry] })
	const { fileDatasetSnapshotStore } = await import('~/server/datasetSnapshots/fileStore.server')
	const { buildTokenRightsDomain } = await import('../server/dataset.builder.server')
	await fileDatasetSnapshotStore.publish('token-rights', buildTokenRightsDomain)
	const api = await import('../server/dataset.server')
	expect(await api.fetchTokenRightsEntries()).toEqual([entry, chainEntry])
	expect(await api.fetchTokenRightsEntryByDefillamaIds(['aave-chain', 'parent#aave'])).toEqual(chainEntry)
	expect(await api.fetchTokenRightsEntryByDefillamaIds(['missing', 'parent#aave'])).toEqual(entry)
	expect(await api.fetchTokenRightsEntryByName("Aave DAO's")).toEqual(entry)
	expect(await api.fetchTokenRightsEntryByName('missing')).toBeNull()
	expect(await api.fetchTokenRightsEntryByDefillamaIds(['missing'])).toBeNull()
	// One upstream fetch at publish: every read comes from the on-disk indexes.
	expect(http.requests).toHaveLength(1)
})

test('falls through to the next id within one generation when a refresh adds the first id between lookups', async () => {
	const { fileDatasetSnapshotStore } = await import('~/server/datasetSnapshots/fileStore.server')
	await fileDatasetSnapshotStore.publish('token-rights', tokenRightsGeneration([entry]))
	const refreshedEntry = { ...entry, 'Fee Switch Status': 'ON' }
	await publishAfterFirstAcquisition('token-rights', tokenRightsGeneration([chainEntry, refreshedEntry]))
	const api = await import('../server/dataset.server')
	expect(await api.fetchTokenRightsEntryByDefillamaIds(['aave-chain', 'parent#aave'])).toEqual(entry)
	// The next response reads the refreshed generation.
	expect(await api.fetchTokenRightsEntryByDefillamaIds(['aave-chain', 'parent#aave'])).toEqual(chainEntry)
})
