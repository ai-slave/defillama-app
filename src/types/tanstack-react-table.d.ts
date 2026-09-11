import type { HeaderContext, RowData } from '@tanstack/react-table'
import type { CSSProperties, ReactNode } from 'react'
import type { CsvCell } from '~/utils/csvCell'

declare module '@tanstack/react-table' {
	interface ColumnMeta<TData extends RowData, TValue> {
		align?: 'start' | 'end' | 'center'
		headerHelperText?: string
		/** Rendered before the header's sort button, outside it, so it may carry its own hovercard. */
		headerLead?: (context: HeaderContext<TData, TValue>) => ReactNode
		/** Rendered after the header's sort button, outside it, so it may carry its own hovercard. */
		headerTrail?: (context: HeaderContext<TData, TValue>) => ReactNode
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
