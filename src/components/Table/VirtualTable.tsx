import type { RowData } from '@tanstack/react-table'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import * as React from 'react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '~/ui/Icon'
import type { SortingFeatures, VisibilityFeatures } from './features/contracts'
import { TableFrame } from './TableFrame'
import { TableRow } from './TableRow'
import type { TableProps, TableCssVars } from './types'
import { useTableView } from './useTableView'

interface VirtualTableProps<F extends SortingFeatures & VisibilityFeatures, T extends RowData> extends TableProps<
	F,
	T
> {
	useStickyHeader?: boolean
}
const DEFAULT_VIRTUAL_ROW_SIZE = 50
const COMPACT_VIRTUAL_ROW_SIZE = 40
const INITIAL_VIRTUAL_WINDOW_ROWS = 18

const getInitialVirtualizerHeight = (rowCount: number, rowHeight: number) =>
	Math.min(rowCount, INITIAL_VIRTUAL_WINDOW_ROWS) * rowHeight

export function VirtualTable<F extends SortingFeatures & VisibilityFeatures, T extends RowData>({
	table,
	rowSize,
	stripedBg = false,
	compact = false,
	useStickyHeader = true,
	rowRankById,
	tableLayout = 'fixed',
	className,
	style
}: VirtualTableProps<F, T>) {
	'use no memo'
	// React Virtual still exposes mutable render values behind a stable instance.
	const tableContainerRef = useRef<HTMLDivElement>(null)
	const { rows, headerGroups, visibleLeafColumns, subRowOrdinalById, isChainPage } = useTableView(table)
	const firstColumnId = visibleLeafColumns[0]?.id
	const [containerOffset, setContainerOffset] = useState(0)
	useEffect(() => {
		if (tableContainerRef.current) {
			// Not offsetTop: it measures from the nearest positioned ancestor, and
			// panel wrappers (ui/Panel) are position:relative — the window
			// virtualizer needs the offset from the top of the document.
			setContainerOffset(tableContainerRef.current.getBoundingClientRect().top + window.scrollY)
		}
	}, [])

	const estimatedRowSize = rowSize ?? (compact ? COMPACT_VIRTUAL_ROW_SIZE : DEFAULT_VIRTUAL_ROW_SIZE)
	const initialVirtualizerRect = React.useMemo(
		() => ({ width: 0, height: getInitialVirtualizerHeight(rows.length, estimatedRowSize) }),
		[rows.length, estimatedRowSize]
	)
	const rowVirtualizer = useWindowVirtualizer({
		count: rows.length,
		// Virtual rows are fixed-height; keep rowSize aligned with rendered row CSS/content.
		estimateSize: () => estimatedRowSize,
		initialOffset: 0,
		initialRect: initialVirtualizerRect,
		overscan: 5,
		scrollMargin: containerOffset,
		// Sync the virtualizer's internal scrollOffset to the real window position
		// during effect setup, *before* its mount-time _scrollToOffset fires. Otherwise
		// the virtualizer would scroll the window to its stale initialOffset (0) and
		// clobber any hash-based scroll the browser had just applied. Keeping
		// initialOffset at 0 also preserves SSR/CSR render parity (no hydration mismatch).
		observeElementOffset: (instance1, cb) => {
			const target = instance1.scrollElement as (Window & typeof globalThis) | null
			if (!target) return
			cb(target.scrollY, false)
			const onScroll = () => cb(target.scrollY, true)
			target.addEventListener('scroll', onScroll, { passive: true })
			return () => target.removeEventListener('scroll', onScroll)
		}
	})
	const virtualItems = rowVirtualizer.getVirtualItems()
	const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
		if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
			toast.error("Native browser search isn't well supported, please use search boxes / ctrl-k / cmd-k instead", {
				id: 'native-search-warn',
				icon: <Icon name="alert-triangle" className="text-data-down" height={16} width={16} style={{ flexShrink: 0 }} />
			})
		}
	})

	useEffect(() => {
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [])

	const rowScrollMargin = rowVirtualizer.options.scrollMargin
	const firstVirtualItem = virtualItems[0]
	const lastVirtualItem = virtualItems[virtualItems.length - 1]
	const topSpacerHeight = firstVirtualItem ? Math.max(0, firstVirtualItem.start - rowScrollMargin) : 0
	const bottomSpacerHeight = lastVirtualItem
		? Math.max(0, rowVirtualizer.getTotalSize() - (lastVirtualItem.end - rowScrollMargin))
		: 0
	return (
		<TableFrame
			store={table.store}
			containerRef={tableContainerRef}
			useStickyHeader={useStickyHeader}
			visibleLeafColumns={visibleLeafColumns}
			headerGroups={headerGroups}
			rowCount={rows.length}
			isChainPage={isChainPage}
			compact={compact}
			tableLayout={tableLayout}
			className={className}
			style={style}
		>
			<tbody className="vf-row-counter" style={{ '--vf-row-offset': `${virtualItems[0]?.index ?? 0}` } as TableCssVars}>
				{topSpacerHeight > 0 ? (
					<tr aria-hidden="true">
						<td
							colSpan={visibleLeafColumns.length}
							className="border-0 p-0"
							style={{ height: `${topSpacerHeight}px` }}
						/>
					</tr>
				) : null}
				{virtualItems.map((virtualRow) => (
					<TableRow
						key={rows[virtualRow.index].id}
						row={rows[virtualRow.index]}
						cells={rows[virtualRow.index].getAllCells()}
						index={virtualRow.index}
						virtualIndex={virtualRow.index}
						rowHeight={virtualRow.size}
						subRowOrdinalById={subRowOrdinalById}
						rowRankById={rowRankById}
						firstColumnId={firstColumnId}
						stripedBg={stripedBg}
						isChainPage={isChainPage}
						compact={compact}
					/>
				))}
				{bottomSpacerHeight > 0 ? (
					<tr aria-hidden="true">
						<td
							colSpan={visibleLeafColumns.length}
							className="border-0 p-0"
							style={{ height: `${bottomSpacerHeight}px` }}
						/>
					</tr>
				) : null}
			</tbody>
		</TableFrame>
	)
}
