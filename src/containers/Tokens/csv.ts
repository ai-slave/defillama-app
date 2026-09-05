import type { SortingState } from '@tanstack/react-table'
import { fetchJson } from '~/utils/async'
import { TOKENS_HIDEABLE_COLUMN_SPECS } from './columnSpecs'
import { TOKENS_API } from './queries.client'
import { TOKENS_PAGE_RESPONSE_SCHEMA_VERSION, type TokensPageResponse, type TokensTableRow } from './types'
import { buildTokensTableQueryString, MAX_TOKENS_TABLE_PAGE_SIZE } from './utils'

type CsvCell = string | number

export const TOKENS_CSV_COLUMNS: Array<{ id: string; header: string; value: (row: TokensTableRow) => CsvCell }> = [
	{ id: 'rank', header: '#', value: (row) => row.rowNumber },
	{ id: 'name', header: 'Coin', value: (row) => `${row.name} (${row.symbol})` },
	...TOKENS_HIDEABLE_COLUMN_SPECS.map((spec) => ({ id: spec.id, header: spec.header, value: spec.csvValue }))
]

const MAX_CSV_PAGES = 40

export async function prepareTokensCsv({
	query,
	sorting,
	hiddenColumnIds
}: {
	query: Record<string, string | string[] | undefined>
	sorting: SortingState
	hiddenColumnIds: Set<string>
}): Promise<{ filename: string; rows: CsvCell[][] }> {
	const columns = TOKENS_CSV_COLUMNS.filter((column) => !hiddenColumnIds.has(column.id))
	const rows: CsvCell[][] = [columns.map((column) => column.header)]
	let hasMore = true
	let snapshotVersion = 'latest'

	for (let page = 1; page <= MAX_CSV_PAGES && hasMore; page++) {
		const queryString = buildTokensTableQueryString({
			query,
			pagination: { pageIndex: page - 1, pageSize: MAX_TOKENS_TABLE_PAGE_SIZE },
			sorting
		})
		const response = await fetchJson<TokensPageResponse>(
			`${TOKENS_API}${queryString}${queryString ? '&' : '?'}snapshot=${snapshotVersion}`
		)
		if (response.schemaVersion !== TOKENS_PAGE_RESPONSE_SCHEMA_VERSION) {
			throw new Error('tokens csv export got an unexpected response schema')
		}
		if (!response.snapshotVersion || (snapshotVersion !== 'latest' && response.snapshotVersion !== snapshotVersion)) {
			throw new Error('Tokens export snapshot changed. Please restart the export.')
		}
		snapshotVersion = response.snapshotVersion
		for (const row of response.rows) {
			rows.push(columns.map((column) => column.value(row)))
		}
		hasMore = response.hasMore
	}

	if (hasMore) throw new Error('tokens csv export exceeded the page limit')

	return { filename: 'tokens.csv', rows }
}
