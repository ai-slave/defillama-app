import type { Row, Table } from '@tanstack/react-table'
import type { RwaTableFeatures } from './features'
import type { RWATableRow } from './rows'

/** Every row in sort order with its children, whatever is expanded. */
export function getRwaCsvRows(
	instance: Table<RwaTableFeatures, RWATableRow>
): Array<Row<RwaTableFeatures, RWATableRow>> {
	const rows: Array<Row<RwaTableFeatures, RWATableRow>> = []
	for (const row of instance.getSortedRowModel().rows) {
		rows.push(row)
		for (const child of row.subRows) rows.push(child)
	}
	return rows
}
