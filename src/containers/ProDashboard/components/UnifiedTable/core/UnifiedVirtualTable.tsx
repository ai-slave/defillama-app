'use no memo'

import { FlexRender, type Column, type HeaderGroup, type Row } from '@tanstack/react-table'
// TODO(PRO-2004): Remove this opt-out once React Compiler no longer regresses virtualized column sizing/layout sync.
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLayoutEffect, useRef } from 'react'
import { SortIcon } from '~/components/Table/SortIcon'
import { Tooltip } from '~/ui/Tooltip'
import type { ProtocolTableRow } from '../types'
import type { tableFeaturesConfig } from './useUnifiedTable'

interface UnifiedVirtualTableProps {
	rows: Array<Row<typeof tableFeaturesConfig, ProtocolTableRow>>
	headerGroups: Array<HeaderGroup<typeof tableFeaturesConfig, ProtocolTableRow>>
	visibleLeafColumns: Array<Column<typeof tableFeaturesConfig, ProtocolTableRow, unknown>>
	totalTableWidth: number
	pageIndex: number
	pageSize: number
	rowSize?: number
	stripedBg?: boolean
	compact?: boolean
}

export function UnifiedVirtualTable({
	rows,
	headerGroups,
	visibleLeafColumns,
	totalTableWidth,
	pageIndex,
	pageSize,
	rowSize = 50,
	stripedBg = false,
	compact = false
}: UnifiedVirtualTableProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const gridTemplateColumns =
		visibleLeafColumns.map((column) => `minmax(${column.getSize()}px, 1fr)`).join(' ') || '1fr'

	const firstColumn = visibleLeafColumns[0]
	const firstColumnId = firstColumn?.id

	const rowVirtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => containerRef.current,
		estimateSize: () => rowSize,
		overscan: 2
	})

	const virtualItems = rowVirtualizer.getVirtualItems()

	useLayoutEffect(() => {
		rowVirtualizer.scrollToOffset(0, { align: 'start' })
	}, [pageIndex, pageSize, rowVirtualizer])

	return (
		<div
			ref={containerRef}
			className="relative isolate min-h-0 w-full flex-1 overflow-auto rounded-md bg-surface"
			style={{ maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}
		>
			<div
				style={{
					position: 'sticky',
					top: 0,
					zIndex: 10,
					display: 'flex',
					flexDirection: 'column',
					background: 'var(--bg-surface)'
				}}
			>
				{headerGroups.map((headerGroup) => {
					const headers = headerGroup.headers
					if (headers.length === 0) {
						return null
					}

					const isGroupRow = headerGroup.depth === 0 && headerGroups.length > 1
					if (isGroupRow) {
						const distinctGroups = headers.filter((h) => !h.isPlaceholder)
						if (distinctGroups.length <= 1) {
							return null
						}
					}

					return (
						<div
							key={headerGroup.id}
							style={{ display: 'grid', gridTemplateColumns, minWidth: `${totalTableWidth}px` }}
						>
							{headers.map((header) => {
								const meta = header.column.columnDef.meta
								const value = <FlexRender header={header} />
								const isSticky = header.column.id === firstColumnId

								return (
									<div
										key={header.id}
										style={{
											gridColumn: `span ${header.colSpan}`,
											position: isSticky ? 'sticky' : undefined,
											left: isSticky ? 0 : undefined,
											zIndex: isSticky ? 10 : undefined,
											background: 'var(--bg-surface)'
										}}
										className={`truncate border-t border-r border-subtle p-3 last:border-r-0 ${
											compact ? 'flex min-h-[50px] items-center border-r-transparent px-5' : ''
										}`}
									>
										{header.column.getCanSort() ? (
											<button
												type="button"
												className={HEADER_CONTENT_STYLES}
												data-align={meta?.align ?? (isGroupRow ? 'center' : 'start')}
												onClick={() => header.column.toggleSorting()}
											>
												{header.isPlaceholder ? null : (
													<HeaderWithTooltip content={meta?.headerHelperText}>{value}</HeaderWithTooltip>
												)}
												{header.isPlaceholder ? null : <SortIcon dir={header.column.getIsSorted()} />}
											</button>
										) : (
											<div
												className={HEADER_CONTENT_STYLES}
												data-align={meta?.align ?? (isGroupRow ? 'center' : 'start')}
											>
												{header.isPlaceholder ? null : (
													<HeaderWithTooltip content={meta?.headerHelperText}>{value}</HeaderWithTooltip>
												)}
											</div>
										)}
									</div>
								)
							})}
						</div>
					)
				})}
			</div>

			<div
				style={{
					height: `${rowVirtualizer.getTotalSize()}px`,
					width: '100%',
					position: 'relative'
				}}
			>
				{virtualItems.map((virtualRow) => {
					const row = rows[virtualRow.index]
					if (!row) return null
					const trStyle: React.CSSProperties = {
						display: 'grid',
						gridTemplateColumns,
						minWidth: `${totalTableWidth}px`,
						position: 'absolute',
						top: 0,
						left: 0,
						width: '100%',
						height: `${virtualRow.size}px`,
						transform: `translateY(${virtualRow.start}px)`
					}

					return (
						<div key={row.id} style={trStyle}>
							{row.getVisibleCells().map((cell) => {
								const textAlign = cell.column.columnDef.meta?.align ?? 'start'
								const isSticky = cell.column.id === firstColumnId
								return (
									<div
										key={cell.id}
										data-lighter={stripedBg && virtualRow.index % 2 === 0}
										className={`truncate border-t border-r border-subtle p-3 ${
											compact ? 'flex items-center border-r-transparent px-5' : ''
										} ${textAlign === 'end' ? 'tabular-nums' : ''}`}
										style={{
											textAlign,
											justifyContent: compact
												? textAlign === 'center'
													? 'center'
													: textAlign === 'end'
														? 'flex-end'
														: 'flex-start'
												: undefined,
											position: isSticky ? 'sticky' : undefined,
											left: isSticky ? 0 : undefined,
											zIndex: isSticky ? 1 : undefined,
											background: isSticky ? 'var(--bg-surface)' : undefined
										}}
									>
										<FlexRender cell={cell} />
									</div>
								)
							})}
						</div>
					)
				})}
			</div>
		</div>
	)
}

const HEADER_CONTENT_STYLES =
	'relative flex w-full flex-nowrap items-center justify-start gap-1 font-medium *:whitespace-nowrap data-[align=center]:justify-center data-[align=end]:justify-end'

interface HeaderWithTooltipProps {
	children: React.ReactNode
	content?: string | undefined
}

function HeaderWithTooltip({ children, content }: HeaderWithTooltipProps) {
	if (!content) return <>{children}</>
	return (
		<Tooltip content={content} className="underline decoration-dotted">
			{children}
		</Tooltip>
	)
}
