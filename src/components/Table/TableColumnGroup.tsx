import type { ColumnMeta, Column, RowData, TableFeatures } from '@tanstack/react-table'

/**
 * Under `table-layout: fixed`, each `<col>` takes its column's `meta.headerClassName`, so the rendered column width
 * equals the class width, cell padding included. Content never widens a column; it wraps or truncates. Sizing
 * method: "Column widths" in src/components/Table/README.md.
 */
export function TableColumnGroup<F extends TableFeatures, T extends RowData>({
	columns,
	widths
}: {
	columns: Array<Column<F, T, unknown>>
	widths?: Array<number>
}) {
	return (
		<colgroup>
			{columns.map((column, index) => (
				<col
					key={column.id}
					className={(column.columnDef.meta as ColumnMeta<F, T> | undefined)?.headerClassName}
					style={widths?.[index] ? { width: `${widths[index]}px` } : undefined}
				/>
			))}
		</colgroup>
	)
}
