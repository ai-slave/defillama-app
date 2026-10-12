import type { RowData, Table_ColumnVisibility, Table as TableInstance } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import type { SortingFeatures, VisibilityFeatures } from './features/contracts'

export type TableCssVars = CSSProperties & Record<`--${string}`, string>

/**
 * `declared`: each column is as wide as its header or its `meta.headerClassName` min-width, whichever is larger, and
 * body cells never widen it, so rows scrolling in, sorting or paging never move a column. `content`: columns size to
 * every rendered cell, for short tables that render all their rows. See "Column widths" in README.md.
 */
export type ColumnSizing = 'declared' | 'content'

export interface TableProps<F extends SortingFeatures & VisibilityFeatures, T extends RowData> {
	table: TableInstance<F, T> & Table_ColumnVisibility<F, T>
	rowSize?: number
	stripedBg?: boolean
	style?: CSSProperties
	className?: string
	compact?: boolean
	rowRankById?: Map<string, number>
	columnSizing?: ColumnSizing
}
