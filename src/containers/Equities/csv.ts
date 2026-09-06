import type { SortingState } from '@tanstack/react-table'
import { fetchJson } from '~/utils/async'
import { EQUITIES_API } from './queries.client'
import {
	buildEquitiesTableQueryString,
	EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION,
	MAX_EQUITIES_TABLE_PAGE_SIZE
} from './tableQuery'
import type { EquitiesTableResponse, IEquitiesListCompanyRow } from './types'

type CsvCell = string | number

export interface EquitiesCsvColumn {
	id: keyof IEquitiesListCompanyRow
	header: string
}

const MAX_CSV_PAGES = 20

/** Walks every page of the current filtered, sorted view; the table itself only holds one page. */
export async function prepareEquitiesCsv({
	query,
	sorting,
	columns
}: {
	query: Record<string, string | Array<string> | undefined>
	sorting: SortingState
	columns: Array<EquitiesCsvColumn>
}): Promise<{ filename: string; rows: Array<Array<CsvCell>> }> {
	const rows: Array<Array<CsvCell>> = [columns.map((column) => column.header)]
	let hasMore = true

	for (let page = 1; page <= MAX_CSV_PAGES && hasMore; page++) {
		const queryString = buildEquitiesTableQueryString({
			query,
			pagination: { pageIndex: page - 1, pageSize: MAX_EQUITIES_TABLE_PAGE_SIZE },
			sorting
		})
		const response = await fetchJson<EquitiesTableResponse>(`${EQUITIES_API}${queryString}`)
		if (response.schemaVersion !== EQUITIES_TABLE_RESPONSE_SCHEMA_VERSION) {
			throw new Error('equities csv export got an unexpected response schema')
		}
		for (const row of response.rows) {
			rows.push(columns.map((column) => row[column.id] ?? ''))
		}
		hasMore = response.hasMore
	}

	if (hasMore) throw new Error('equities csv export exceeded the page limit')

	return { filename: 'equities-rankings.csv', rows }
}
