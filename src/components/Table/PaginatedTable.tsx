import { shallow, useSelector } from '@tanstack/react-store'
import {
	FlexRender,
	Subscribe,
	type ColumnMeta,
	type Row,
	type RowData,
	type Table_ColumnVisibility
} from '@tanstack/react-table'
import {
	column_getCanSort,
	column_getIsSorted,
	column_getToggleSortingHandler,
	row_getIsExpanded
} from '@tanstack/react-table/static-functions'
import {
	createContext,
	Fragment,
	startTransition,
	useContext,
	useMemo,
	useRef,
	type CSSProperties,
	type ReactNode
} from 'react'
import {
	TokenPageTable,
	TokenPageTableBodyCell,
	TokenPageTableHeaderCell,
	TokenPageTableScroller,
	TokenPageTableShell
} from '~/components/Table/helpers'
import { SortIcon } from '~/components/Table/SortIcon'
import { Icon } from '~/ui/Icon'
import { SurfaceLoadingOverlay } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import type {
	PaginatedTableInstance,
	PaginationFeatures,
	SortingFeatures,
	VisibilityFeatures
} from './features/contracts'

interface PaginatedTableProps<F extends PaginationFeatures & SortingFeatures & VisibilityFeatures, T extends RowData> {
	table: PaginatedTableInstance<F, T> & Table_ColumnVisibility<F, T>
	pageSizeOptions: ReadonlyArray<number>
	className?: string
	style?: CSSProperties
	tableClassName?: string
	paginationClassName?: string
	shell?: 'default' | 'none'
	stickyHeader?: boolean
	interactionDisabled?: boolean
	loadingLabel?: string
	/** Render an expanded panel beneath a row when `row_getIsExpanded(row)` is true. Spans all columns. */
	renderSubComponent?: (row: Row<F, T>) => ReactNode
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

export function PaginatedTable<F extends PaginationFeatures & SortingFeatures & VisibilityFeatures, T extends RowData>({
	table,
	pageSizeOptions,
	className,
	style,
	tableClassName,
	paginationClassName,
	shell = 'default',
	stickyHeader = false,
	interactionDisabled = false,
	loadingLabel = 'Loading data...',
	renderSubComponent
}: PaginatedTableProps<F, T>) {
	const { rows, rowCount, visibleLeafColumns, headerGroups, pagination, pageCount, canPreviousPage, canNextPage } =
		useSelector(
			table.store,
			() => ({
				rows: table.getRowModel().rows,
				rowCount: table.getRowCount(),
				visibleLeafColumns: table.getVisibleLeafColumns(),
				headerGroups: table.getHeaderGroups(),
				pagination: table.atoms.pagination.get(),
				pageCount: table.getPageCount(),
				canPreviousPage: table.getCanPreviousPage(),
				canNextPage: table.getCanNextPage()
			}),
			{ compare: shallow }
		)
	// Use the selected columns as inputs so same-ID formatter replacements invalidate cells.
	const cellsByRow = useMemo(
		() =>
			rows.map((row) => {
				const cells = row.getAllCellsByColumnId()
				return visibleLeafColumns.map((column) => cells[column.id])
			}),
		[rows, visibleLeafColumns]
	)
	const { pageIndex, pageSize } = pagination
	const displayPageCount = Math.max(1, pageCount)
	const displayPageIndex = pageCount === 0 ? 0 : Math.min(pageIndex, displayPageCount - 1)
	const availablePageSizeOptions = useMemo(() => {
		if (pageSizeOptions.includes(pageSize)) return pageSizeOptions

		return [...pageSizeOptions, pageSize].sort((a, b) => a - b)
	}, [pageSize, pageSizeOptions])
	const shouldShowPaginationControls = rowCount > 10 && pageCount > 1
	const shouldShowPageSizeSelector = rowCount > 10 && availablePageSizeOptions.length >= 2
	const attachedPaginationClassName = shell === 'none' ? 'border-t border-subtle p-2' : ''
	const stickyHeaderContentRef = useRef<HTMLDivElement>(null)
	const handleTableScroll = (event: React.UIEvent<HTMLDivElement>) => {
		if (!stickyHeaderContentRef.current) return
		const scrollLeft = event.currentTarget.scrollLeft
		stickyHeaderContentRef.current.style.setProperty('--paginated-header-scroll-left', `${scrollLeft}px`)
		stickyHeaderContentRef.current.style.transform = `translateX(-${scrollLeft}px)`
	}
	const displayRowNumbers = useMemo(
		() => new Map(rows.map((row, rowIndex) => [row.id, pageIndex * pageSize + rowIndex + 1])),
		[pageIndex, pageSize, rows]
	)
	const renderHeader = ({
		stickyMirror = false,
		interactive = true
	}: { stickyMirror?: boolean; interactive?: boolean } = {}) => (
		<Subscribe source={table.store}>
			{() => (
				<thead data-sticky-header-mirror={stickyMirror || undefined}>
					{headerGroups.map((headerGroup) => (
						<tr key={headerGroup.id} className="border-b border-subtle bg-surface">
							{headerGroup.headers
								.filter((header) => header.rowSpan > 0)
								.map((header) => {
									// This renderer uses the global metadata contract, not a per-table columnMeta slot.
									const meta = header.column.columnDef.meta as ColumnMeta<F, T> | undefined
									const align = meta?.align ?? 'start'
									const headerClassName = header.column.columnDef.meta?.headerClassName
									const isHorizontallySticky = headerClassName?.split(/\s+/).includes('sticky') ?? false
									const headerAlignmentClass =
										align === 'center' ? 'mx-auto w-fit' : align === 'end' ? 'ms-auto w-fit' : 'w-fit'
									const headerLead = meta?.headerLead?.(header.getContext())
									const headerTrail = meta?.headerTrail?.(header.getContext())

									return (
										<TokenPageTableHeaderCell
											key={header.id}
											colSpan={header.colSpan}
											rowSpan={header.rowSpan}
											textAlign={align}
											className={headerClassName}
											style={
												stickyMirror && isHorizontallySticky
													? { transform: 'translateX(var(--paginated-header-scroll-left, 0px))' }
													: undefined
											}
										>
											{header.isPlaceholder && header.rowSpan === 1 ? null : (
												<div
													className={
														headerLead || headerTrail
															? `${headerAlignmentClass} flex items-center gap-1`
															: headerAlignmentClass
													}
												>
													{headerLead}
													{interactive ? (
														<HeaderWithTooltip
															content={header.column.columnDef.meta?.headerHelperText}
															onClick={
																!column_getCanSort(header.column) ? null : column_getToggleSortingHandler(header.column)
															}
															disabled={interactionDisabled}
														>
															<FlexRender header={header} />
															{column_getCanSort(header.column) ? (
																<SortIcon dir={column_getIsSorted(header.column)} />
															) : null}
														</HeaderWithTooltip>
													) : (
														<span
															className={`inline-flex items-center gap-1 whitespace-nowrap ${
																header.column.columnDef.meta?.headerHelperText ? 'underline decoration-dotted' : ''
															}`}
														>
															<FlexRender header={header} />
															{column_getCanSort(header.column) ? (
																<SortIcon dir={column_getIsSorted(header.column)} />
															) : null}
														</span>
													)}
													{headerTrail}
												</div>
											)}
										</TokenPageTableHeaderCell>
									)
								})}
						</tr>
					))}
				</thead>
			)}
		</Subscribe>
	)
	const tableContent = (
		<TokenPageTableScroller className="bg-surface" onScroll={stickyHeader ? handleTableScroll : undefined}>
			{interactionDisabled ? <SurfaceLoadingOverlay label={loadingLabel} /> : null}
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
				{renderHeader({ interactive: !stickyHeader })}
				<Subscribe source={table.store}>
					{() => (
						<tbody>
							{rows.map((row, rowIndex) => {
								const isExpanded = renderSubComponent != null && row_getIsExpanded(row)
								return (
									<Fragment key={row.id}>
										<tr className={`border-b border-subtle ${isExpanded ? '' : 'last:border-b-0'}`}>
											{cellsByRow[rowIndex].map((cell) => {
												const align = cell.column.columnDef.meta?.align ?? 'start'

												return (
													<TokenPageTableBodyCell
														key={cell.id}
														textAlign={align}
														className={cell.column.columnDef.meta?.cellClassName}
													>
														<FlexRender cell={cell} />
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
					)}
				</Subscribe>
			</TokenPageTable>
		</TokenPageTableScroller>
	)

	return (
		<DisplayRowNumbersContext.Provider value={displayRowNumbers}>
			<div className={`flex flex-col ${shell === 'none' ? 'gap-0' : 'gap-3'} ${className ?? ''}`} style={style}>
				{stickyHeader ? (
					<div data-sticky-table-header className="sticky top-0 z-30 h-0">
						<div className="w-full overflow-clip bg-surface shadow-xs">
							<div
								ref={stickyHeaderContentRef}
								className={`w-full ${tableClassName ?? ''}`}
								style={{ willChange: 'transform' }}
							>
								<TokenPageTable
									role="presentation"
									className="z-10 bg-surface"
									style={{ tableLayout: 'fixed', width: '100%' }}
								>
									<colgroup>
										{visibleLeafColumns.map((column) => (
											<col key={column.id} className={column.columnDef.meta?.headerClassName} />
										))}
									</colgroup>
									{renderHeader({ stickyMirror: true })}
								</TokenPageTable>
							</div>
						</div>
					</div>
				) : null}
				{shell === 'default' ? (
					<TokenPageTableShell className="bg-surface">{tableContent}</TokenPageTableShell>
				) : (
					tableContent
				)}

				{shouldShowPaginationControls || shouldShowPageSizeSelector ? (
					<div
						className={`flex flex-wrap items-center justify-between gap-2 ${attachedPaginationClassName} ${paginationClassName ?? ''}`.trim()}
					>
						<div className="flex items-center gap-2">
							{shouldShowPaginationControls ? (
								<>
									<button
										type="button"
										aria-label="Go to first page"
										onClick={() => startTransition(() => table.setPageIndex(0))}
										disabled={interactionDisabled || !canPreviousPage}
										className="rounded-md border border-subtle p-2 text-sm text-secondary transition-colors hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Icon name="chevrons-left" height={16} width={16} />
									</button>
									<button
										type="button"
										aria-label="Go to previous page"
										onClick={() => startTransition(() => table.previousPage())}
										disabled={interactionDisabled || !canPreviousPage}
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
										disabled={interactionDisabled || !canNextPage}
										className="rounded-md border border-subtle p-2 text-sm text-secondary transition-colors hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Icon name="chevron-right" height={16} width={16} />
									</button>
									<button
										type="button"
										aria-label="Go to last page"
										onClick={() => startTransition(() => table.setPageIndex(Math.max(0, table.getPageCount() - 1)))}
										disabled={interactionDisabled || !canNextPage}
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
