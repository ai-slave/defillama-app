import type { ColumnMeta, Column, RowData, TableFeatures } from '@tanstack/react-table'

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
