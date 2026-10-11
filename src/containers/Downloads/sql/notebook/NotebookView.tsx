import * as Ariakit from '@ariakit/react'
import { loader } from '@monaco-editor/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { MetaLine } from '~/ui/MetaLine'
import { MenuItem, MenuSurface } from '~/ui/PopoverSurface'
import { Tooltip } from '~/ui/Tooltip'
import type { ChartConfig } from '../chartConfig'
import type { CellVirtualTable, CompletionContext } from '../completions'
import { registerSqlCompletions, registerSqlHovers } from '../completions'
import type { NotebookCellType, QueryTab, ResultsView } from '../useSqlTabs'
import type { RegisteredTable } from '../useTableRegistry'
import type { ChartSourceOption } from './ChartCell'
import { NotebookCell } from './NotebookCell'
import type { SqlCellHandle } from './SqlCell'

interface NotebookViewProps {
	tab: QueryTab
	loadedTables: Array<RegisteredTable>
	canRun: boolean
	onCellSourceChange: (cellId: string, source: string) => void
	onCellFocus: (cellId: string) => void
	onCellChartConfig: (cellId: string, config: ChartConfig | null) => void
	onCellViewChange: (cellId: string, view: ResultsView) => void
	onRunCell: (cellId: string) => Promise<void> | void
	onCancelCell: (cellId: string) => void
	onRunCellAndAdvance: (cellId: string) => Promise<void> | void
	onRunAbove: (cellId: string) => Promise<void> | void
	onRunBelow: (cellId: string) => Promise<void> | void
	onRunAll: () => Promise<void> | void
	onAddCell: (type: 'sql' | 'markdown' | 'chart', atIndex: number) => void
	onDeleteCell: (cellId: string) => void
	onMoveCell: (cellId: string, direction: 'up' | 'down') => void
	onReorderCell: (fromIdx: number, toIdx: number) => void
	onConvertCellType: (cellId: string, nextType: 'sql' | 'markdown' | 'chart') => void
	onDismissCellsDirty: () => void
}

const EMPTY_NOTEBOOK_CELLS: QueryTab['cells'] = []

// The stale banner leaves once its cells re-run or it is dismissed; Run all in the header above takes focus.
const focusRunAllOnLeave = passFocusOnLeave((banner) => banner.previousElementSibling?.querySelector('button'))

export function NotebookView({
	tab,
	loadedTables,
	canRun,
	onCellSourceChange,
	onCellFocus,
	onCellChartConfig,
	onCellViewChange,
	onRunCell,
	onCancelCell,
	onRunCellAndAdvance,
	onRunAbove,
	onRunBelow,
	onRunAll,
	onAddCell,
	onDeleteCell,
	onMoveCell,
	onReorderCell,
	onConvertCellType,
	onDismissCellsDirty
}: NotebookViewProps) {
	const cells = tab.cells ?? EMPTY_NOTEBOOK_CELLS
	const activeCellId = tab.activeCellId

	const cellRefs = useRef(new Map<string, SqlCellHandle | null>())

	const cellTables = useMemo<Array<CellVirtualTable>>(() => {
		const out: Array<CellVirtualTable> = []
		for (const [i, cell] of cells.entries()) {
			if (cell.type !== 'sql') continue
			const name = `cell_${i + 1}`
			const cols = cell.result?.columns ?? []
			out.push({
				name,
				columns: cols.map((c) => ({ name: c.name, type: c.type as string | undefined })),
				rowCount: cell.result?.rows.length ?? 0,
				hasRun: !!cell.result
			})
		}
		return out
	}, [cells])

	const contextRef = useRef<CompletionContext>({ tables: loadedTables, cellTables })
	useEffect(() => {
		contextRef.current = { tables: loadedTables, cellTables }
	}, [loadedTables, cellTables])

	useEffect(() => {
		let canceled = false
		let completionsDisposable: { dispose: () => void } | null = null
		let hoversDisposable: { dispose: () => void } | null = null
		loader.init().then((monaco) => {
			if (canceled) return
			completionsDisposable = registerSqlCompletions(monaco, contextRef)
			hoversDisposable = registerSqlHovers(monaco, contextRef)
		})
		return () => {
			canceled = true
			completionsDisposable?.dispose()
			hoversDisposable?.dispose()
		}
	}, [])

	const runningAny = cells.some((c) => c.running)
	const runnableSqlCount = cells.filter((c) => c.type === 'sql' && c.source.trim().length > 0).length
	const chartCount = cells.filter((c) => c.type === 'chart').length
	const hasRunnableSql = runnableSqlCount > 0
	const hasRunAny = cells.some((c) => c.type === 'sql' && (c.result != null || c.lastRun != null))
	const promoteRunAll = hasRunnableSql && !hasRunAny
	const cellNames = useMemo(() => {
		const names: Record<string, string> = {}
		for (const [i, c] of cells.entries()) names[c.id] = `cell_${i + 1}`
		return names
	}, [cells])

	const chartSourcesByCellId = useMemo(() => {
		const out: Record<string, Array<ChartSourceOption>> = {}
		const allSources: Array<ChartSourceOption> = cells
			.map((c, i) => {
				if (c.type !== 'sql') return null
				return {
					name: `cell_${i + 1}`,
					cellId: c.id,
					hasRun: !!c.result,
					result: c.result
				}
			})
			.filter((s): s is ChartSourceOption => s !== null)
		for (const c of cells) {
			if (c.type === 'chart') {
				const selfIdx = cells.findIndex((x) => x.id === c.id)
				out[c.id] = allSources.filter((s) => cells.findIndex((x) => x.id === s.cellId) < selfIdx)
			} else {
				out[c.id] = []
			}
		}
		return out
	}, [cells])

	const upstreamDirtyByCellId = useMemo(() => {
		const out: Record<string, boolean> = {}
		let seenDirty = false
		for (const cell of cells) {
			out[cell.id] = cell.type === 'markdown' ? false : seenDirty
			if (cell.type === 'sql' && cell.dirty && cell.source.trim()) seenDirty = true
		}
		return out
	}, [cells])

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null
			const editable =
				target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
			if (!activeCellId) return

			// Alt+Up/Down: focus previous / next cell
			if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				if (editable && !target?.closest('.monaco-editor')) return
				const idx = cells.findIndex((c) => c.id === activeCellId)
				if (idx === -1) return
				const nextIdx = e.key === 'ArrowDown' ? Math.min(idx + 1, cells.length - 1) : Math.max(idx - 1, 0)
				if (nextIdx === idx) return
				e.preventDefault()
				const nextCell = cells[nextIdx]
				onCellFocus(nextCell.id)
				requestAnimationFrame(() => {
					cellRefs.current.get(nextCell.id)?.focus()
				})
				return
			}

			// Cmd+Alt+Up/Down: reorder cell up/down
			if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				const idx = cells.findIndex((c) => c.id === activeCellId)
				if (idx === -1) return
				if (e.key === 'ArrowUp' && idx === 0) return
				if (e.key === 'ArrowDown' && idx === cells.length - 1) return
				e.preventDefault()
				onMoveCell(activeCellId, e.key === 'ArrowUp' ? 'up' : 'down')
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [activeCellId, cells, onCellFocus, onMoveCell])

	const setCellRef = useCallback(
		(cellId: string) => (handle: SqlCellHandle | null) => {
			if (handle) cellRefs.current.set(cellId, handle)
			else cellRefs.current.delete(cellId)
		},
		[]
	)

	const [dragState, setDragState] = useState<{ fromId: string; overId: string | null; before: boolean } | null>(null)

	const handleDragStart = useCallback(
		(cellId: string, cellEl: HTMLElement | null) => (e: React.DragEvent) => {
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', cellId)
			if (cellEl) {
				const rect = cellEl.getBoundingClientRect()
				e.dataTransfer.setDragImage(cellEl, Math.min(40, rect.width / 2), Math.min(20, rect.height / 2))
			}
			setDragState({ fromId: cellId, overId: null, before: false })
		},
		[]
	)

	const handleDragEnd = useCallback(() => setDragState(null), [])

	const handleDropOnCell = useCallback(
		(cellId: string) => (e: React.DragEvent) => {
			if (!dragState) return
			e.preventDefault()
			const fromIdx = cells.findIndex((c) => c.id === dragState.fromId)
			let toIdx = cells.findIndex((c) => c.id === cellId)
			if (fromIdx === -1 || toIdx === -1) {
				setDragState(null)
				return
			}
			if (!dragState.before) toIdx += 1
			if (toIdx > fromIdx) toIdx -= 1
			if (toIdx !== fromIdx) onReorderCell(fromIdx, toIdx)
			setDragState(null)
		},
		[cells, dragState, onReorderCell]
	)

	const handleDragOverCell = useCallback(
		(cellId: string) => (e: React.DragEvent) => {
			if (!dragState || dragState.fromId === cellId) return
			e.preventDefault()
			e.dataTransfer.dropEffect = 'move'
			const rect = e.currentTarget.getBoundingClientRect()
			const before = e.clientY < rect.top + rect.height / 2
			setDragState((prev) =>
				prev && (prev.overId !== cellId || prev.before !== before) ? { ...prev, overId: cellId, before } : prev
			)
		},
		[dragState]
	)

	const runAll = () => {
		toast.promise(Promise.resolve(onRunAll()), {
			loading: 'Running notebook…',
			success: 'Notebook done',
			error: 'Notebook stopped on error'
		})
	}

	const firstStaleIdx = useMemo(
		() => cells.findIndex((c) => upstreamDirtyByCellId[c.id]),
		[cells, upstreamDirtyByCellId]
	)
	const firstStaleName = firstStaleIdx >= 0 ? cellNames[cells[firstStaleIdx].id] : null

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-baseline gap-2">
					<h3 className="title-md tracking-tight text-primary">{tab.title}</h3>
					<MetaLine className="tabular-nums">
						{`${cells.length} cell${cells.length === 1 ? '' : 's'}`}
						{hasRunnableSql ? `${runnableSqlCount} SQL` : null}
						{chartCount > 0 ? `${chartCount} chart${chartCount === 1 ? '' : 's'}` : null}
					</MetaLine>
				</div>
				<div className="flex items-center gap-2">
					{promoteRunAll && hasRunnableSql ? (
						<span className="hidden body-sm text-tertiary sm:inline">
							Not yet run — <span className="text-secondary tabular-nums">{runnableSqlCount}</span>{' '}
							{runnableSqlCount === 1 ? 'query' : 'queries'}
							{chartCount > 0 ? (
								<>
									, <span className="text-secondary tabular-nums">{chartCount}</span>{' '}
									{chartCount === 1 ? 'chart' : 'charts'}
								</>
							) : null}
						</span>
					) : null}
					<Button
						variant={promoteRunAll ? 'primary' : 'secondary'}
						size="md"
						onClick={runAll}
						disabled={!canRun || !hasRunnableSql}
						pendingLabel="Running…"
						pending={runningAny}
					>
						<Icon name="play" className="size-3.5 fill-current" aria-hidden />
						{promoteRunAll ? 'Run notebook' : 'Run all'}
					</Button>
				</div>
			</div>

			{tab.cellsDirty || firstStaleName ? (
				<div
					ref={focusRunAllOnLeave}
					className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-muted bg-warning-faint px-3 py-1.5 body-sm text-warning"
				>
					<span className="inline-flex items-center gap-1.5">
						<Icon name="alert-triangle" className="size-3.5" />
						{tab.cellsDirty
							? 'Cell order changed — downstream results may be stale.'
							: firstStaleName
								? `Upstream edits — re-run from ${firstStaleName} to refresh downstream.`
								: null}
					</span>
					<div className="flex items-center gap-1">
						{firstStaleName && !tab.cellsDirty ? (
							<Button
								variant="outline"
								size="sm"
								onClick={runAll}
								disabled={!canRun}
								pendingLabel="Running…"
								pending={runningAny}
							>
								Re-run all
							</Button>
						) : null}
						<Tooltip
							content="Dismiss"
							render={<Button variant="ghost" size="sm" square onClick={onDismissCellsDirty} aria-label="Dismiss" />}
						>
							<Icon name="x" className="size-4" />
						</Tooltip>
					</div>
				</div>
			) : null}

			<div className="flex flex-col gap-0">
				{cells.map((cell, idx) => {
					const isDragSrc = dragState?.fromId === cell.id
					const isDropTarget = dragState?.overId === cell.id && dragState.fromId !== cell.id
					return (
						<div
							key={cell.id}
							onDragOver={handleDragOverCell(cell.id)}
							onDrop={handleDropOnCell(cell.id)}
							className={`relative flex flex-col gap-0 ${isDragSrc ? 'opacity-40' : ''}`}
						>
							{isDropTarget && dragState?.before ? <DropIndicator position="top" /> : null}
							<NotebookCell
								ref={setCellRef(cell.id)}
								cell={cell}
								index={idx}
								total={cells.length}
								focused={cell.id === activeCellId}
								cellName={cellNames[cell.id]}
								canRun={canRun}
								loadedTables={loadedTables}
								upstreamDirty={upstreamDirtyByCellId[cell.id]}
								availableChartSources={chartSourcesByCellId[cell.id] ?? []}
								onSourceChange={(next) => onCellSourceChange(cell.id, next)}
								onRun={() => onRunCell(cell.id)}
								onCancel={() => onCancelCell(cell.id)}
								onRunAndAdvance={() => onRunCellAndAdvance(cell.id)}
								onRunAbove={() => onRunAbove(cell.id)}
								onRunBelow={() => onRunBelow(cell.id)}
								onFocus={() => onCellFocus(cell.id)}
								onDelete={() => onDeleteCell(cell.id)}
								onMoveUp={() => onMoveCell(cell.id, 'up')}
								onMoveDown={() => onMoveCell(cell.id, 'down')}
								onConvertType={(nextType) => onConvertCellType(cell.id, nextType)}
								onChartConfigChange={(next) => onCellChartConfig(cell.id, next)}
								onViewChange={(view) => onCellViewChange(cell.id, view)}
								onDragStart={handleDragStart}
								onDragEnd={handleDragEnd}
							/>
							{isDropTarget && !dragState?.before ? <DropIndicator position="bottom" /> : null}
							<AddCellBar
								onAdd={(type) => onAddCell(type, idx + 1)}
								variant={idx === cells.length - 1 ? 'end' : 'between'}
							/>
						</div>
					)
				})}
			</div>
		</div>
	)
}

function DropIndicator({ position }: { position: 'top' | 'bottom' }) {
	return (
		<span
			aria-hidden
			className={`pointer-events-none absolute inset-x-0 z-10 flex h-0 items-center ${
				position === 'top' ? '-top-0.5' : '-bottom-0.5'
			}`}
		>
			<span className="h-0.5 w-full rounded-full bg-brand" />
		</span>
	)
}

function AddCellBar({
	onAdd,
	variant = 'between'
}: {
	onAdd: (type: NotebookCellType) => void
	variant?: 'between' | 'end'
}) {
	if (variant === 'end') {
		return (
			<div className="flex items-center justify-center py-2">
				<AddMenu onAdd={onAdd} variant="end" />
			</div>
		)
	}
	return (
		<div className="group/rail relative flex items-center justify-center py-1">
			<span
				aria-hidden
				className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-transparent transition-colors group-focus-within/rail:bg-border-subtle group-hover/rail:bg-border-subtle"
			/>
			<AddMenu onAdd={onAdd} variant="between" />
		</div>
	)
}

function AddMenu({ onAdd, variant }: { onAdd: (type: NotebookCellType) => void; variant: 'between' | 'end' }) {
	return (
		<Ariakit.MenuProvider>
			{variant === 'end' ? (
				<Ariakit.MenuButton render={<Button size="sm" />}>
					<Icon name="plus" className="size-3.5" />
					Add cell
				</Ariakit.MenuButton>
			) : (
				// Revealed with the divider line on hover or focus, and kept while its menu is open.
				<Tooltip
					content="Add cell"
					render={
						<Ariakit.MenuButton
							aria-label="Add cell"
							render={<Button variant="overlay" size="sm" square className="relative z-10 aria-expanded:opacity-100" />}
						/>
					}
				>
					<Icon name="plus" className="size-4" />
				</Tooltip>
			)}
			<MenuSurface variant="actions" gutter={4}>
				<AddMenuItem onClick={() => onAdd('sql')} label="SQL" hint="Query" tone="primary" />
				<AddMenuItem onClick={() => onAdd('chart')} label="Chart" hint="Visualize" tone="gold" />
				<AddMenuItem onClick={() => onAdd('markdown')} label="Markdown" hint="Narrate" tone="purple" />
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

function AddMenuItem({
	onClick,
	label,
	hint,
	tone
}: {
	onClick: () => void
	label: string
	hint: string
	tone: 'primary' | 'gold' | 'purple'
}) {
	const dot = tone === 'primary' ? 'bg-brand' : tone === 'gold' ? 'bg-warning' : 'bg-pro-ai'
	return (
		<MenuItem onClick={onClick}>
			<span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
			<span className="flex-1 font-medium">{label}</span>
			<span className="body-xs text-tertiary">{hint}</span>
		</MenuItem>
	)
}
