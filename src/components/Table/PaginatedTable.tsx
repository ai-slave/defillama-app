'use no memo'

import { flexRender, type Row, type RowData, type Table as ReactTable } from '@tanstack/react-table'
import {
	createContext,
	Fragment,
	startTransition,
	useContext,
	useMemo,
	type CSSProperties,
	type ReactNode
} from 'react'
import { Icon } from '~/components/Icon'
import { LoadingSpinner } from '~/components/Loaders'
import {
	TokenPageTable,
	TokenPageTableBodyCell,
	TokenPageTableHeaderCell,
	TokenPageTableScroller,
	TokenPageTableShell
} from '~/components/Table/helpers'
import { SortIcon } from '~/components/Table/SortIcon'
import { Tooltip } from '~/components/Tooltip'

interface PaginatedTableProps<T extends RowData> {
	table: ReactTable<T>
	pageSizeOptions: readonly number[]
	className?: string
	style?: CSSProperties
	tableClassName?: string
	shell?: 'default' | 'none'
	interactionDisabled?: boolean
	/** Render an expanded panel beneath a row when `row.getIsExpanded()` is true. Spans all columns. */
	renderSubComponent?: (row: Row<T>) => ReactNode
}

const DisplayRowNumbersContext = createContext<Map<string, number> | null>(null)

function HeaderWithTooltip({
	children,
	content,
	onClick,
	disabled = false
}: {
	children: React.ReactNode
	content?: string
	onClick: ((event: React.MouseEvent<HTMLElement>) => void) | null
	disabled?: boolean
}) {
	if (onClick) {
		const handleClick = (event: React.MouseEvent<HTMLElement>) => {
			if (disabled) {
				event.preventDefault()
				return
			}

			onClick(event)
		}
		const buttonClassName =
			'inline-flex items-center gap-1 whitespace-nowrap aria-disabled:cursor-not-allowed aria-disabled:opacity-70'

		if (!content) {
			return (
				<button type="button" onClick={handleClick} aria-disabled={disabled} className={buttonClassName}>
					{children}
				</button>
			)
		}

		return (
			<Tooltip
				content={content}
				className="underline decoration-dotted"
				render={<button type="button" aria-disabled={disabled} className={buttonClassName} />}
				onClick={handleClick}
			>
				{children}
			</Tooltip>
		)
	}

	if (!content) return <>{children}</>

	return (
		<Tooltip content={content} className="underline decoration-dotted">
			{children}
		</Tooltip>
	)
}

export function usePaginatedTableDisplayRowNumber(rowId: string) {
	return useContext(DisplayRowNumbersContext)?.get(rowId)
}

export function PaginatedTable<T extends RowData>({
	table,
	pageSizeOptions,
	className,
	style,
	tableClassName,
	shell = 'default',
	interactionDisabled = false,
	renderSubComponent
}: PaginatedTableProps<T>) {
	const rows = table.getRowModel().rows
	const rowCount = table.getRowCount()
	const visibleLeafColumns = table.getVisibleLeafColumns()
	const { pageIndex, pageSize } = table.getState().pagination
	const pageCount = table.getPageCount()
	const displayPageCount = Math.max(1, pageCount)
	const displayPageIndex = pageCount === 0 ? 0 : Math.min(pageIndex, displayPageCount - 1)
	const availablePageSizeOptions = useMemo(() => {
		if (pageSizeOptions.includes(pageSize)) return pageSizeOptions

		return [...pageSizeOptions, pageSize].sort((a, b) => a - b)
	}, [pageSize, pageSizeOptions])
	const shouldShowPaginationControls = rowCount > 10 && pageCount > 1
	const shouldShowPageSizeSelector = rowCount > 10 && availablePageSizeOptions.length >= 2
	const displayRowNumbers = useMemo(
		() => new Map(rows.map((row, rowIndex) => [row.id, pageIndex * pageSize + rowIndex + 1])),
		[pageIndex, pageSize, rows]
	)
	const tableContent = (
		<TokenPageTableScroller className="bg-surface">
			{interactionDisabled ? (
				<div className="absolute inset-0 z-20 flex items-center justify-center bg-surface/60 backdrop-blur-[1px]">
					<div className="flex items-center gap-2 rounded-md border border-subtle bg-surface px-3 py-2 text-sm text-secondary shadow-xs">
						<LoadingSpinner size={14} />
						<span>Loading data...</span>
					</div>
				</div>
			) : null}
			<div className="pointer-events-none sticky left-0 z-0 h-0 w-full max-sm:hidden" style={{ top: '50%' }}>
				<img
					src="/assets/defillama-dark-neutral.webp"
					alt="defillama"
					height={53}
					width={155}
					className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 dark:hidden"
				/>
				<img
					src="/assets/defillama-light-neutral.webp"
					alt="defillama"
					height={53}
					width={155}
					className="absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/2 opacity-30 dark:block"
				/>
			</div>
			<TokenPageTable
				className={`z-10 bg-surface ${tableClassName ?? ''}`}
				style={{ tableLayout: 'fixed', width: '100%' }}
			>
				<colgroup>
					{visibleLeafColumns.map((column) => (
						<col key={column.id} className={column.columnDef.meta?.headerClassName} />
					))}
				</colgroup>
				<thead>
					{table.getHeaderGroups().map((headerGroup) => (
						<tr key={headerGroup.id} className="border-b border-subtle bg-surface">
							{headerGroup.headers.map((header) => {
								const align = header.column.columnDef.meta?.align ?? 'start'
								const headerAlignmentClass =
									align === 'center' ? 'mx-auto w-fit' : align === 'end' ? 'ms-auto w-fit' : 'w-fit'

								return (
									<TokenPageTableHeaderCell
										key={header.id}
										textAlign={align}
										className={header.column.columnDef.meta?.headerClassName}
									>
										{header.isPlaceholder ? null : (
											<div className={headerAlignmentClass}>
												<HeaderWithTooltip
													content={header.column.columnDef.meta?.headerHelperText}
													onClick={!header.column.getCanSort() ? null : header.column.getToggleSortingHandler()}
													disabled={interactionDisabled}
												>
													{flexRender(header.column.columnDef.header, header.getContext())}
													{header.column.getCanSort() ? <SortIcon dir={header.column.getIsSorted()} /> : null}
												</HeaderWithTooltip>
											</div>
										)}
									</TokenPageTableHeaderCell>
								)
							})}
						</tr>
					))}
				</thead>
				<tbody>
					{rows.map((row) => {
						const isExpanded = renderSubComponent != null && row.getIsExpanded()
						return (
							<Fragment key={row.id}>
								<tr className={`border-b border-subtle ${isExpanded ? '' : 'last:border-b-0'}`}>
									{row.getVisibleCells().map((cell) => {
										const align = cell.column.columnDef.meta?.align ?? 'start'

										return (
											<TokenPageTableBodyCell
												key={cell.id}
												textAlign={align}
												className={cell.column.columnDef.meta?.cellClassName}
											>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TokenPageTableBodyCell>
										)
									})}
								</tr>
								{isExpanded ? (
									<tr className="border-b border-subtle last:border-b-0">
										<td colSpan={visibleLeafColumns.length} className="bg-surface p-0">
											{renderSubComponent!(row)}
										</td>
									</tr>
								) : null}
							</Fragment>
						)
					})}
				</tbody>
			</TokenPageTable>
		</TokenPageTableScroller>
	)

	return (
		<DisplayRowNumbersContext.Provider value={displayRowNumbers}>
			<div className={`flex flex-col gap-3 ${className ?? ''}`} style={style}>
				{shell === 'default' ? (
					<TokenPageTableShell className="bg-surface">{tableContent}</TokenPageTableShell>
				) : (
					tableContent
				)}

				{shouldShowPaginationControls || shouldShowPageSizeSelector ? (
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							{shouldShowPaginationControls ? (
								<>
									<button
										type="button"
										aria-label="Go to first page"
										onClick={() => startTransition(() => table.setPageIndex(0))}
										disabled={interactionDisabled || !table.getCanPreviousPage()}
										className="rounded-md border border-subtle p-2 text-sm text-secondary transition-colors hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Icon name="chevrons-left" height={16} width={16} />
									</button>
									<button
										type="button"
										aria-label="Go to previous page"
										onClick={() => startTransition(() => table.previousPage())}
										disabled={interactionDisabled || !table.getCanPreviousPage()}
										className="rounded-md border border-subtle p-2 text-sm text-secondary transition-colors hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Icon name="chevron-left" height={16} width={16} />
									</button>
									<span className="text-xs text-secondary">
										{`Page ${displayPageIndex + 1} of ${displayPageCount}`}
									</span>
									<button
										type="button"
										aria-label="Go to next page"
										onClick={() => startTransition(() => table.nextPage())}
										disabled={interactionDisabled || !table.getCanNextPage()}
										className="rounded-md border border-subtle p-2 text-sm text-secondary transition-colors hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Icon name="chevron-right" height={16} width={16} />
									</button>
									<button
										type="button"
										aria-label="Go to last page"
										onClick={() => startTransition(() => table.setPageIndex(Math.max(0, table.getPageCount() - 1)))}
										disabled={interactionDisabled || !table.getCanNextPage()}
										className="rounded-md border border-subtle p-2 text-sm text-secondary transition-colors hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Icon name="chevrons-right" height={16} width={16} />
									</button>
								</>
							) : null}
						</div>

						{shouldShowPageSizeSelector ? (
							<label className="flex items-center gap-2 text-sm">
								<span className="text-secondary">Rows per page</span>
								<select
									value={pageSize}
									disabled={interactionDisabled}
									onChange={(event) => {
										const nextPageSize = Number(event.currentTarget.value)
										startTransition(() => {
											table.setPagination((prev) => ({
												...prev,
												pageIndex: 0,
												pageSize: nextPageSize
											}))
										})
									}}
									className="rounded-md border border-medium bg-surface px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{availablePageSizeOptions.map((pageSizeOption) => (
										<option key={pageSizeOption} value={pageSizeOption}>
											{pageSizeOption}
										</option>
									))}
								</select>
							</label>
						) : null}
					</div>
				) : null}
			</div>
		</DisplayRowNumbersContext.Provider>
	)
}
