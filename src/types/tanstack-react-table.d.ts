import type { RowData } from '@tanstack/react-table'
import type { CsvCell } from '~/utils/csvCell'

declare module '@tanstack/react-table' {
	interface ColumnMeta<TData extends RowData, TValue> {
		align?: 'start' | 'end' | 'center'
		headerHelperText?: string
		headerClassName?: string
		/** Extra classes for this column's body `<td>` (e.g. `truncate` to ellipsis long text). */
		cellClassName?: string
		hidden?: boolean
		csvHeader?: string
		csvOnly?: boolean
		csvValue?: (row: TData) => CsvCell
		/**
		 * Type-only field to satisfy linters about unused generics.
		 * Not used at runtime.
		 */
		__vfType?: [TData, TValue]
	}
}
