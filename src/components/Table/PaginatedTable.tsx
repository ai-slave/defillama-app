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
import { Select } from '~/components/Select/Select'
import {
	TokenPageTable,
	TokenPageTableBodyCell,
	TokenPageTableHeaderCell,
	TokenPageTableScroller
} from '~/components/Table/helpers'
import { SortIcon } from '~/components/Table/SortIcon'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { SurfaceLoadingOverlay } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import type {
	PaginatedTableInstance,
	PaginationFeatures,
	SortingFeatures,
	VisibilityFeatures
} from './features/contracts'
import { getPaginationControls } from './paginationControls'
import { TableColumnGroup } from './TableColumnGroup'
import { TableEmptyRow } from './TableEmptyRow'
import { useTableCells } from './useTableCells'

interface PaginatedTableProps<F extends PaginationFeatures & SortingFeatures & VisibilityFeatures, T extends RowData> {
	table: PaginatedTableInstance<F, T> & Table_ColumnVisibility<F, T>
	pageSizeOptions: ReadonlyArray<number>
	className?: string
	style?: CSSProperties
	tableClassName?: string
	stickyHeader?: boolean
	interactionDisabled?: boolean
	loadingLabel?: string
	/** Replaces "No results found" in the row shown when the row model is empty. */
	emptyMessage?: ReactNode
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
			'inline-flex items-center gap-1 whitespace-nowrap aria-disabled:cursor-not-allowed aria-disabled:text-disabled'

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

/**
 * Render the current page with pagination controls, a page-size selector, loading overlays and optional expanded
 * panels. The surrounding Panel or Card is the table's border.
 *
 * - Body cells wrap unless the column sets `meta.cellClassName: 'truncate'`.
 * - `stickyHeader` is only for long directories that need persistent column context.
 */
export function PaginatedTable<F extends PaginationFeatures & SortingFeatures & VisibilityFeatures, T extends RowData>({
	table,
	pageSizeOptions,
	className,
	style,
	tableClassName,
	stickyHeader = false,
	interactionDisabled = false,
	loadingLabel = 'Loading data…',
	emptyMessage,
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
	const cellsByRow = useTableCells(rows, visibleLeafColumns)
	const { pageIndex, pageSize } = pagination
	const {
		showNavigation: shouldShowPaginationControls,
		showPageSizeSelector: shouldShowPageSizeSelector,
		pageLabel,
		pageSizeOptions: availablePageSizeOptions
	} = getPaginationControls({ rowCount, pageCount, pageIndex, pageSize, pageSizeOptions })
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
			{/* The watermark sits at mid-height, where an empty table shows its message. */}
			{rows.length > 0 ? (
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
			) : null}
			<TokenPageTable
				className={`z-10 bg-surface ${tableClassName ?? ''}`}
				style={{ tableLayout: 'fixed', width: '100%' }}
			>
				<TableColumnGroup columns={visibleLeafColumns} />
				{renderHeader({ interactive: !stickyHeader })}
				<Subscribe source={table.store}>
					{() => (
						<tbody>
							{/* While interaction is disabled the loading overlay speaks for the empty table. */}
							{rows.length === 0 && !interactionDisabled ? (
								<TableEmptyRow colSpan={visibleLeafColumns.length}>{emptyMessage}</TableEmptyRow>
							) : null}
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
			{/* The page's Panel or Card owns the border, so the pagination row attaches to the table. */}
			<div className={`flex flex-col ${className ?? ''}`} style={style}>
				{stickyHeader ? (
					<div data-sticky-table-header className="sticky top-0 z-30 h-0">
						<div className="w-full overflow-clip bg-surface shadow-raised">
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
									<TableColumnGroup columns={visibleLeafColumns} />
									{renderHeader({ stickyMirror: true })}
								</TokenPageTable>
							</div>
						</div>
					</div>
				) : null}
				{tableContent}

				{shouldShowPaginationControls || shouldShowPageSizeSelector ? (
					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle p-2">
						<div className="flex items-center gap-2">
							{shouldShowPaginationControls ? (
								<>
									{/* Each pager button disables itself at the end it moves to, so it keeps focus while disabled. */}
									<Tooltip
										content="Go to first page"
										render={
											<Button
												type="button"
												aria-label="Go to first page"
												onClick={() => startTransition(() => table.setPageIndex(0))}
												disabled={interactionDisabled || !canPreviousPage}
												accessibleWhenDisabled
												variant="secondary"
												size="md"
												square
											/>
										}
									>
										<Icon name="chevrons-left" className="size-4" />
									</Tooltip>
									<Tooltip
										content="Go to previous page"
										render={
											<Button
												type="button"
												aria-label="Go to previous page"
												onClick={() => startTransition(() => table.previousPage())}
												disabled={interactionDisabled || !canPreviousPage}
												accessibleWhenDisabled
												variant="secondary"
												size="md"
												square
											/>
										}
									>
										<Icon name="chevron-left" className="size-4" />
									</Tooltip>
									<span className="body-sm text-secondary">{pageLabel}</span>
									<Tooltip
										content="Go to next page"
										render={
											<Button
												type="button"
												aria-label="Go to next page"
												onClick={() => startTransition(() => table.nextPage())}
												disabled={interactionDisabled || !canNextPage}
												accessibleWhenDisabled
												variant="secondary"
												size="md"
												square
											/>
										}
									>
										<Icon name="chevron-right" className="size-4" />
									</Tooltip>
									<Tooltip
										content="Go to last page"
										render={
											<Button
												type="button"
												aria-label="Go to last page"
												onClick={() => startTransition(() => table.setPageIndex(Math.max(0, table.getPageCount() - 1)))}
												disabled={interactionDisabled || !canNextPage}
												accessibleWhenDisabled
												variant="secondary"
												size="md"
												square
											/>
										}
									>
										<Icon name="chevrons-right" className="size-4" />
									</Tooltip>
								</>
							) : null}
						</div>

						{shouldShowPageSizeSelector ? (
							<Select
								allValues={availablePageSizeOptions.map(String)}
								selectedValues={String(pageSize)}
								setSelectedValues={(value) => {
									startTransition(() => {
										table.setPagination((prev) => ({ ...prev, pageIndex: 0, pageSize: Number(value) }))
									})
								}}
								label="Rows per page"
								labelType="regular"
								variant="filter"
								size="md"
								placement="top-end"
								className="ml-auto"
								triggerProps={{ disabled: interactionDisabled }}
							/>
						) : null}
					</div>
				) : null}
			</div>
		</DisplayRowNumbersContext.Provider>
	)
}
