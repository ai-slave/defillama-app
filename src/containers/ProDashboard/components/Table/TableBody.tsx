import { FlexRender, Subscribe, type Header, type RowData, type Table } from '@tanstack/react-table'
import {
	column_getCanSort,
	column_getIsSorted,
	column_getSize,
	column_toggleSorting,
	row_getVisibleCells
} from '@tanstack/react-table/static-functions'
import type { SortingFeatures, VisibilityFeatures } from '~/components/Table/features/contracts'
import { SortIcon } from '~/components/Table/SortIcon'
import { ProCardLoading } from '../ProCardStatus'

interface TableBodyProps<F extends SortingFeatures & VisibilityFeatures, TData extends RowData> {
	table: Table<F, TData>
	isLoading?: boolean
	emptyMessage?: string
}

const getSortableColumn = <F extends SortingFeatures & VisibilityFeatures, TData extends RowData>(
	header: Header<F, TData, unknown>
) => {
	if (column_getCanSort(header.column)) return header.column
	const firstSortableLeaf = header.column.getLeafColumns().find((leafColumn) => column_getCanSort(leafColumn))
	return firstSortableLeaf ?? null
}

export function TableBody<F extends SortingFeatures & VisibilityFeatures, TData extends RowData>({
	table,
	isLoading,
	emptyMessage = 'No rows match current filters'
}: TableBodyProps<F, TData>) {
	return (
		<Subscribe source={table.store}>
			{() => {
				const rows = table.getRowModel().rows
				return (
					<div
						className="relative -mx-2 min-h-0 w-full flex-1 overflow-auto px-2 sm:mx-0 sm:px-0"
						style={{ height: '100%' }}
					>
						<table className="w-full min-w-[600px] border-collapse text-xs text-pro-text-primary sm:text-sm">
							<thead className="sticky top-0 z-10">
								{table.getHeaderGroups().map((headerGroup) => {
									let firstVisibleHeaderId: string | null = null
									for (const header of headerGroup.headers) {
										if (header.rowSpan === 0) continue
										if (firstVisibleHeaderId === null) firstVisibleHeaderId = header.id
									}
									return (
										<tr key={headerGroup.id}>
											{headerGroup.headers
												.filter((header) => header.rowSpan > 0)
												.map((header) => {
													const isFirst = header.id === firstVisibleHeaderId
													const sortable = getSortableColumn(header)

													return (
														<th
															key={header.id}
															colSpan={header.colSpan}
															rowSpan={header.rowSpan}

															className={`relative border-r border-b border-subtle bg-pro-cards-bg px-1 py-2 font-medium first:rounded-l-md last:rounded-r-md last:border-r-0 sm:px-2 ${
																header.column.columnDef.meta?.align === 'end' ? 'text-right' : 'text-left'
															}`}
															style={{
																minWidth: isFirst ? '120px' : '60px',
																width: column_getSize(header.column)
															}}
														>
															{header.isPlaceholder && header.rowSpan === 1 ? null : (
																<button
																	type="button"
																	disabled={!sortable}
																	onClick={sortable ? () => column_toggleSorting(sortable) : undefined}
																	className={`flex w-full items-center justify-center gap-1 px-3 ${sortable ? 'cursor-pointer' : 'cursor-default'}`}
																>
																	<FlexRender header={header} />
																	{sortable ? <SortIcon dir={column_getIsSorted(sortable)} /> : null}
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
												<div className="flex">
													<ProCardLoading variant="table" label="Loading data…" />
												</div>
											) : (
												<span className="text-pro-text-tertiary">{emptyMessage}</span>
											)}
										</td>
									</tr>
								) : (
									rows.map((row) => (
										<tr key={row.id} className="border-b border-subtle hover:bg-surface-elevated-2">
											{row_getVisibleCells(row).map((cell, cellIndex) => {
												const value = cell.getValue()
												return (
													<td
														key={cell.id}
														className={`border-r border-subtle px-1 py-2 last:border-r-0 sm:px-2 ${
															cell.column.columnDef.meta?.align === 'end' ? 'text-right tabular-nums' : 'text-left'
														}`}
														style={{
															minWidth: cellIndex === 0 ? '120px' : '60px',
															maxWidth: cellIndex === 0 ? '250px' : '150px',
															width: column_getSize(cell.column)
														}}
													>
														{cellIndex === 0 ? (
															<div className="min-h-[20px]">
																<FlexRender cell={cell} />
															</div>
														) : (
															<div
																className="truncate"
																title={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
															>
																<FlexRender cell={cell} />
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
			}}
		</Subscribe>
	)
}
