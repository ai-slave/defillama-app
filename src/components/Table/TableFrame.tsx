import {
	FlexRender,
	Subscribe,
	type Column,
	type HeaderGroup,
	type RowData,
	type Table_Core
} from '@tanstack/react-table'
import { column_getCanSort, column_getIsSorted, column_toggleSorting } from '@tanstack/react-table/static-functions'
import clsx from 'clsx'
import * as React from 'react'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { SortIcon } from '~/components/Table/SortIcon'
import { useMedia } from '~/hooks/useMedia'
import { EmptyState } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import type { SortingFeatures, VisibilityFeatures } from './features/contracts'
import { TableColumnGroup } from './TableColumnGroup'
import { TableEmptyRow } from './TableEmptyRow'
import type { TableCssVars, TableLayout } from './types'

interface StickyHeaderLayout {
	left: number
	width: number
	tableWidth: number
	headerHeight: number
	scrollLeft: number
}

const areNumberArraysEqual = (a: Array<number>, b: Array<number>) => {
	if (a.length !== b.length) return false

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false
	}

	return true
}

const isSameStickyHeaderLayout = (a: StickyHeaderLayout | null, b: StickyHeaderLayout) =>
	Boolean(
		a &&
		a.left === b.left &&
		a.width === b.width &&
		a.tableWidth === b.tableWidth &&
		a.headerHeight === b.headerHeight &&
		a.scrollLeft === b.scrollLeft
	)

interface TableFrameProps<F extends SortingFeatures & VisibilityFeatures, T extends RowData> {
	children: React.ReactNode
	store: Table_Core<F, T>['store']
	visibleLeafColumns: Array<Column<F, T, unknown>>
	headerGroups: Array<HeaderGroup<F, T>>
	rowCount: number
	isChainPage: boolean
	compact: boolean
	tableLayout: TableLayout
	className?: string
	style?: React.CSSProperties
	/** Runs each time the scroll container mounts. It is not rendered while every column is hidden. */
	onContainerMount?: (container: HTMLDivElement) => void
	useStickyHeader?: boolean
}

export function TableFrame<F extends SortingFeatures & VisibilityFeatures, T extends RowData>({
	children,
	store,
	visibleLeafColumns,
	headerGroups,
	rowCount,
	isChainPage,
	compact,
	tableLayout,
	className,
	style,
	onContainerMount,
	useStickyHeader = false
}: TableFrameProps<F, T>) {
	const tableContainerRef = useRef<HTMLDivElement>(null)
	const attachContainer = useCallback(
		(container: HTMLDivElement) => {
			tableContainerRef.current = container
			onContainerMount?.(container)
			return () => {
				tableContainerRef.current = null
			}
		},
		[onContainerMount]
	)
	const isSmallScreen = useMedia('(max-width: 768px)')
	const tableHeaderRef = useRef<HTMLTableSectionElement>(null)
	const stickyHeaderTableRef = useRef<HTMLTableElement>(null)
	const stickyScrollbarRef = useRef<HTMLDivElement>(null)
	const stickyScrollbarContentRef = useRef<HTMLDivElement>(null)
	const [stickyHeaderLayout, setStickyHeaderLayout] = useState<StickyHeaderLayout | null>(null)
	const [leafColumnWidths, setLeafColumnWidths] = useState<Array<number>>([])
	const firstColumnId = visibleLeafColumns[0]?.id
	const hasNoVisibleColumns = visibleLeafColumns.length === 0
	const updateStickyHeader = useEffectEvent((tableWrapperEl: HTMLElement) => {
		const tableHeader = tableHeaderRef.current
		if (!useStickyHeader || !tableHeader) {
			setStickyHeaderLayout(null)
			return
		}

		const tableRect = tableWrapperEl.getBoundingClientRect()
		const headerRect = tableHeader.getBoundingClientRect()
		const shouldShowStickyHeader = tableRect.top <= 0 && tableRect.bottom > headerRect.height

		if (!shouldShowStickyHeader) {
			setStickyHeaderLayout(null)
			return
		}

		const widthsByColumnId = new Map<string, number>()
		const leafHeaderCells = tableHeader.querySelectorAll<HTMLTableCellElement>('th[data-leaf-column-id]')
		for (const cell of leafHeaderCells) {
			const columnId = cell.dataset.leafColumnId
			if (columnId) {
				widthsByColumnId.set(columnId, cell.getBoundingClientRect().width)
			}
		}

		const nextLeafColumnWidths: Array<number> = []
		for (const column of visibleLeafColumns) {
			nextLeafColumnWidths.push(widthsByColumnId.get(column.id) ?? 0)
		}

		setLeafColumnWidths((prev) => (areNumberArraysEqual(prev, nextLeafColumnWidths) ? prev : nextLeafColumnWidths))

		const nextLayout = {
			left: tableRect.left,
			width: tableWrapperEl.offsetWidth,
			tableWidth: tableWrapperEl.scrollWidth,
			headerHeight: headerRect.height,
			scrollLeft: tableWrapperEl.scrollLeft
		}

		setStickyHeaderLayout((prev) => (isSameStickyHeaderLayout(prev, nextLayout) ? prev : nextLayout))
	})

	const onTableScroll = useEffectEvent((tableWrapperEl: HTMLElement, isMobile: boolean) => {
		if (stickyHeaderTableRef.current) {
			stickyHeaderTableRef.current.style.setProperty('--vf-header-scroll-left', `${tableWrapperEl.scrollLeft}px`)
		}

		// Sync sticky scrollbar (desktop only)
		if (!isMobile && stickyScrollbarRef.current) {
			stickyScrollbarRef.current.scrollLeft = tableWrapperEl.scrollLeft
		}
	})

	// Consolidated scroll/resize handlers with RAF optimization
	useEffect(() => {
		const tableWrapperEl = tableContainerRef.current
		if (!tableWrapperEl) return

		const isMobile = isSmallScreen || 'ontouchstart' in window
		const stickyScrollbar = stickyScrollbarRef.current // Capture ref value for cleanup
		let scrollRaf: number | null = null
		let resizeTimeout: ReturnType<typeof setTimeout>
		let windowScrollRaf: number | null = null

		// Handle table wrapper scroll (horizontal sync)
		const handleTableScroll = () => {
			if (scrollRaf) return // Already scheduled

			scrollRaf = requestAnimationFrame(() => {
				scrollRaf = null
				onTableScroll(tableWrapperEl, isMobile)
			})
		}

		// Handle window scroll (sticky header + sticky scrollbar visibility)
		const handleWindowScroll = () => {
			if (windowScrollRaf) return // Already scheduled

			windowScrollRaf = requestAnimationFrame(() => {
				windowScrollRaf = null
				updateStickyHeader(tableWrapperEl)

				// Update sticky scrollbar visibility (desktop only)
				if (!isMobile && stickyScrollbarRef.current && stickyScrollbarContentRef.current) {
					const tableRect = tableWrapperEl.getBoundingClientRect()
					const hasHorizontalScroll = tableWrapperEl.scrollWidth > tableWrapperEl.clientWidth
					const isTableAboveViewport = tableRect.bottom > window.innerHeight
					const isTableBelowViewport = tableRect.top > window.innerHeight

					if (hasHorizontalScroll && isTableAboveViewport && !isTableBelowViewport) {
						// Batch DOM reads first
						const scrollbarWidth = tableWrapperEl.offsetWidth
						const scrollbarLeft = tableRect.left
						const contentWidth = tableWrapperEl.scrollWidth

						// Batch DOM writes using cssText for single reflow
						stickyScrollbarRef.current.style.cssText = `
							position: fixed;
							bottom: 0;
							height: 12px;
							overflow-x: auto;
							overflow-y: hidden;
							z-index: 999;
							background-color: var(--bg-surface);
							display: block;
							width: ${scrollbarWidth}px;
							left: ${scrollbarLeft}px;
						`
						stickyScrollbarContentRef.current.style.cssText = `height: 1px; width: ${contentWidth}px;`
					} else {
						stickyScrollbarRef.current.style.cssText = `
							position: fixed;
							bottom: 0;
							height: 12px;
							overflow-x: auto;
							overflow-y: hidden;
							z-index: 999;
							background-color: var(--bg-surface);
							display: none;
						`
					}
				}
			})
		}

		// Handle resize with debounce
		const handleResize = () => {
			clearTimeout(resizeTimeout)
			resizeTimeout = setTimeout(() => {
				handleWindowScroll() // Update sticky scrollbar on resize
			}, 100) // Increased to 100ms for better performance
		}

		// Handle sticky scrollbar scroll (desktop only)
		const handleStickyScroll = () => {
			if (!isMobile && stickyScrollbarRef.current) {
				tableWrapperEl.scrollLeft = stickyScrollbarRef.current.scrollLeft
			}
		}

		// Add event listeners with passive flag for better performance
		tableWrapperEl.addEventListener('scroll', handleTableScroll, { passive: true })
		window.addEventListener('scroll', handleWindowScroll, { passive: true })
		window.addEventListener('resize', handleResize, { passive: true })

		handleWindowScroll()

		if (!isMobile && stickyScrollbar) {
			stickyScrollbar.addEventListener('scroll', handleStickyScroll, { passive: true })
		}

		return () => {
			if (scrollRaf) cancelAnimationFrame(scrollRaf)
			if (windowScrollRaf) cancelAnimationFrame(windowScrollRaf)
			clearTimeout(resizeTimeout)

			tableWrapperEl.removeEventListener('scroll', handleTableScroll)
			window.removeEventListener('scroll', handleWindowScroll)
			window.removeEventListener('resize', handleResize)

			if (!isMobile && stickyScrollbar) {
				stickyScrollbar.removeEventListener('scroll', handleStickyScroll)
			}
		}
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- triggers, not inputs: any of these changes the table layout the listeners measure, so they are re-attached against the new DOM.
	}, [tableContainerRef, rowCount, isSmallScreen, headerGroups.length, visibleLeafColumns.length, useStickyHeader])
	if (hasNoVisibleColumns) {
		return (
			<EmptyState size="md" icon="eye-off" title="No columns selected" className="min-h-[400px]">
				Select at least one column from the Columns menu to view the table data.
			</EmptyState>
		)
	}
	const renderHeaderRows = ({ isStickyMirror = false }: { isStickyMirror?: boolean } = {}) => (
		<Subscribe source={store}>
			{() =>
				headerGroups.map((headerGroup) => {
					const headers = headerGroup.headers.filter(
						(header) => header.rowSpan > 0 && !header.column.columnDef.meta?.hidden
					)
					if (headers.length === 0) {
						return null
					}
					return (
						<tr key={headerGroup.id}>
							{headers.map((header) => {
								const spansRows = header.rowSpan > 1
								const meta = header.column.columnDef.meta
								const value = <FlexRender header={header} />
								const isSticky = header.column.id === firstColumnId
								const isRepeatedLeafHeader = header.isPlaceholder && !spansRows
								const isLastHeaderRow = headerGroup.depth === headerGroups.length - 1
								const isGroupedChildHeader = headerGroup.depth > 0 && !isRepeatedLeafHeader
								const isLeafHeader = header.column.columns.length === 0
								const isTopGroupedHeader = headerGroup.depth === 0 && headerGroups.length > 1

								return (
									<th
										key={header.id}
										colSpan={header.colSpan}
										rowSpan={header.rowSpan}
										data-chainpage={isChainPage}
										data-align={meta?.align ?? 'start'}
										data-leaf-column-id={isLeafHeader ? header.column.id : undefined}
										style={{
											position: isSticky ? 'sticky' : undefined,
											left: isSticky ? 0 : undefined,
											transform:
												isStickyMirror && !isSticky
													? 'translateX(calc(var(--vf-header-scroll-left, 0px) * -1))'
													: undefined,
											zIndex: isSticky ? 20 : undefined,
											background: 'var(--bg-surface)',
											borderRightColor: isSticky ? 'transparent' : undefined,
											boxShadow: isSticky && !compact ? '-1px 0 0 0 var(--border-subtle) inset' : undefined
										}}
										className={`truncate border-r border-subtle p-3 last:border-r-0 ${
											spansRows || headerGroup.depth === 0 || isGroupedChildHeader ? 'border-t' : ''
										} ${spansRows || isLastHeaderRow ? 'border-b' : ''} ${
											compact ? 'h-10 border-r-0 px-5 py-2' : ''
										} ${isRepeatedLeafHeader ? 'p-0' : ''} ${isLeafHeader ? (meta?.headerClassName ?? '') : ''}`}
									>
										{isRepeatedLeafHeader ? null : (
											<span
												className="relative flex w-full flex-nowrap items-center justify-start gap-1 table-header *:whitespace-nowrap data-[align=center]:justify-center data-[align=end]:justify-end"
												data-align={meta?.align ?? (isTopGroupedHeader && !isLeafHeader ? 'center' : 'start')}
											>
												<HeaderWithTooltip
													content={meta?.headerHelperText}
													onClick={
														(!header.isPlaceholder || spansRows) && column_getCanSort(header.column)
															? () => React.startTransition(() => column_toggleSorting(header.column))
															: null
													}
													tabIndex={isStickyMirror ? -1 : undefined}
												>
													{value}
													{(!header.isPlaceholder || spansRows) && column_getCanSort(header.column) ? (
														<SortIcon dir={column_getIsSorted(header.column)} />
													) : null}
												</HeaderWithTooltip>
											</span>
										)}
									</th>
								)
							})}
						</tr>
					)
				})
			}
		</Subscribe>
	)

	return (
		<div
			ref={attachContainer}
			className={clsx(
				'relative isolate w-full overflow-x-auto overflow-y-visible overscroll-x-contain rounded-md bg-surface',
				className
			)}
			style={{ maxWidth: '100%', WebkitOverflowScrolling: 'touch', ...style }}
		>
			<table
				style={{
					width: '100%',
					minWidth: '100%',
					tableLayout,
					borderCollapse: 'separate',
					borderSpacing: 0
				}}
			>
				{tableLayout === 'fixed' ? <TableColumnGroup columns={visibleLeafColumns} /> : null}

				<thead ref={tableHeaderRef} style={{ display: 'table-header-group', zIndex: 10 }}>
					{renderHeaderRows()}
				</thead>

				{rowCount === 0 ? (
					<tbody>
						<TableEmptyRow colSpan={visibleLeafColumns.length} />
					</tbody>
				) : (
					children
				)}
			</table>

			{stickyHeaderLayout ? (
				<div
					aria-hidden="true"
					className="overflow-hidden bg-surface"
					style={{
						position: 'fixed',
						top: 0,
						left: stickyHeaderLayout.left,
						width: stickyHeaderLayout.width,
						height: stickyHeaderLayout.headerHeight,
						zIndex: 998
					}}
				>
					<table
						ref={stickyHeaderTableRef}
						style={
							{
								width: `${stickyHeaderLayout.tableWidth}px`,
								minWidth: `${stickyHeaderLayout.tableWidth}px`,
								tableLayout: 'fixed',
								borderCollapse: 'separate',
								borderSpacing: 0,
								'--vf-header-scroll-left': `${stickyHeaderLayout.scrollLeft}px`
							} as TableCssVars
						}
					>
						<TableColumnGroup columns={visibleLeafColumns} widths={leafColumnWidths} />
						<thead style={{ display: 'table-header-group', zIndex: 10 }}>
							{renderHeaderRows({ isStickyMirror: true })}
						</thead>
					</table>
				</div>
			) : null}

			{/* Sticky horizontal scrollbar */}
			<div
				ref={stickyScrollbarRef}
				style={{
					position: 'fixed',
					bottom: 0,
					height: '12px',
					overflowX: 'auto',
					overflowY: 'hidden',
					zIndex: 999,
					display: 'none',
					backgroundColor: 'var(--bg-surface)'
				}}
			>
				<div ref={stickyScrollbarContentRef} style={{ height: '1px' }} />
			</div>
		</div>
	)
}

function HeaderWithTooltip({
	children,
	content,
	onClick,
	tabIndex
}: {
	children: React.ReactNode
	content?: string
	onClick: (() => void) | null
	tabIndex?: number
}) {
	if (onClick) {
		if (!content)
			return (
				<button type="button" tabIndex={tabIndex} onClick={onClick} className="flex items-center gap-1">
					{children}
				</button>
			)
		return (
			<Tooltip
				content={content}
				className="underline decoration-dotted"
				render={<button type="button" tabIndex={tabIndex} className="flex items-center gap-1" />}
				onClick={onClick}
			>
				{children}
			</Tooltip>
		)
	}
	if (!content) return children
	return (
		<Tooltip
			content={content}
			// Not a control: a focusable span lets keyboard readers open the definition without announcing a button.
			render={<span className="cursor-help underline decoration-dotted" />}
			tabIndex={tabIndex ?? 0}
		>
			{children}
		</Tooltip>
	)
}
