import type { Column, Row, RowData, TableFeatures } from '@tanstack/react-table'
import { useMemo } from 'react'

/** Keep column changes reactive even when TanStack reuses the same row objects. */
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
