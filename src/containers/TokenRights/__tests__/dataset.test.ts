import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { IRawTokenRightsEntry } from '../api.types'

const mocks = vi.hoisted(() => ({
	fetchJson: vi.fn(),
	readJson: vi.fn(),
	writeJson: vi.fn()
}))

vi.mock('~/constants', () => ({ SERVER_URL: 'https://api.example' }))
vi.mock('~/server/datasetSnapshots/reader.server', () => ({
	datasetSnapshotReader: { readJson: mocks.readJson }
}))
vi.mock('~/utils/async', () => ({ fetchJson: mocks.fetchJson }))

import { buildTokenRightsDomain } from '../server/dataset.builder.server'
import {
	fetchTokenRightsEntries,
	fetchTokenRightsEntryByDefillamaId,
	fetchTokenRightsEntryByName
} from '../server/dataset.server'

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

beforeEach(() => {
	vi.clearAllMocks()
})

describe('token rights dataset snapshot', () => {
	test('reads the full dataset and indexes from their registered files', async () => {
		mocks.readJson
			.mockResolvedValueOnce([entry])
			.mockResolvedValueOnce({ 'parent#aave': entry })
			.mockResolvedValueOnce({ 'aave-daos': entry })

		await expect(fetchTokenRightsEntries()).resolves.toEqual([entry])
		await expect(fetchTokenRightsEntryByDefillamaId('parent#aave')).resolves.toBe(entry)
		await expect(fetchTokenRightsEntryByName("Aave DAO's")).resolves.toBe(entry)

		expect(mocks.readJson.mock.calls).toEqual([
			['token-rights', 'full.json'],
			['token-rights', 'by-defillama-id.json'],
			['token-rights', 'by-protocol-name.json']
		])
	})

	test('returns null for empty lookup keys without reading a snapshot', async () => {
		await expect(fetchTokenRightsEntryByDefillamaId('')).resolves.toBeNull()
		await expect(fetchTokenRightsEntryByName('')).resolves.toBeNull()
		expect(mocks.readJson).not.toHaveBeenCalled()
	})

	test('writes the full dataset and both pure indexes', async () => {
		mocks.fetchJson.mockResolvedValue([entry])
		mocks.writeJson.mockResolvedValue(undefined)

		await expect(buildTokenRightsDomain({ writeJson: mocks.writeJson })).resolves.toBeUndefined()

		expect(mocks.fetchJson).toHaveBeenCalledWith('https://api.example/token-rights')
		expect(mocks.writeJson.mock.calls).toEqual([
			['full.json', [entry]],
			['by-defillama-id.json', { 'parent#aave': entry }],
			['by-protocol-name.json', { 'aave-daos': entry }]
		])
	})
})
