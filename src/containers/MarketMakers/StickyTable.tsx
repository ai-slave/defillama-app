import { FlexRender, type ReactTable, type RowData } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import type { SortedTableFeatures } from '~/components/Table/features/sorting'
import { SortIcon } from '~/components/Table/SortIcon'

const RANK_WIDTH = 48
const NAME_WIDTH = 200
const DATA_MIN_WIDTH = 132

function colWidth(index: number): CSSProperties | undefined {
	if (index === 0) return { width: RANK_WIDTH, minWidth: RANK_WIDTH, maxWidth: RANK_WIDTH }
	if (index === 1) return { width: NAME_WIDTH, minWidth: NAME_WIDTH }
	return { minWidth: DATA_MIN_WIDTH }
}

const STICKY_CELL_BACKGROUND = 'var(--bg-surface)'

function stickyStyle(index: number): CSSProperties | undefined {
	if (index === 0) return { position: 'sticky', left: 0, zIndex: 2, background: STICKY_CELL_BACKGROUND }
	if (index === 1)
		return {
			position: 'sticky',
			left: RANK_WIDTH,
			zIndex: 2,
			background: STICKY_CELL_BACKGROUND,
			boxShadow: '-1px 0 0 var(--border-subtle) inset'
		}
	return undefined
}

export function SortArrow({ dir }: { dir: false | 'asc' | 'desc' }) {
	return (
		<span className={`shrink-0 label-xs ${dir ? 'text-primary' : 'text-tertiary'}`}>{dir === 'asc' ? '↑' : '↓'}</span>
	)
}

export function StickyTable<T extends RowData>({ table }: { table: ReactTable<SortedTableFeatures, T> }) {
	return (
		<table.Subscribe source={table.atoms.sorting}>
			{() => (
				<div className="w-full overflow-x-auto">
					<table className="w-full body-md" style={{ minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
						<thead>
							{table.getHeaderGroups().map((headerGroup) => (
								<tr key={headerGroup.id}>
									{headerGroup.headers
										.filter((header) => header.rowSpan > 0)
										.map((header, index) => {
											const align = header.column.columnDef.meta?.align ?? 'start'
											const canSort = header.column.getCanSort()
											const justify =
												align === 'center' ? 'justify-center' : align === 'end' ? 'justify-end' : 'justify-start'
											return (
												<th
													key={header.id}
													colSpan={header.colSpan}
													rowSpan={header.rowSpan}
													style={{ ...colWidth(index), textAlign: align, ...stickyStyle(index) }}
													className="border-b border-subtle px-3 py-2 font-medium whitespace-nowrap text-secondary"
												>
													{canSort ? (
														<button
															type="button"
															onClick={() => header.column.toggleSorting()}
															className={`flex w-full cursor-pointer items-center gap-1 whitespace-nowrap select-none ${justify}`}
														>
															<FlexRender header={header} />
															{header.column.id === '#' ? (
																<SortArrow dir={header.column.getIsSorted()} />
															) : (
																<SortIcon dir={header.column.getIsSorted()} />
															)}
														</button>
													) : (
														<span className={`flex items-center gap-1 ${justify}`}>
															<FlexRender header={header} />
														</span>
													)}
												</th>
											)
										})}
								</tr>
							))}
						</thead>
						<tbody>
							{table.getRowModel().rows.map((row) => (
								<tr key={row.id}>
									{row.getAllCells().map((cell, index) => {
										const align = cell.column.columnDef.meta?.align ?? 'start'
										const cellStyle = cell.column.columnDef.meta?.cellStyle?.(cell.row.original)
										const cellClass = cell.column.columnDef.meta?.cellClass?.(cell.row.original)
										return (
											<td
												key={cell.id}
												style={{ ...colWidth(index), textAlign: align, ...stickyStyle(index), ...cellStyle }}
												className={`border-b border-subtle px-3 py-3 align-middle ${align === 'end' ? 'tabular-nums' : ''} ${cell.column.columnDef.meta?.cellClassName ?? ''} ${cellClass ?? ''}`}
											>
												<FlexRender cell={cell} />
											</td>
										)
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</table.Subscribe>
	)
}
