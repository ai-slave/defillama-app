import { expect, test, vi } from 'vitest'
import { serializeCsv } from '~/utils/csv'
import { prepareEquitiesCsv } from './csv'
import { EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION } from './tableQuery'

const fetchJson = vi.hoisted(() => vi.fn())
vi.mock('~/utils/async', () => ({ fetchJson }))

const columns = [
	{ id: 'ticker', header: 'Ticker' },
	{ id: 'name', header: 'Company' }
] as const

test('walks all filtered pages and fails instead of returning a partial export', async () => {
	fetchJson.mockReset()
	fetchJson
		.mockResolvedValueOnce({
			schemaVersion: EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
			rows: [{ ticker: 'AAA', name: 'Alpha, Inc.' }],
			hasMore: true
		})
		.mockRejectedValueOnce(new Error('Page unavailable'))
	await expect(prepareEquitiesCsv({ query: { search: 'tech' }, sorting: [], columns: [...columns] })).rejects.toThrow(
		'Page unavailable'
	)

	fetchJson.mockReset()
	fetchJson
		.mockResolvedValueOnce({
			schemaVersion: EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
			rows: [{ ticker: 'AAA', name: 'Alpha, Inc.' }],
			hasMore: true
		})
		.mockResolvedValueOnce({
			schemaVersion: EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
			rows: [{ ticker: 'BBB', name: 'Beta' }],
			hasMore: false
		})
	const result = await prepareEquitiesCsv({ query: { search: 'tech' }, sorting: [], columns: [...columns] })
	expect(serializeCsv(result.rows)).toBe('Ticker,Company\nAAA,"Alpha, Inc."\nBBB,Beta')
	expect(new URL(fetchJson.mock.calls[1][0], 'https://example.com').searchParams.get('page')).toBe('2')
	expect(new URL(fetchJson.mock.calls[1][0], 'https://example.com').searchParams.get('search')).toBe('tech')
})
