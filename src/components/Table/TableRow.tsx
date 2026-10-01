import {
	FlexRender,
	Subscribe,
	type Cell,
	type Column_ColumnVisibility,
	type Row,
	type RowData
} from '@tanstack/react-table'
import type { SortingFeatures, VisibilityFeatures } from './features/contracts'
import type { TableCssVars } from './types'

interface TableRowProps<F extends SortingFeatures & VisibilityFeatures, T extends RowData> {
	row: Row<F, T>
	cells: Array<Cell<F, T, unknown>>
	index: number
	virtualIndex?: number
	rowHeight?: number
	subRowOrdinalById: Map<string, number>
	rowRankById?: Map<string, number>
	firstColumnId: string | undefined
	stripedBg: boolean
	isChainPage: boolean
	compact: boolean
}

export function TableRow<F extends SortingFeatures & VisibilityFeatures, T extends RowData>({
	row: rowToRender,
	cells,
	index: i,
	virtualIndex,
	rowHeight,
	subRowOrdinalById,
	rowRankById,
	firstColumnId,
	stripedBg,
	isChainPage,
	compact
}: TableRowProps<F, T>) {
	const explicitIndex =
		rowToRender.depth > 0
			? (subRowOrdinalById.get(rowToRender.id) ?? rowToRender.index + 1)
			: rowRankById?.get(rowToRender.id)
	return (
		<Subscribe source={rowToRender.table.store}>
			{() => (
				<tr
					data-index={virtualIndex}
					style={
						{
							height: rowHeight,
							opacity: (rowToRender.original as Record<string, unknown>)?.disabled ? 0.3 : 1,
							...(explicitIndex != null ? { '--vf-subrow-index': `"${explicitIndex}"` } : null)
						} as TableCssVars
					}
					data-depth={rowToRender.depth}
					className="vf-row"
				>
					{/* The generic features hide the visibility API; the prototype method keeps identity columns visible. */}
					{cells
						.filter(
							(cell) => (cell.column as Column_ColumnVisibility).getIsVisible() && !cell.column.columnDef.meta?.hidden
						)
						.map((cell) => {
							const textAlign = cell.column.columnDef.meta?.align ?? 'start'
							const isSticky = cell.column.id === firstColumnId
							const cellStyle = cell.column.columnDef.meta?.cellStyle?.(cell.row.original)
							return (
								<td
									key={cell.id}
									data-lighter={stripedBg && i % 2 === 0}
									data-chainpage={isChainPage}
									className={`truncate border-t border-r border-subtle p-3 ${
										compact ? 'border-r-0 px-5 py-2' : ''
									} ${cell.column.columnDef.meta?.cellClassName ?? ''}`}
									style={{
										textAlign,
										verticalAlign: compact ? 'middle' : undefined,
										position: isSticky ? 'sticky' : undefined,
										left: isSticky ? 0 : undefined,
										zIndex: isSticky ? 1 : undefined,
										background: isSticky ? 'var(--bg-surface)' : undefined,
										borderRightColor: isSticky ? 'transparent' : undefined,
										boxShadow: isSticky && !compact ? '-1px 0 0 var(--border-subtle) inset' : undefined,
										...cellStyle
									}}
								>
									<FlexRender cell={cell} />
								</td>
							)
						})}
				</tr>
			)}
		</Subscribe>
	)
}
