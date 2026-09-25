import { expect, test } from 'vitest'
import { SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installSnapshotDirectory } from '~/utils/testing/snapshotDirectory'
import type { IRawTokenRightsEntry } from '../api.types'

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

test('publishes and reads entries through both on-disk indexes', async () => {
	http.serve({ [`${SERVER_URL}/token-rights`]: [entry] })
	const { fileDatasetSnapshotStore } = await import('~/server/datasetSnapshots/fileStore.server')
	const { buildTokenRightsDomain } = await import('../server/dataset.builder.server')
	await fileDatasetSnapshotStore.publish('token-rights', buildTokenRightsDomain)
	const api = await import('../server/dataset.server')
	expect(await api.fetchTokenRightsEntries()).toEqual([entry])
	expect(await api.fetchTokenRightsEntryByDefillamaId('parent#aave')).toEqual(entry)
	expect(await api.fetchTokenRightsEntryByName("Aave DAO's")).toEqual(entry)
	expect(await api.fetchTokenRightsEntryByName('missing')).toBeNull()
	expect(await api.fetchTokenRightsEntryByDefillamaId('missing')).toBeNull()
	expect(http.urls()).toEqual([`${SERVER_URL}/token-rights`])
})
