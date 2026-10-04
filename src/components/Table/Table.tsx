import type { RowData } from '@tanstack/react-table'
import type { SortingFeatures, VisibilityFeatures } from './features/contracts'
import { TableFrame } from './TableFrame'
import { TableRow } from './TableRow'
import type { TableProps, TableCssVars } from './types'
import { useTableCells } from './useTableCells'
import { useTableView } from './useTableView'

export type { TableLayout, TableProps } from './types'

/**
 * Render the current row model in full. Pagination, if configured, belongs to the table owner; this component never
 * creates a second pagination state or slices rows again.
 */
export function Table<F extends SortingFeatures & VisibilityFeatures, T extends RowData>({
	table,
	rowSize,
	stripedBg = false,
	compact = false,
	rowRankById,
	tableLayout = 'fixed',
	className,
	style
}: TableProps<F, T>) {
	const { columns, rows, headerGroups, visibleLeafColumns, subRowOrdinalById, isChainPage } = useTableView(table)
	const cellsByRow = useTableCells(rows, columns)
	return (
		<TableFrame
			store={table.store}
			visibleLeafColumns={visibleLeafColumns}
			headerGroups={headerGroups}
			rowCount={rows.length}
			isChainPage={isChainPage}
			compact={compact}
			tableLayout={tableLayout}
			className={className}
			style={style}
		>
			<tbody className="vf-row-counter" style={{ '--vf-row-offset': '0' } as TableCssVars}>
				{rows.map((row, index) => (
					<TableRow
						key={row.id}
						row={row}
						cells={cellsByRow[index]}
						index={index}
						rowHeight={rowSize ?? (compact ? 40 : 50)}
						subRowOrdinalById={subRowOrdinalById}
						rowRankById={rowRankById}
						firstColumnId={visibleLeafColumns[0]?.id}
						stripedBg={stripedBg}
						isChainPage={isChainPage}
						compact={compact}
					/>
				))}
			</tbody>
		</TableFrame>
	)
}
