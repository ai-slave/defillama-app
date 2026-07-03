import { flexRender, type HeaderGroup, type Row } from '@tanstack/react-table'
import type { CSSProperties } from 'react'
import { SortIcon } from '~/components/Table/SortIcon'

const RANK_WIDTH = 48
const NAME_WIDTH = 200
const DATA_MIN_WIDTH = 132

function colWidth(index: number): CSSProperties | undefined {
	if (index === 0) return { width: RANK_WIDTH, minWidth: RANK_WIDTH, maxWidth: RANK_WIDTH }
	if (index === 1) return { width: NAME_WIDTH, minWidth: NAME_WIDTH }
	return { minWidth: DATA_MIN_WIDTH }
}

function stickyStyle(index: number): CSSProperties | undefined {
	if (index === 0) return { position: 'sticky', left: 0, zIndex: 2, background: 'var(--cards-bg)' }
	if (index === 1)
		return {
			position: 'sticky',
			left: RANK_WIDTH,
			zIndex: 2,
			background: 'var(--cards-bg)',
			boxShadow: '-1px 0 0 var(--divider) inset'
		}
	return undefined
}

export function SortArrow({ dir }: { dir: false | 'asc' | 'desc' }) {
	return (
		<span
			className={`shrink-0 text-[10px] leading-none ${dir ? 'text-(--text-primary)' : 'text-(--text-tertiary) opacity-40'}`}
		>
			{dir === 'asc' ? '↑' : '↓'}
		</span>
	)
}

export function StickyTable<T>({ headerGroups, rows }: { headerGroups: HeaderGroup<T>[]; rows: Row<T>[] }) {
	'use no memo'
	return (
		<div className="thin-scrollbar w-full overflow-x-auto">
			<table className="w-full text-sm" style={{ minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
				<thead>
					{headerGroups.map((headerGroup) => (
						<tr key={headerGroup.id}>
							{headerGroup.headers.map((header, index) => {
								const align = header.column.columnDef.meta?.align ?? 'start'
								const canSort = header.column.getCanSort()
								const justify =
									align === 'center' ? 'justify-center' : align === 'end' ? 'justify-end' : 'justify-start'
								return (
									<th
										key={header.id}
										style={{ ...colWidth(index), textAlign: align, ...stickyStyle(index) }}
										className="border-b border-(--divider) px-3 py-2 font-medium whitespace-nowrap text-(--text-secondary)"
									>
										{canSort ? (
											<button
												type="button"
												onClick={() => header.column.toggleSorting()}
												className={`flex w-full cursor-pointer items-center gap-1 whitespace-nowrap select-none ${justify}`}
											>
												{flexRender(header.column.columnDef.header, header.getContext())}
												{header.column.id === '#' ? (
													<SortArrow dir={header.column.getIsSorted()} />
												) : (
													<SortIcon dir={header.column.getIsSorted()} />
												)}
											</button>
										) : (
											<span className={`flex items-center gap-1 ${justify}`}>
												{flexRender(header.column.columnDef.header, header.getContext())}
											</span>
										)}
									</th>
								)
							})}
						</tr>
					))}
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.id}>
							{row.getVisibleCells().map((cell, index) => {
								const align = cell.column.columnDef.meta?.align ?? 'start'
								const cellStyle = cell.column.columnDef.meta?.cellStyle?.(cell.row.original)
								const cellClass = cell.column.columnDef.meta?.cellClass?.(cell.row.original)
								return (
									<td
										key={cell.id}
										style={{ ...colWidth(index), textAlign: align, ...stickyStyle(index), ...cellStyle }}
										className={`border-b border-(--divider) px-3 py-3 align-middle ${cell.column.columnDef.meta?.cellClassName ?? ''} ${cellClass ?? ''}`}
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								)
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}
