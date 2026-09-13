import type { RowData, Table_ColumnVisibility, Table as TableInstance } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import type { SortingFeatures, VisibilityFeatures } from './features/contracts'

export type TableCssVars = CSSProperties & Record<`--${string}`, string>

export type TableLayout = 'fixed' | 'auto'

export interface TableProps<F extends SortingFeatures & VisibilityFeatures, T extends RowData> {
	table: TableInstance<F, T> & Table_ColumnVisibility<F, T>
	rowSize?: number
	stripedBg?: boolean
	style?: CSSProperties
	className?: string
	compact?: boolean
	rowRankById?: Map<string, number>
	tableLayout?: TableLayout
}
