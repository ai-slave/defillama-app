import type { RowData } from '@tanstack/react-table'
<<<<<<< market-makers
import type { CSSProperties } from 'react'
=======
import type { CsvCell } from '~/utils/csvCell'
>>>>>>> main

declare module '@tanstack/react-table' {
	interface ColumnMeta<TData extends RowData, TValue> {
		align?: 'start' | 'end' | 'center'
		headerHelperText?: string
		headerClassName?: string
		/** Extra classes for this column's body `<td>` (e.g. `truncate` to ellipsis long text). */
		cellClassName?: string
		/** Inline style for this column's body `<td>` derived from the row (e.g. full-cell heatmap fill). */
		cellStyle?: (data: TData) => CSSProperties | undefined
		/** Extra classes for this column's body `<td>` derived from the row (e.g. theme-aware heatmap fill). */
		cellClass?: (data: TData) => string | undefined
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
