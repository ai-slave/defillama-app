import type { Column, Row, RowData, TableFeatures } from '@tanstack/react-table'
import { useMemo } from 'react'

/**
 * Keep column changes reactive even when TanStack reuses the same row objects.
 *
 * Rows and columns are explicit inputs, so a formatter can change without changing row identities or column ids.
 * Read stable core table objects inside a `Subscribe` callback or render from selected values; never replace those
 * subscriptions with a compiler opt-out.
 */
export function useTableCells<F extends TableFeatures, T extends RowData>(
	rows: Array<Row<F, T>>,
	columns: Array<Column<F, T, unknown>>
) {
	return useMemo(
		() =>
			rows.map((row) => {
				const cells = row.getAllCellsByColumnId()
				return columns.map((column) => cells[column.id])
			}),
		[rows, columns]
	)
}
