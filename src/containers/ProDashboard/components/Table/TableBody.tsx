'use no memo'

import { flexRender, type Header, type Table } from '@tanstack/react-table'
import { SortIcon } from '~/components/Table/SortIcon'

interface TableBodyProps<TData> {
	table: Table<TData>
	isLoading?: boolean
	emptyMessage?: string
}

const getSortableColumn = <TData,>(header: Header<TData, unknown>) => {
	if (header.column.getCanSort()) return header.column
	const firstSortableLeaf = header.column.getLeafColumns().find((leafColumn) => leafColumn.getCanSort())
	return firstSortableLeaf ?? null
}

export function TableBody<TData>({
	table,
	isLoading,
	emptyMessage = 'No rows match current filters'
}: TableBodyProps<TData>) {
	const rows = table.getRowModel().rows

	return (
		<div className="relative -mx-2 min-h-0 w-full flex-1 overflow-auto px-2 sm:mx-0 sm:px-0" style={{ height: '100%' }}>
			<table className="w-full min-w-[600px] border-collapse text-xs text-pro-text-primary sm:text-sm">
				<thead className="sticky top-0 z-10">
					{table.getHeaderGroups().map((headerGroup) => {
						let firstVisibleHeaderId: string | null = null
						for (const header of headerGroup.headers) {
							if (header.isPlaceholder) continue
							if (firstVisibleHeaderId === null) firstVisibleHeaderId = header.id
						}
						return (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									const isFirst = header.id === firstVisibleHeaderId
									const sortable = getSortableColumn(header)

									return (
										<th
											key={header.id}
											colSpan={header.colSpan}
											className={`relative border-r border-b border-subtle bg-pro-cards-bg px-1 py-2 font-medium first:rounded-l-md last:rounded-r-md last:border-r-0 sm:px-2 ${
												header.column.columnDef.meta?.align === 'end' ? 'text-right' : 'text-left'
											}`}
											style={{
												minWidth: isFirst ? '120px' : '60px',
												width: header.column.columnDef.size
											}}
										>
											{header.isPlaceholder ? null : (
												<button
													type="button"
													disabled={!sortable}
													onClick={sortable ? () => sortable.toggleSorting() : undefined}
													className={`flex w-full items-center justify-center gap-1 px-3 ${sortable ? 'cursor-pointer' : 'cursor-default'}`}
												>
													{flexRender(header.column.columnDef.header, header.getContext())}
													{sortable ? <SortIcon dir={sortable.getIsSorted()} /> : null}
												</button>
											)}
										</th>
									)
								})}
							</tr>
						)
					})}
				</thead>
				<tbody>
					{rows.length === 0 ? (
						<tr>
							<td colSpan={table.getAllLeafColumns().length} className="py-8 text-center">
								{isLoading ? (
									<div className="flex items-center justify-center gap-2">
										<div className="size-5 animate-spin rounded-full border-b-2 border-brand" />
										<span className="text-pro-text-tertiary">Loading data...</span>
									</div>
								) : (
									<span className="text-pro-text-tertiary">{emptyMessage}</span>
								)}
							</td>
						</tr>
					) : (
						rows.map((row) => (
							<tr key={row.id} className="border-b border-subtle hover:bg-surface-elevated-2">
								{row.getVisibleCells().map((cell, cellIndex) => {
									const value = cell.getValue()
									return (
										<td
											key={cell.id}
											className={`border-r border-subtle px-1 py-2 last:border-r-0 sm:px-2 ${
												cell.column.columnDef.meta?.align === 'end' ? 'text-right' : 'text-left'
											}`}
											style={{
												minWidth: cellIndex === 0 ? '120px' : '60px',
												maxWidth: cellIndex === 0 ? '250px' : '150px',
												width: cell.column.columnDef.size
											}}
										>
											{cellIndex === 0 ? (
												<div className="min-h-[20px]">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
											) : (
												<div
													className="truncate"
													title={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
												>
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</div>
											)}
										</td>
									)
								})}
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	)
}
