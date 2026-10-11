import * as Ariakit from '@ariakit/react'
import type { Ref } from 'react'
import { useCallback, useRef, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Keycap } from '~/ui/Keycap'
import { LoadingSpinner } from '~/ui/Loaders'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { Tag } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import type { ChartConfig } from '../chartConfig'
import type { NotebookCell as NotebookCellType, NotebookCellType as CellType, ResultsView } from '../useSqlTabs'
import type { RegisteredTable } from '../useTableRegistry'
import { ChartCell, type ChartSourceOption } from './ChartCell'
import { MarkdownCell } from './MarkdownCell'
import { SqlCell, type SqlCellHandle } from './SqlCell'

interface NotebookCellProps {
	cell: NotebookCellType
	index: number
	total: number
	focused: boolean
	cellName: string
	loadedTables: Array<RegisteredTable>
	availableChartSources: Array<ChartSourceOption>
	onSourceChange: (next: string) => void
	onRun: () => void
	onCancel: () => void
	onRunAndAdvance: () => void
	onRunAbove: () => void
	onRunBelow: () => void
	onFocus: () => void
	onDelete: () => void
	onMoveUp: () => void
	onMoveDown: () => void
	onConvertType: (nextType: CellType) => void
	onChartConfigChange: (next: ChartConfig | null) => void
	onViewChange: (view: ResultsView) => void
	onDragStart?: (cellId: string, cellEl: HTMLElement | null) => (e: React.DragEvent) => void
	onDragEnd?: () => void
	canRun: boolean
	upstreamDirty: boolean
}

export function NotebookCell({
	cell,
	index,
	total,
	focused,
	cellName,
	loadedTables,
	availableChartSources,
	onSourceChange,
	onRun,
	onCancel,
	onRunAndAdvance,
	onRunAbove,
	onRunBelow,
	onFocus,
	onDelete,
	onMoveUp,
	onMoveDown,
	onConvertType,
	onChartConfigChange,
	onViewChange,
	onDragStart,
	onDragEnd,
	canRun,
	upstreamDirty,
	ref
}: NotebookCellProps & { ref?: Ref<SqlCellHandle> }) {
	const isFirst = index === 0
	const isLast = index === total - 1

	const handleCellFocus = useCallback(() => {
		if (!focused) onFocus()
	}, [focused, onFocus])

	const isMarkdown = cell.type === 'markdown'
	const staleGutter = upstreamDirty && !isMarkdown

	const outerRef = useRef<HTMLDivElement | null>(null)
	const [draggable, setDraggable] = useState(false)

	return (
		// oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- onFocus runs the same handler, so focusing the cell by keyboard already selects it.
		<div
			ref={outerRef}
			onFocus={handleCellFocus}
			onClick={handleCellFocus}
			draggable={draggable}
			onDragStart={
				onDragStart
					? (e) => {
							onDragStart(cell.id, outerRef.current)(e)
						}
					: undefined
			}
			onDragEnd={() => {
				setDraggable(false)
				onDragEnd?.()
			}}
			className={`group relative flex flex-col gap-2 rounded-md border px-3 py-2 transition-colors ${
				focused ? 'border-brand-strong bg-surface ring-1 ring-brand-muted' : 'border-subtle bg-surface'
			}`}
		>
			{staleGutter ? (
				<span
					aria-hidden
					title="Upstream cell was edited — re-run to refresh"
					className="pointer-events-none absolute inset-y-1 left-0 w-0.5 rounded-full bg-warning"
				/>
			) : null}

			<div className="flex flex-wrap items-center gap-2">
				{onDragStart && total > 1 ? (
					// Mouse-only: keyboard readers move cells with Move up and Move down in the cell menu.
					<span
						aria-hidden
						onMouseDown={() => setDraggable(true)}
						onMouseUp={() => setDraggable(false)}
						onMouseLeave={() => setDraggable(false)}
						className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-tertiary opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
					>
						<Icon name="menu" className="size-3" />
					</span>
				) : null}
				<span className="inline-flex items-center gap-1.5 mono-sm text-tertiary">
					<span className="text-secondary">{cellName}</span>
					<Tag>{cell.type === 'sql' ? 'SQL' : cell.type === 'markdown' ? 'MD' : 'Chart'}</Tag>
				</span>
				{cell.running && cell.loadingStage ? (
					<span className="inline-flex items-center gap-1 label-sm text-warning">
						<LoadingSpinner size={10} />
						{cell.loadingStage}…
					</span>
				) : cell.runError ? (
					<span className="inline-flex items-center gap-1 label-sm text-error">
						<Icon name="alert-triangle" className="size-3" />
						error
					</span>
				) : null}

				<div className="ml-auto flex items-center gap-1">
					{cell.type === 'sql' ? (
						cell.running ? (
							// Run and Stop share one slot, so React keeps the same button and its focus when they swap.
							<Button variant="secondary" size="sm" onClick={onCancel}>
								<LoadingSpinner size={14} />
								<svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
									<rect x="6" y="6" width="12" height="12" rx="1" />
								</svg>
								Stop
							</Button>
						) : (
							<Button variant="primary" size="sm" onClick={onRun} disabled={!canRun || !cell.source.trim()}>
								<svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
									<path d="M8 5v14l11-7z" />
								</svg>
								Run
								<span aria-hidden className="flex items-center gap-0.5">
									<Keycap onBrand>⌘</Keycap>
									<Keycap onBrand>↵</Keycap>
								</span>
							</Button>
						)
					) : null}

					<CellMenu
						cellType={cell.type}
						isFirst={isFirst}
						isLast={isLast}
						canDelete={total > 1}
						onRunAbove={onRunAbove}
						onRunBelow={onRunBelow}
						onMoveUp={onMoveUp}
						onMoveDown={onMoveDown}
						onDelete={onDelete}
						onConvertType={onConvertType}
					/>
				</div>
			</div>

			{cell.type === 'sql' ? (
				<SqlCell
					ref={ref}
					cell={cell}
					loadedTables={loadedTables}
					onSourceChange={onSourceChange}
					onRun={onRun}
					onRunAndAdvance={onRunAndAdvance}
					onFocus={onFocus}
					onChartConfigChange={onChartConfigChange}
					onViewChange={onViewChange}
				/>
			) : cell.type === 'chart' ? (
				<ChartCell
					cell={cell}
					availableSources={availableChartSources}
					onSourceChange={onSourceChange}
					onChartConfigChange={onChartConfigChange}
				/>
			) : (
				<MarkdownCell source={cell.source} onChange={onSourceChange} focused={focused} onFocus={onFocus} />
			)}
		</div>
	)
}

function CellMenu({
	cellType,
	isFirst,
	isLast,
	canDelete,
	onRunAbove,
	onRunBelow,
	onMoveUp,
	onMoveDown,
	onDelete,
	onConvertType
}: {
	cellType: CellType
	isFirst: boolean
	isLast: boolean
	canDelete: boolean
	onRunAbove: () => void
	onRunBelow: () => void
	onMoveUp: () => void
	onMoveDown: () => void
	onDelete: () => void
	onConvertType: (next: CellType) => void
}) {
	const otherTypes: Array<CellType> = (['sql', 'markdown', 'chart'] as Array<CellType>).filter((t) => t !== cellType)
	return (
		<Ariakit.MenuProvider>
			<Tooltip
				content="Cell actions"
				render={<Ariakit.MenuButton aria-label="Cell actions" render={<Button variant="ghost" size="sm" square />} />}
			>
				<Icon name="ellipsis" className="size-4" />
			</Tooltip>
			<MenuSurface variant="actions" gutter={4}>
				{cellType === 'sql' ? (
					<>
						<MenuItem disabled={isFirst} onClick={onRunAbove}>
							<Icon name="chevron-up" className="size-3.5 shrink-0 text-tertiary" />
							Run cells above
						</MenuItem>
						<MenuItem disabled={isLast} onClick={onRunBelow}>
							<Icon name="chevron-down" className="size-3.5 shrink-0 text-tertiary" />
							Run cells below
						</MenuItem>
					</>
				) : null}
				<MenuItem
					disabled={isFirst}
					onClick={onMoveUp}
					className={`${cellType === 'sql' ? 'border-t border-subtle' : ''}`}
				>
					<Icon name="arrow-up" className="size-3.5 shrink-0 text-tertiary" />
					Move up
				</MenuItem>
				<MenuItem disabled={isLast} onClick={onMoveDown}>
					<Icon name="arrow-down" className="size-3.5 shrink-0 text-tertiary" />
					Move down
				</MenuItem>
				{otherTypes.map((t, i) => (
					<MenuItem key={t} onClick={() => onConvertType(t)} className={i === 0 ? 'border-t border-subtle' : undefined}>
						<Icon name="repeat" className="size-3.5 shrink-0 text-tertiary" />
						Convert to {t === 'sql' ? 'SQL' : t === 'markdown' ? 'Markdown' : 'Chart'}
					</MenuItem>
				))}
				<MenuItem destructive disabled={!canDelete} onClick={onDelete} className="border-t border-subtle">
					<Icon name="trash-2" className="size-3.5 shrink-0" />
					Delete cell
				</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}
