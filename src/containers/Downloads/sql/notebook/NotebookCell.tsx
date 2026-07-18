import * as Ariakit from '@ariakit/react'
import { forwardRef, useCallback, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import type { ChartConfig } from '../chartConfig'
import { Keycap } from '../primitives'
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
	loadedTables: RegisteredTable[]
	availableChartSources: ChartSourceOption[]
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
	onPreferredViewChange: (view: ResultsView | undefined) => void
	onDragStart?: (cellId: string, cellEl: HTMLElement | null) => (e: React.DragEvent) => void
	onDragEnd?: () => void
	canRun: boolean
	upstreamDirty: boolean
}

export const NotebookCell = forwardRef<SqlCellHandle, NotebookCellProps>(function NotebookCell(
	{
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
		onPreferredViewChange,
		onDragStart,
		onDragEnd,
		canRun,
		upstreamDirty
	},
	ref
) {
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
				focused
					? 'border-brand/50 bg-surface ring-1 ring-brand/20'
					: 'border-subtle bg-surface/60 hover:border-subtle hover:bg-surface'
			}`}
		>
			{staleGutter ? (
				<span
					aria-hidden
					title="Upstream cell was edited — re-run to refresh"
					className="pointer-events-none absolute inset-y-1 left-0 w-0.5 rounded-full bg-pro-premium-300/70"
				/>
			) : null}

			<div className="flex flex-wrap items-center gap-2">
				{onDragStart && total > 1 ? (
					<button
						type="button"
						aria-label="Drag to reorder"
						title="Drag to reorder"
						onMouseDown={() => setDraggable(true)}
						onMouseUp={() => setDraggable(false)}
						onMouseLeave={() => setDraggable(false)}
						className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-pro-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
					>
						<Icon name="menu" className="size-3" />
					</button>
				) : null}
				<span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-pro-text-tertiary">
					<span className="text-pro-text-secondary">{cellName}</span>
					<CellTypeBadge type={cell.type} />
				</span>
				{cell.running && cell.loadingStage ? (
					<span className="inline-flex items-center gap-1 text-[11px] text-pro-premium-300">
						<LoadingSpinner size={10} />
						{cell.loadingStage}
					</span>
				) : cell.runError ? (
					<span className="inline-flex items-center gap-1 text-[11px] text-error">
						<Icon name="alert-triangle" className="size-3" />
						error
					</span>
				) : null}

				<div className="ml-auto flex items-center gap-1">
					{cell.type === 'sql' ? (
						cell.running ? (
							<button
								type="button"
								onClick={onCancel}
								title="Cancel query"
								className="inline-flex items-center gap-1.5 rounded-md border border-error/50 bg-error/10 px-2 py-1 text-[11px] font-medium text-error transition-colors hover:bg-error/20"
							>
								<LoadingSpinner size={10} />
								<svg className="size-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
									<rect x="6" y="6" width="12" height="12" rx="1" />
								</svg>
								Stop
							</button>
						) : (
							<button
								type="button"
								onClick={onRun}
								disabled={!canRun || !cell.source.trim()}
								className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2 py-1 text-[11px] font-medium text-on-brand transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
							>
								<svg className="size-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
									<path d="M8 5v14l11-7z" />
								</svg>
								Run
								<span aria-hidden className="flex items-center gap-0.5">
									<Keycap muted>⌘</Keycap>
									<Keycap muted>↵</Keycap>
								</span>
							</button>
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
					onPreferredViewChange={onPreferredViewChange}
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
})

function CellTypeBadge({ type }: { type: CellType }) {
	const label = type === 'sql' ? 'SQL' : type === 'markdown' ? 'MD' : 'CHART'
	const tone =
		type === 'sql'
			? 'bg-brand/15 text-brand'
			: type === 'markdown'
				? 'bg-pro-ai-300/15 text-pro-ai-300'
				: 'bg-pro-premium-300/15 text-pro-premium-300'
	return (
		<span className={`inline-flex h-[14px] items-center rounded-[3px] px-1 font-mono text-[9px] leading-none ${tone}`}>
			{label}
		</span>
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
	const otherTypes: CellType[] = (['sql', 'markdown', 'chart'] as CellType[]).filter((t) => t !== cellType)
	return (
		<Ariakit.MenuProvider>
			<Ariakit.MenuButton
				className="flex size-6 items-center justify-center rounded-md text-pro-text-tertiary transition-colors hover:bg-hover-row hover:text-pro-text-primary"
				aria-label="Cell actions"
			>
				<Icon name="ellipsis" className="size-3.5" />
			</Ariakit.MenuButton>
			<Ariakit.Menu
				gutter={4}
				className="z-40 min-w-[180px] rounded-lg border border-medium bg-surface-elevated-1 p-1 text-xs text-pro-text-primary shadow-lg"
			>
				{cellType === 'sql' ? (
					<>
						<Ariakit.MenuItem
							disabled={isFirst}
							onClick={onRunAbove}
							className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-40"
						>
							<Icon name="chevron-up" className="size-3 text-pro-text-tertiary" />
							Run cells above
						</Ariakit.MenuItem>
						<Ariakit.MenuItem
							disabled={isLast}
							onClick={onRunBelow}
							className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-40"
						>
							<Icon name="chevron-down" className="size-3 text-pro-text-tertiary" />
							Run cells below
						</Ariakit.MenuItem>
						<div className="my-1 h-px bg-border-subtle" />
					</>
				) : null}
				<Ariakit.MenuItem
					disabled={isFirst}
					onClick={onMoveUp}
					className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-40"
				>
					<Icon name="arrow-up" className="size-3 text-pro-text-tertiary" />
					Move up
				</Ariakit.MenuItem>
				<Ariakit.MenuItem
					disabled={isLast}
					onClick={onMoveDown}
					className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-hover-row disabled:cursor-not-allowed disabled:opacity-40"
				>
					<Icon name="arrow-down" className="size-3 text-pro-text-tertiary" />
					Move down
				</Ariakit.MenuItem>
				<div className="my-1 h-px bg-border-subtle" />
				{otherTypes.map((t) => (
					<Ariakit.MenuItem
						key={t}
						onClick={() => onConvertType(t)}
						className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-hover-row"
					>
						<Icon name="repeat" className="size-3 text-pro-text-tertiary" />
						Convert to {t === 'sql' ? 'SQL' : t === 'markdown' ? 'Markdown' : 'Chart'}
					</Ariakit.MenuItem>
				))}
				<div className="my-1 h-px bg-border-subtle" />
				<Ariakit.MenuItem
					disabled={!canDelete}
					onClick={onDelete}
					className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-error hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<Icon name="trash-2" className="size-3" />
					Delete cell
				</Ariakit.MenuItem>
			</Ariakit.Menu>
		</Ariakit.MenuProvider>
	)
}
