import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { useRecentDownloads, useSavedDownloads } from '~/contexts/LocalStorage'
import { getStorageJSON, setStorageJSON } from '~/contexts/localStorageStore'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Keycap } from '~/ui/Keycap'
import { BusyGlyph, EmptyState, PanelLoadingStatus, InlineStatus } from '~/ui/Status'
import { StatusDot } from '~/ui/StatusBadge'
import { Tabs, TabPanel, UnderlineTabList } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber } from '~/utils/numberFormat'
import type { ChartOptionsMap } from '../chart-datasets'
import { chartDatasets } from '../chart-datasets'
import { datasets } from '../datasets'
import { DeletePresetDialog, RenamePresetDialog, SavePresetDialog } from '../PresetDialogs'
import {
	extractQueryConfig,
	generatePresetId,
	type QuerySavedConfig,
	type QueryTableRef,
	type SavedDownload
} from '../savedDownloads'
import { decodeDownloadConfig, decodeNotebookShare } from '../urlState'
import type { ChartConfig } from './chartConfig'
import { queryDuckDB } from './duckdb/query'
import { Editor, type EditorHandle } from './Editor'
import { ErrorBanner, replaceIdentifier } from './ErrorBanner'
import type { ExampleQuery } from './examples'
import { ExamplesPanel } from './ExamplesPanel'
import { runSql } from './executor'
import { formatSqlDuration } from './format'
import { NotebookView } from './notebook/NotebookView'
import { QueryTabBar } from './QueryTabBar'
import { ResultsPanel } from './ResultsPanel'
import { SchemaDrawer } from './SchemaDrawer'
import { ShareQueryButton } from './ShareQueryButton'
import { sqlWorkspaceAccess } from './sqlAccess'
import { TableChipRail } from './TableChipRail'
import { UpsellGate } from './UpsellGate'
import { useDuckDB } from './useDuckDB'
import { useSqlTabs, type LastRunMeta, type NotebookCell, type QueryTab } from './useSqlTabs'
import {
	prettyLabelForSource,
	tableNameFor,
	useTableRegistry,
	type RegisteredTable,
	type TableSource
} from './useTableRegistry'

const SQL_TABS = ['editor', 'saved'] as const
type SqlTab = (typeof SQL_TABS)[number]

const TOTAL_SCHEMA_COUNT = datasets.length + chartDatasets.length
const PLAYBOOK_COLLAPSED_KEY = 'sql-studio:playbook-collapsed:v1'

interface SqlWorkspaceProps {
	chartOptionsMap: ChartOptionsMap
}

type PlanStep = { key: string; source: TableSource; name: string; label: string }
type PlanOutcome = { kind: 'loaded' } | { kind: 'superseded' } | { kind: 'failed'; step: PlanStep }

// The loop lives out here because the compiler cannot lower any loop inside a try. Its early exits
// become an outcome, since a helper cannot return from its caller.
async function loadPlannedTables({
	plan,
	signal,
	isCurrent,
	load,
	markLoading,
	markLoaded
}: {
	plan: Array<PlanStep>
	signal: AbortSignal
	isCurrent: () => boolean
	load: (source: TableSource, signal: AbortSignal) => Promise<unknown>
	markLoading: (step: PlanStep, stage: string) => void
	markLoaded: (step: PlanStep) => void
}): Promise<PlanOutcome> {
	for (let index = 0; index < plan.length; index++) {
		const step = plan[index]
		throwIfAborted(signal)
		if (!isCurrent()) return { kind: 'superseded' }
		const position = plan.length > 1 ? ` · ${index + 1}/${plan.length}` : ''
		markLoading(step, `Loading ${step.label}${position}`)
		const loaded = await load(step.source, signal)
		throwIfAborted(signal)
		if (!isCurrent()) return { kind: 'superseded' }
		if (!loaded) return { kind: 'failed', step }
		markLoaded(step)
	}
	return { kind: 'loaded' }
}

type RunHandle = {
	signal: AbortSignal
	owns: () => boolean
	mayFinish: () => boolean
	release: () => void
}

// Re-checked after every await, and a logical test cannot be lowered inside a try either.
function runIsLive(run: RunHandle) {
	return run.owns() && !run.signal.aborted
}

// Both are value blocks, which the compiler cannot lower inside the catch that reports a failed run.
function wasRunAborted(error: unknown, signal: AbortSignal) {
	return isAbortError(error) || signal.aborted
}

export function SqlWorkspace({ chartOptionsMap }: SqlWorkspaceProps) {
	const { isAuthenticated, isTrial, loaders, authorizedFetch, user } = useAuthContext()
	const { subscription, isSubscriptionLoading, isSubscriptionError, isSubscriptionRetrying, refetchSubscription } =
		useSubscribe()
	const access = sqlWorkspaceAccess({
		userLoading: loaders.userLoading,
		isAuthenticated,
		subscriptionLoading: isSubscriptionLoading,
		subscriptionError: isSubscriptionError,
		isApiPlan: subscription.type === 'api' && subscription.status === 'active',
		isLlama: !!user?.flags?.is_llama
	})

	if (access === 'loading') {
		return <PanelLoadingStatus label="Loading SQL Studio" />
	}

	if (access === 'unknown') {
		return (
			<div className="mx-auto w-full max-w-xl py-16">
				<InlineStatus variant="error" retry={{ refetch: refetchSubscription, isFetching: isSubscriptionRetrying }}>
					Couldn&apos;t load your subscription.
				</InlineStatus>
			</div>
		)
	}

	if (access === 'upsell') {
		return <UpsellGate isAuthenticated={isAuthenticated} isTrial={isTrial} />
	}

	return <SqlWorkspaceInner chartOptionsMap={chartOptionsMap} authorizedFetch={authorizedFetch} />
}

function SqlWorkspaceInner({
	chartOptionsMap,
	authorizedFetch
}: {
	chartOptionsMap: ChartOptionsMap
	authorizedFetch: ReturnType<typeof useAuthContext>['authorizedFetch']
}) {
	const duckdb = useDuckDB()
	const registry = useTableRegistry({ conn: duckdb.conn ?? null, authorizedFetch })
	const { savedDownloads, saveDownload, deleteDownload, renameDownload } = useSavedDownloads()
	const { recordRecent } = useRecentDownloads()

	const [sectionTab, setSectionTab] = useState<SqlTab>('editor')
	const [schemaDrawerOpen, setSchemaDrawerOpen] = useState(false)
	const [schemaParams, setSchemaParams] = useState<Record<string, string>>({})
	const [savePresetOpen, setSavePresetOpen] = useState(false)
	const [playbookCollapsed, setPlaybookCollapsed] = useState<boolean>(() =>
		getStorageJSON<boolean>(PLAYBOOK_COLLAPSED_KEY, false)
	)
	const togglePlaybook = useCallback(() => {
		setPlaybookCollapsed((prev) => {
			const next = !prev
			setStorageJSON(PLAYBOOK_COLLAPSED_KEY, next)
			return next
		})
	}, [])

	const {
		tabs,
		activeTab,
		activeTabId,
		openTab,
		openNotebookTab,
		closeTab,
		focusTab,
		focusByIndex,
		focusDelta,
		duplicateTab,
		closeOthers,
		closeToRight,
		renameTab,
		updateTab,
		updateActiveTab,
		setActiveSql,
		setActiveChartConfig,
		convertTabToNotebook,
		updateCell,
		addCell,
		removeCell,
		reorderCells,
		focusCell,
		setCellsDirty
	} = useSqlTabs()

	const editorRef = useRef<EditorHandle | null>(null)
	const runControllersRef = useRef(new Map<string, AbortController>())

	// Starting a run hands back the only thing allowed to write for it. Ownership used to be re-derived
	// at every await with a bare map lookup, which meant each new await was a chance to forget one.
	const beginRun = useCallback((key: string): RunHandle => {
		runControllersRef.current.get(key)?.abort()
		const controller = new AbortController()
		runControllersRef.current.set(key, controller)
		const owns = () => runControllersRef.current.get(key) === controller
		return {
			signal: controller.signal,
			owns,
			// Terminal cleanup also runs once nobody owns the key, which is the state a cancel leaves behind.
			mayFinish: () => {
				const current = runControllersRef.current.get(key)
				return current === controller || current === undefined
			},
			release: () => {
				if (owns()) runControllersRef.current.delete(key)
			}
		}
	}, [])

	const cancelRun = useCallback((key: string) => runControllersRef.current.get(key)?.abort(), [])

	const cancelTabRun = useCallback(
		(tabId: string) => {
			cancelRun(`tab:${tabId}`)
			updateTab(tabId, {
				runError: null,
				running: false,
				loadingStage: null,
				busyTaskId: null,
				pendingTables: []
			})
		},
		[cancelRun, updateTab]
	)

	const cancelCellRun = useCallback(
		(tabId: string, cellId: string) => {
			cancelRun(`cell:${cellId}`)
			updateCell(tabId, cellId, {
				runError: null,
				running: false,
				loadingStage: null,
				pendingTables: []
			})
		},
		[cancelRun, updateCell]
	)

	useEffect(() => {
		const map = runControllersRef.current
		return () => {
			for (const c of map.values()) c.abort()
			map.clear()
		}
	}, [])

	const savedQueries = useMemo(
		() => savedDownloads.filter((d): d is QuerySavedConfig => d.kind === 'query'),
		[savedDownloads]
	)

	const tableRefs = useMemo(
		() =>
			registry.tables.map((t) =>
				t.source.kind === 'dataset'
					? { kind: 'dataset' as const, slug: t.source.slug }
					: { kind: 'chart' as const, slug: t.source.slug, param: t.source.param, paramLabel: t.source.paramLabel }
			),
		[registry.tables]
	)

	const runSqlForTab = useCallback(
		async (tabId: string, rawSql: string, existingRun?: RunHandle): Promise<boolean> => {
			if (!duckdb.conn) return false
			const trimmed = rawSql.trim()
			if (!trimmed) return false
			const runKey = `tab:${tabId}`
			const run = existingRun ?? beginRun(runKey)
			// Every write for this run goes through here, so a superseded one cannot reach the tab at all.
			const writeTab = (update: Parameters<typeof updateTab>[1]) => {
				if (run.owns()) updateTab(tabId, update)
			}
			updateTab(tabId, { running: true, runError: null, loadingStage: null, pendingTables: [] })
			const res = await runSql(
				{
					conn: duckdb.conn,
					loadedTables: registry.tables,
					loadSource: registry.load,
					chartOptionsMap
				},
				trimmed,
				{
					onPendingChange: (pending) => writeTab({ pendingTables: pending }),
					onLoadingStage: (stage) => writeTab({ loadingStage: stage })
				},
				undefined,
				run.signal
			)
			if (!run.owns()) return false
			run.release()
			if (!res.ok) {
				const errRes = res as Extract<typeof res, { ok: false }>
				updateTab(tabId, {
					runError: errRes.canceled ? null : errRes.error,
					result: null,
					running: false,
					loadingStage: null
				})
				scheduleTabPendingClear(updateTab, tabId)
				return false
			}
			const okRes = res as Extract<typeof res, { ok: true }>
			updateTab(tabId, {
				result: okRes.result,
				lastRun: {
					durationMs: okRes.durationMs,
					rows: okRes.result.rows.length,
					cols: okRes.result.columns.length,
					at: Date.now()
				},
				dirty: false,
				runError: null,
				running: false,
				loadingStage: null
			})
			const preset: QuerySavedConfig = {
				id: generatePresetId(),
				name: firstNonEmptyLine(trimmed).slice(0, 80),
				createdAt: Date.now(),
				lastRunAt: Date.now(),
				...extractQueryConfig({
					sql: trimmed,
					tables: registry.tables.map((t) =>
						t.source.kind === 'dataset'
							? { kind: 'dataset', slug: t.source.slug }
							: { kind: 'chart', slug: t.source.slug, param: t.source.param, paramLabel: t.source.paramLabel }
					)
				})
			}
			recordRecent(preset)
			return true
		},
		[duckdb.conn, registry, recordRecent, chartOptionsMap, updateTab, beginRun]
	)

	const runQuery = useCallback(() => {
		const selection = editorRef.current?.getSelection() ?? null
		const stmtAtCursor = selection ? null : (editorRef.current?.getStatementAtCursor() ?? null)
		const sqlToRun = selection ?? stmtAtCursor ?? activeTab.sql
		return runSqlForTab(activeTabId, sqlToRun)
	}, [runSqlForTab, activeTabId, activeTab.sql])

	const prepareAndRun = useCallback(
		async ({
			tabId,
			taskId,
			tables: nextTables,
			sql: nextSql
		}: {
			tabId: string
			taskId: string
			tables: Array<TableSource>
			sql: string
		}) => {
			const runKey = `tab:${tabId}`
			const run = beginRun(runKey)
			// Every write for this run goes through here, so a superseded one cannot reach the tab at all.
			const writeTab = (update: Parameters<typeof updateTab>[1]) => {
				if (run.owns()) updateTab(tabId, update)
			}
			// The run that takes over sets no busyTaskId of its own, so every exit that has lost ownership
			// releases this one's, or the example that started it stays busy and the Playbook stays
			// disabled. Guarded by the id, so a newer preparation -- which does set one -- keeps it.
			const releaseBusyTask = () => {
				updateTab(tabId, (t) => (t.busyTaskId === taskId ? { busyTaskId: null } : {}))
			}
			const finishRun = () => {
				if (!run.mayFinish()) return false
				run.release()
				updateTab(tabId, { loadingStage: null, busyTaskId: null, running: false })
				return true
			}
			updateTab(tabId, {
				busyTaskId: taskId,
				running: true,
				runError: null,
				result: null,
				loadingStage: null,
				pendingTables: [],
				sql: nextSql,
				dirty: true
			})
			setSectionTab('editor')
			try {
				const plan = nextTables
					.filter((t) => !registry.tables.some((r) => sameSource(r.source, t)))
					.map((t, index) => ({
						key: `apply-${taskId}-${index}`,
						source: t,
						name: tableNameFor(t),
						label: prettyLabelForSource(t)
					}))

				if (plan.length > 0) {
					updateTab(tabId, {
						pendingTables: plan.map((p) => ({ key: p.key, name: p.name, label: p.label, status: 'pending' }))
					})
				}

				const outcome = await loadPlannedTables({
					plan,
					signal: run.signal,
					isCurrent: run.owns,
					load: registry.load,
					markLoading: (step, stage) => {
						writeTab((t) => ({
							pendingTables: t.pendingTables.map((p) => (p.key === step.key ? { ...p, status: 'loading' } : p))
						}))
						writeTab({ loadingStage: stage })
					},
					markLoaded: (step) => {
						writeTab((t) => ({ pendingTables: t.pendingTables.filter((p) => p.key !== step.key) }))
					}
				})
				// The outcome describes the moment the helper returned. Awaiting it hands control back, so a
				// newer run or a Stop can land before this resumes; in the loop these checks and the tab
				// updates below sat in one synchronous block and could not be separated.
				if (!runIsLive(run)) {
					releaseBusyTask()
					return
				}
				if (outcome.kind === 'superseded') {
					releaseBusyTask()
					return
				}
				if (outcome.kind === 'failed') {
					writeTab((t) => ({
						pendingTables: t.pendingTables.map((p) => (p.key === outcome.step.key ? { ...p, status: 'failed' } : p))
					}))
					writeTab({
						runError: `Could not load ${outcome.step.label}.`,
						result: null,
						running: false,
						loadingStage: null
					})
					scheduleTabPendingClear(updateTab, tabId)
					finishRun()
					return
				}
				updateTab(tabId, { loadingStage: null })
				await runSqlForTab(tabId, nextSql, run)
				finishRun()
			} catch (error) {
				if (!run.owns()) {
					releaseBusyTask()
					return
				}
				if (wasRunAborted(error, run.signal)) {
					updateTab(tabId, {
						runError: null,
						result: null,
						running: false,
						loadingStage: null,
						pendingTables: []
					})
					finishRun()
					return
				}
				updateTab(tabId, {
					// Table loads and the query report their own failures, so only an unexpected exception lands here.
					runError: "Couldn't run this query.",
					result: null,
					running: false
				})
				scheduleTabPendingClear(updateTab, tabId)
				finishRun()
			}
		},
		[registry, runSqlForTab, updateTab, beginRun]
	)

	// --- Notebook cell execution ---

	const cellViewNames = useCallback((cells: Array<NotebookCell>): Set<string> => {
		const set = new Set<string>()
		for (let i = 0; i < cells.length; i++) set.add(`cell_${i + 1}`)
		return set
	}, [])

	const runSqlForCell = useCallback(
		async (tabId: string, cellId: string): Promise<boolean> => {
			if (!duckdb.conn) return false
			const tab = tabs.find((t) => t.id === tabId)
			if (!tab || tab.mode !== 'notebook' || !tab.cells) return false
			const cellIdx = tab.cells.findIndex((c) => c.id === cellId)
			if (cellIdx === -1) return false
			const cell = tab.cells[cellIdx]
			if (cell.type !== 'sql') return false
			const trimmed = cell.source.trim()
			if (!trimmed) return false

			const cellName = `cell_${cellIdx + 1}`
			const skipSet = cellViewNames(tab.cells)
			const runKey = `cell:${cellId}`
			const run = beginRun(runKey)
			// Every write for this cell's run goes through here, for the same reason as the tab's.
			const writeCell = (update: Parameters<typeof updateCell>[2]) => {
				if (run.owns()) updateCell(tabId, cellId, update)
			}

			updateCell(tabId, cellId, {
				running: true,
				runError: null,
				pendingTables: [],
				loadingStage: null
			})

			const res = await runSql(
				{
					conn: duckdb.conn,
					loadedTables: registry.tables,
					loadSource: registry.load,
					chartOptionsMap
				},
				trimmed,
				{
					onPendingChange: (pending) => writeCell({ pendingTables: pending }),
					onLoadingStage: (stage) => writeCell({ loadingStage: stage })
				},
				skipSet,
				run.signal
			)
			if (!run.owns()) return false

			if (res.ok) {
				const okRes = res as Extract<typeof res, { ok: true }>
				// Register output as a view for downstream cells.
				try {
					const viewSql = trimmed.replace(/;\s*$/g, '').trim()
					await queryDuckDB(duckdb.conn, `CREATE OR REPLACE VIEW "${cellName}" AS (${viewSql})`, run.signal)
				} catch (error) {
					console.warn(`Failed to create view ${cellName}:`, error)
				}
				if (!run.owns()) return false
				if (run.signal.aborted) {
					run.release()
					updateCell(tabId, cellId, {
						result: null,
						runError: null,
						running: false,
						loadingStage: null,
						pendingTables: []
					})
					return false
				}
				run.release()
				updateCell(tabId, cellId, {
					result: okRes.result,
					lastRun: {
						durationMs: okRes.durationMs,
						rows: okRes.result.rows.length,
						cols: okRes.result.columns.length,
						at: Date.now()
					},
					dirty: false,
					runError: null,
					running: false,
					loadingStage: null,
					pendingTables: []
				})
				return true
			}
			const errRes = res as Extract<typeof res, { ok: false }>
			run.release()
			updateCell(tabId, cellId, {
				result: null,
				runError: errRes.canceled ? null : errRes.error,
				running: false,
				loadingStage: null
			})
			return false
		},
		[tabs, duckdb.conn, registry, chartOptionsMap, updateCell, cellViewNames, beginRun]
	)

	const runCellsSequential = useCallback(
		async (tabId: string, cellIds: Array<string>) => {
			for (const id of cellIds) {
				const ok = await runSqlForCell(tabId, id)
				if (!ok) break
			}
		},
		[runSqlForCell]
	)

	const runAllCellsInTab = useCallback(
		async (tabId: string) => {
			const tab = tabs.find((t) => t.id === tabId)
			if (!tab || tab.mode !== 'notebook' || !tab.cells) return
			const sqlCellIds = tab.cells.filter((c) => c.type === 'sql' && c.source.trim()).map((c) => c.id)
			if (sqlCellIds.length === 0) return
			// Clean up stale views so numbering is fresh.
			if (duckdb.conn) {
				const maxViews = Math.max(tab.cells.length + 4, 16)
				for (let i = 1; i <= maxViews; i++) {
					try {
						await queryDuckDB(duckdb.conn, `DROP VIEW IF EXISTS "cell_${i}"`)
					} catch {
						/* noop */
					}
				}
			}
			await runCellsSequential(tabId, sqlCellIds)
			setCellsDirty(tabId, false)
		},
		[tabs, duckdb.conn, runCellsSequential, setCellsDirty]
	)

	const runCellsAbove = useCallback(
		async (tabId: string, targetCellId: string) => {
			const tab = tabs.find((t) => t.id === tabId)
			if (!tab || tab.mode !== 'notebook' || !tab.cells) return
			const targetIdx = tab.cells.findIndex((c) => c.id === targetCellId)
			if (targetIdx <= 0) return
			const ids = tab.cells
				.slice(0, targetIdx)
				.filter((c) => c.type === 'sql' && c.source.trim())
				.map((c) => c.id)
			await runCellsSequential(tabId, ids)
		},
		[tabs, runCellsSequential]
	)

	const runCellsBelow = useCallback(
		async (tabId: string, targetCellId: string) => {
			const tab = tabs.find((t) => t.id === tabId)
			if (!tab || tab.mode !== 'notebook' || !tab.cells) return
			const targetIdx = tab.cells.findIndex((c) => c.id === targetCellId)
			if (targetIdx === -1 || targetIdx >= tab.cells.length - 1) return
			const ids = tab.cells
				.slice(targetIdx + 1)
				.filter((c) => c.type === 'sql' && c.source.trim())
				.map((c) => c.id)
			await runCellsSequential(tabId, ids)
		},
		[tabs, runCellsSequential]
	)

	const runCellAndAdvance = useCallback(
		async (tabId: string, cellId: string) => {
			const tab = tabs.find((t) => t.id === tabId)
			if (!tab || tab.mode !== 'notebook' || !tab.cells) return
			const idx = tab.cells.findIndex((c) => c.id === cellId)
			if (idx === -1) return
			await runSqlForCell(tabId, cellId)
			const nextCell = tab.cells[idx + 1]
			if (nextCell) {
				focusCell(tabId, nextCell.id)
			} else {
				const newId = addCell(tabId, 'sql', idx + 1, true)
				if (newId) focusCell(tabId, newId)
			}
		},
		[tabs, runSqlForCell, focusCell, addCell]
	)

	useEffect(() => {
		return () => {
			// Cleanup on workspace unmount — best-effort
			if (!duckdb.conn) return
			for (let i = 1; i <= 64; i++) {
				queryDuckDB(duckdb.conn, `DROP VIEW IF EXISTS "cell_${i}"`).catch(() => undefined)
			}
		}
	}, [duckdb.conn])

	// --- Examples / saved queries / cookbook ---

	const onApplyExample = useCallback(
		(example: ExampleQuery) => {
			if (activeTab.mode === 'notebook' && activeTab.cells) {
				const lastCell = activeTab.cells[activeTab.cells.length - 1]
				const needsFreshCell = !lastCell || lastCell.type !== 'sql' || lastCell.source.trim().length > 0
				const targetCellId: string | null = needsFreshCell
					? addCell(activeTab.id, 'sql', activeTab.cells.length, true)
					: lastCell!.id
				if (!targetCellId) return
				updateCell(activeTab.id, targetCellId, { source: example.sql, dirty: true })
				return runSqlForCell(activeTab.id, targetCellId)
			}
			const newId = openTab({ sql: example.sql, title: example.title, focus: true })
			return prepareAndRun({
				tabId: newId,
				taskId: `example:${example.title}`,
				tables: example.tables,
				sql: example.sql
			})
		},
		[activeTab, openTab, prepareAndRun, addCell, updateCell, runSqlForCell]
	)

	const onLoadSavedQuery = useCallback(
		(preset: QuerySavedConfig) => {
			const existing = tabs.find((t) => t.mode === 'query' && t.sql === preset.sql)
			if (existing) {
				focusTab(existing.id)
				setSectionTab('editor')
				return
			}
			const newId = openTab({ sql: preset.sql, title: preset.name, focus: true })
			return prepareAndRun({ tabId: newId, taskId: `saved:${preset.id}`, tables: preset.tables, sql: preset.sql })
		},
		[tabs, focusTab, openTab, prepareAndRun]
	)

	// The reference sheet opens only from the editor section, so these need not switch sections.
	const onReplaceSql = useCallback((snippet: string) => openTab({ sql: snippet, focus: true }), [openTab])

	const onCookbookApply = useCallback(
		(snippet: string) => {
			const newId = openTab({ sql: snippet, focus: true })
			runSqlForTab(newId, snippet)
		},
		[openTab, runSqlForTab]
	)

	const onSavePreset = useCallback(
		(name: string) => {
			const trimmed = activeTab.sql.trim()
			if (!trimmed) return
			const preset: QuerySavedConfig = {
				id: generatePresetId(),
				name,
				createdAt: Date.now(),
				...extractQueryConfig({
					sql: trimmed,
					tables: registry.tables.map((t) =>
						t.source.kind === 'dataset'
							? { kind: 'dataset', slug: t.source.slug }
							: { kind: 'chart', slug: t.source.slug, param: t.source.param, paramLabel: t.source.paramLabel }
					)
				})
			}
			saveDownload(preset)
			setSavePresetOpen(false)
		},
		[activeTab.sql, registry.tables, saveDownload]
	)

	const onApplyFix = useCallback(
		(oldId: string, newId: string) => {
			updateActiveTab((t) => ({ sql: replaceIdentifier(t.sql, oldId, newId), dirty: true }))
		},
		[updateActiveTab]
	)

	const router = useRouter()
	// Read through locals: the pages router keeps one object identity and swaps `query` on navigation, so
	// these are the values that actually change, and the effect depends on them rather than on the router.
	const routerIsReady = router.isReady
	const routerQuery = router.query
	const hydratedRef = useRef(false)
	useEffect(() => {
		if (hydratedRef.current) return
		if (!routerIsReady) return
		if (!duckdb.conn) return
		const rawQuery = routerQuery as Record<string, string | Array<string> | undefined>

		const notebookDecoded = decodeNotebookShare(rawQuery)
		if (notebookDecoded) {
			hydratedRef.current = true
			const cells = notebookDecoded.cells.map((c) => buildCellFromShared(c))
			const newId = openNotebookTab({
				cells,
				title: notebookDecoded.title ?? 'Shared notebook',
				focus: true
			})
			window.setTimeout(() => setSectionTab('editor'), 0)
			void (async () => {
				for (const cell of cells) {
					if (cell.type === 'sql' && cell.source.trim()) {
						await runSqlForCell(newId, cell.id)
					}
				}
			})()
			router.replace({ pathname: router.pathname, query: { mode: 'sql' } }, undefined, { shallow: true })
			return
		}

		const decoded = decodeDownloadConfig(rawQuery)
		if (!decoded) {
			hydratedRef.current = true
			return
		}
		if (decoded.kind === 'query') {
			hydratedRef.current = true
			const existing = tabs.find((t) => t.mode === 'query' && t.sql === decoded.sql)
			const tabId = existing ? existing.id : openTab({ sql: decoded.sql, focus: true })
			if (existing) focusTab(existing.id)
			// A link made from the chart view opens on the chart.
			if (decoded.chartConfig) updateTab(tabId, { chartConfig: decoded.chartConfig, view: 'chart' })
			// The run switches to the editor section itself; a task keeps that state update out of the effect.
			window.setTimeout(() => {
				void prepareAndRun({ tabId, taskId: `share:${Date.now()}`, tables: decoded.tables, sql: decoded.sql })
			}, 0)
			router.replace({ pathname: router.pathname, query: { mode: 'sql' } }, undefined, { shallow: true })
		}
	}, [
		router,
		routerIsReady,
		routerQuery,
		duckdb.conn,
		openNotebookTab,
		runSqlForCell,
		tabs,
		openTab,
		focusTab,
		updateTab,
		prepareAndRun
	])

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null
			const mod = e.metaKey || e.ctrlKey
			if (!mod) return
			if (e.key === 't' || e.key === 'T') {
				if (e.shiftKey) return
				e.preventDefault()
				openTab({ focus: true })
				setSectionTab('editor')
				return
			}
			if (e.key === 'w' || e.key === 'W') {
				if (tabs.length > 1) {
					e.preventDefault()
					closeTab(activeTabId)
				}
				return
			}
			if (e.shiftKey && (e.key === ']' || e.code === 'BracketRight')) {
				e.preventDefault()
				focusDelta(1)
				return
			}
			if (e.shiftKey && (e.key === '[' || e.code === 'BracketLeft')) {
				e.preventDefault()
				focusDelta(-1)
				return
			}
			if (/^[1-9]$/.test(e.key)) {
				const editable =
					target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
				if (editable) return
				e.preventDefault()
				focusByIndex(Number(e.key) - 1)
			}
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [openTab, closeTab, focusDelta, focusByIndex, tabs.length, activeTabId])

	const notebookShareCells = useMemo(() => {
		if (activeTab.mode !== 'notebook' || !activeTab.cells) return []
		return activeTab.cells.map((c) => ({
			type: c.type,
			source: c.source,
			chartConfig: c.chartConfig
		}))
	}, [activeTab])

	return (
		<div className="flex flex-col gap-3">
			<StatusStrip
				duckdbStatus={duckdb.status}
				lastRun={activeTab.lastRun}
				running={activeTab.running || (activeTab.cells?.some((c) => c.running) ?? false)}
				loadingStage={activeTab.loadingStage}
				error={!!activeTab.runError || (activeTab.cells?.some((c) => !!c.runError) ?? false)}
			/>
			{duckdb.status === 'error' ? (
				<InlineStatus variant="error" retry={duckdb.retry}>
					The SQL engine failed to load, so queries can&apos;t run.
				</InlineStatus>
			) : null}

			<Tabs<SqlTab> value={sectionTab} onValueChange={setSectionTab} values={SQL_TABS}>
				<UnderlineTabList
					label="SQL workspace section"
					tabs={[
						{ id: 'editor', label: 'Editor' },
						{ id: 'saved', label: savedQueries.length > 0 ? `Saved (${savedQueries.length})` : 'Saved' }
					]}
				/>
				<TabPanel value={sectionTab}>
					{sectionTab === 'editor' ? (
						<div
							className={`grid grid-cols-1 gap-4 ${
								playbookCollapsed ? 'lg:grid-cols-[minmax(0,1fr)_44px]' : 'lg:grid-cols-[minmax(0,1fr)_320px]'
							}`}
						>
							<div className="flex min-w-0 flex-col gap-3">
								<Tabs value={activeTabId} onValueChange={focusTab} values={tabs.map((tab) => tab.id)}>
									<QueryTabBar
										tabs={tabs}
										activeTabId={activeTabId}
										onClose={closeTab}
										onNewTab={() => openTab({ focus: true })}
										onNewNotebookTab={() => openNotebookTab({ focus: true })}
										onRename={renameTab}
										onDuplicate={duplicateTab}
										onCloseOthers={closeOthers}
										onCloseToRight={closeToRight}
										onConvertToNotebook={convertTabToNotebook}
									/>
									<TabPanel value={activeTabId} className="flex min-w-0 flex-col gap-3">
										<TableChipRail
											tables={registry.tables}
											onBrowseSchema={() => setSchemaDrawerOpen(true)}
											onRemove={registry.remove}
											pending={
												activeTab.mode === 'notebook'
													? (activeTab.cells?.flatMap((c) => c.pendingTables) ?? [])
													: activeTab.pendingTables
											}
											totalSchemaCount={TOTAL_SCHEMA_COUNT}
										/>

										{activeTab.mode === 'notebook' ? (
											<NotebookView
												tab={activeTab}
												loadedTables={registry.tables}
												canRun={!!duckdb.conn}
												onCellSourceChange={(cellId, source) =>
													updateCell(activeTab.id, cellId, (c) => ({
														source,
														dirty: source !== c.source ? true : c.dirty
													}))
												}
												onCellFocus={(cellId) => focusCell(activeTab.id, cellId)}
												onCellChartConfig={(cellId, next) =>
													updateCell(activeTab.id, cellId, { chartConfig: next ?? undefined })
												}
												onCellViewChange={(cellId, view) => updateCell(activeTab.id, cellId, { view })}
												onRunCell={async (cellId) => {
													await runSqlForCell(activeTab.id, cellId)
												}}
												onCancelCell={(cellId) => cancelCellRun(activeTab.id, cellId)}
												onRunCellAndAdvance={(cellId) => runCellAndAdvance(activeTab.id, cellId)}
												onRunAbove={(cellId) => runCellsAbove(activeTab.id, cellId)}
												onRunBelow={(cellId) => runCellsBelow(activeTab.id, cellId)}
												onRunAll={() => runAllCellsInTab(activeTab.id)}
												onAddCell={(type, atIndex) => {
													addCell(activeTab.id, type, atIndex, true)
												}}
												onDeleteCell={(cellId) => removeCell(activeTab.id, cellId)}
												onMoveCell={(cellId, direction) => {
													const cells = activeTab.cells ?? []
													const idx = cells.findIndex((c) => c.id === cellId)
													if (idx === -1) return
													const toIdx = direction === 'up' ? idx - 1 : idx + 1
													if (toIdx < 0 || toIdx >= cells.length) return
													reorderCells(activeTab.id, idx, toIdx)
												}}
												onReorderCell={(fromIdx, toIdx) => reorderCells(activeTab.id, fromIdx, toIdx)}
												onConvertCellType={(cellId, nextType) =>
													updateCell(activeTab.id, cellId, {
														type: nextType,
														result: null,
														runError: null,
														lastRun: null
													})
												}
												onDismissCellsDirty={() => setCellsDirty(activeTab.id, false)}
											/>
										) : (
											<>
												<Editor
													key={activeTabId}
													ref={editorRef}
													value={activeTab.sql}
													onChange={setActiveSql}
													onRun={runQuery}
													tables={registry.tables}
												/>
												<EditorRunBar
													running={activeTab.running || !!activeTab.loadingStage}
													canRun={!!duckdb.conn && !!activeTab.sql.trim()}
													onRun={runQuery}
													onCancel={() => cancelTabRun(activeTabId)}
													onSave={() => setSavePresetOpen(true)}
													sql={activeTab.sql}
													tables={tableRefs}
													chartConfig={activeTab.chartConfig}
													mode="query"
													notebookCells={[]}
													notebookTitle={activeTab.title}
												/>
												{activeTab.runError ? (
													<ErrorBanner
														error={activeTab.runError}
														loadedTables={registry.tables}
														onJump={(line, col) => editorRef.current?.revealLine(line, col)}
														onApplyFix={onApplyFix}
													/>
												) : null}
												<ResultsPanel
													result={activeTab.result}
													running={activeTab.running}
													busyLabel={activeTab.loadingStage}
													chartConfig={activeTab.chartConfig}
													onChartConfigChange={setActiveChartConfig}
													view={activeTab.view}
													onViewChange={(view) => updateTab(activeTabId, { view })}
													durationMs={activeTab.lastRun?.durationMs ?? null}
												/>
											</>
										)}

										{activeTab.mode === 'notebook' ? (
											<div className="flex flex-wrap items-center justify-end gap-2">
												<ShareQueryButton
													sql=""
													tables={tableRefs}
													chartConfig={undefined}
													disabled={!duckdb.conn}
													mode="notebook"
													notebookCells={notebookShareCells}
													notebookTitle={activeTab.title}
												/>
											</div>
										) : null}
									</TabPanel>
								</Tabs>
							</div>
							<div className="lg:sticky lg:top-4 lg:self-start">
								<ExamplesPanel
									onApply={onApplyExample}
									busyTaskId={activeTab.busyTaskId}
									collapse={{ collapsed: playbookCollapsed, onToggle: togglePlaybook }}
								/>
							</div>
						</div>
					) : (
						<SavedQueriesTab
							savedQueries={savedQueries}
							savedDownloads={savedDownloads}
							onOpen={onLoadSavedQuery}
							onDelete={deleteDownload}
							onRename={renameDownload}
							busyTaskId={activeTab.busyTaskId}
						/>
					)}
				</TabPanel>
			</Tabs>
			{savePresetOpen ? (
				<SavePresetDialog
					suggestedName={firstNonEmptyLine(activeTab.sql).slice(0, 60) || 'Untitled query'}
					existingNames={savedDownloads.map((d) => d.name)}
					title="Save SQL query"
					description="Saved queries appear in the saved tab and in the main Saved list."
					placeholder="Query name"
					onSave={onSavePreset}
					onClose={() => setSavePresetOpen(false)}
				/>
			) : null}

			<SchemaDrawer
				open={schemaDrawerOpen}
				onClose={() => setSchemaDrawerOpen(false)}
				chartOptionsMap={chartOptionsMap}
				loadedTables={registry.tables}
				onLoad={registry.load}
				onReplaceSql={onReplaceSql}
				// A notebook has no single editor for a column name to go into.
				onInsertAtCursor={activeTab.mode === 'query' ? (text) => editorRef.current?.insertSnippet(text) : null}
				onApplyAndRun={onCookbookApply}
				loading={registry.loading}
				loadError={registry.error}
				pickedParams={schemaParams}
				setPickedParams={setSchemaParams}
			/>
		</div>
	)
}

function buildCellFromShared(c: {
	type: 'sql' | 'markdown' | 'chart'
	source: string
	chartConfig?: ChartConfig
}): NotebookCell {
	return {
		id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
		type: c.type,
		source: c.source,
		chartConfig: c.chartConfig,
		view: 'table',
		result: null,
		running: false,
		runError: null,
		lastRun: null,
		loadingStage: null,
		pendingTables: [],
		dirty: c.source.trim().length > 0
	}
}

function StatusStrip({
	duckdbStatus,
	lastRun,
	running,
	loadingStage,
	error
}: {
	duckdbStatus: 'loading' | 'ready' | 'error'
	lastRun: LastRunMeta | null
	running: boolean
	loadingStage: string | null
	error: boolean
}) {
	const envStatus = duckdbStatus === 'ready' ? 'good' : duckdbStatus === 'error' ? 'bad' : 'caution'
	const busy = running || !!loadingStage
	const runStatus = error ? 'bad' : busy ? 'caution' : lastRun ? 'good' : 'neutral'

	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-subtle bg-surface px-3 py-2 body-sm text-secondary">
			<span className="flex items-center gap-1.5">
				<StatusDot status={envStatus} />
				<span className="text-tertiary">LlamaSQL</span>
				<span
					className={
						duckdbStatus === 'ready' ? 'text-primary' : duckdbStatus === 'error' ? 'text-error' : 'text-warning'
					}
				>
					{duckdbStatus === 'ready' ? 'ready' : duckdbStatus === 'error' ? 'failed' : 'loading'}
				</span>
			</span>

			<Divider />

			<span className="flex items-center gap-1.5">
				<StatusDot status={runStatus} pulse={busy} />
				<span className="text-tertiary">Last run</span>
				{loadingStage ? (
					<span className="text-warning">{loadingStage}…</span>
				) : running ? (
					<span className="text-warning">running…</span>
				) : error ? (
					<span className="text-error">error</span>
				) : lastRun ? (
					<span className="text-primary">
						<span className="tabular-nums">{formatSqlDuration(lastRun.durationMs)}</span>
						<span className="px-1 text-tertiary">·</span>
						<span className="tabular-nums">{formatNumber(lastRun.rows)}</span>
						<span className="text-tertiary"> rows</span>
					</span>
				) : (
					<span className="text-tertiary">idle</span>
				)}
			</span>
		</div>
	)
}

function Divider() {
	return <span aria-hidden className="h-3 w-px bg-border-subtle" />
}

function EditorRunBar({
	running,
	canRun,
	onRun,
	onCancel,
	onSave,
	sql,
	tables,
	chartConfig,
	mode,
	notebookCells,
	notebookTitle
}: {
	running: boolean
	canRun: boolean
	onRun: () => void
	onCancel: () => void
	onSave: () => void
	sql: string
	tables: Array<QueryTableRef>
	chartConfig: ChartConfig | undefined
	mode: 'query' | 'notebook'
	notebookCells: Array<{ type: 'sql' | 'markdown'; source: string; chartConfig?: ChartConfig }>
	notebookTitle: string
}) {
	return (
		<div className="flex flex-wrap items-center justify-end gap-2">
			<ShareQueryButton
				sql={sql}
				tables={tables}
				chartConfig={chartConfig}
				disabled={!canRun}
				mode={mode}
				notebookCells={notebookCells}
				notebookTitle={notebookTitle}
			/>
			<Button variant="secondary" size="md" onClick={onSave} disabled={!canRun}>
				<Icon name="bookmark" className="size-3.5" />
				Save
			</Button>
			{/* Run and Stop share one slot, so React keeps the same button and its focus when they swap. */}
			{running ? (
				<Button variant="secondary" size="md" onClick={onCancel}>
					<BusyGlyph decorative size={14} />
					<Icon name="stop" className="size-3.5 fill-current" aria-hidden />
					Stop
				</Button>
			) : (
				<Button variant="primary" size="md" onClick={onRun} disabled={!canRun}>
					<Icon name="play" className="size-3.5 fill-current" aria-hidden />
					Run query
					<span aria-hidden className="flex items-center gap-0.5">
						<Keycap onBrand>⌘</Keycap>
						<Keycap onBrand>↵</Keycap>
					</span>
				</Button>
			)}
		</div>
	)
}

function SavedQueriesTab({
	savedQueries,
	savedDownloads,
	onOpen,
	onDelete,
	onRename,
	busyTaskId
}: {
	savedQueries: Array<QuerySavedConfig>
	/** Every preset kind, because a query's name must stay unique in the main Saved list too. */
	savedDownloads: Array<SavedDownload>
	onOpen: (q: QuerySavedConfig) => void
	onDelete: (id: string) => void
	onRename: (id: string, name: string) => void
	busyTaskId: string | null
}) {
	const [renaming, setRenaming] = useState<QuerySavedConfig | null>(null)
	const [deleting, setDeleting] = useState<QuerySavedConfig | null>(null)

	if (savedQueries.length === 0) {
		return (
			<EmptyState size="lg" icon="bookmark" title="No saved queries yet" framed>
				Click Save in the editor to bookmark a query — saved queries survive across sessions.
			</EmptyState>
		)
	}
	const busy = !!busyTaskId
	return (
		<>
			<ul className="flex flex-col divide-y divide-(--border-subtle) border-y border-subtle">
				{savedQueries.map((q) => {
					const isBusy = busyTaskId === `saved:${q.id}`
					const isDim = busy && !isBusy
					return (
						<li
							key={q.id}
							className={`group flex items-center justify-between gap-3 py-3 ${isDim ? 'opacity-60' : ''}`}
						>
							{/* The pressed query turns busy under the reader's focus, so it stays focusable while it opens. */}
							<Ariakit.Button
								onClick={() => onOpen(q)}
								disabled={busy}
								accessibleWhenDisabled={isBusy}
								aria-busy={isBusy}
								className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
							>
								{isBusy ? (
									<BusyGlyph decorative size={12} />
								) : (
									<Icon
										name="arrow-right"
										className="size-3.5 shrink-0 text-tertiary transition-colors group-hover:text-link"
									/>
								)}
								<span className="flex min-w-0 flex-1 flex-col gap-0.5">
									<span className="truncate title-md text-primary transition-colors group-hover:text-link">
										{q.name}
									</span>
									<span className="truncate mono-sm text-tertiary">{firstNonEmptyLine(q.sql)}</span>
								</span>
							</Ariakit.Button>
							{/* A touch screen cannot hover, so it always shows the actions. */}
							<div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
								<Tooltip
									content="Rename"
									render={
										<Button
											variant="ghost"
											size="sm"
											square
											onClick={() => setRenaming(q)}
											aria-label={`Rename ${q.name}`}
											disabled={busy}
											accessibleWhenDisabled
										/>
									}
								>
									<Icon name="pencil" className="size-4" />
								</Tooltip>
								<Tooltip
									content="Delete"
									render={
										<Button
											variant="ghostDestructive"
											size="sm"
											square
											onClick={() => setDeleting(q)}
											aria-label={`Delete ${q.name}`}
											disabled={busy}
											accessibleWhenDisabled
										/>
									}
								>
									<Icon name="trash-2" className="size-4" />
								</Tooltip>
							</div>
						</li>
					)
				})}
			</ul>
			{renaming ? (
				<RenamePresetDialog
					preset={renaming}
					presets={savedDownloads}
					onRename={onRename}
					onClose={() => setRenaming(null)}
				/>
			) : null}
			{deleting ? <DeletePresetDialog preset={deleting} onDelete={onDelete} onClose={() => setDeleting(null)} /> : null}
		</>
	)
}

function sameSource(
	a: RegisteredTable['source'],
	b: { kind: 'dataset'; slug: string } | { kind: 'chart'; slug: string; param: string; paramLabel?: string }
): boolean {
	if (a.kind !== b.kind) return false
	if (a.kind === 'dataset' && b.kind === 'dataset') return a.slug === b.slug
	if (a.kind === 'chart' && b.kind === 'chart') return a.slug === b.slug && a.param === b.param
	return false
}

function throwIfAborted(signal: AbortSignal): void {
	if (signal.aborted) throw new DOMException('Canceled', 'AbortError')
}

function isAbortError(err: unknown): boolean {
	return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError'
}

function scheduleTabPendingClear(
	updateTab: (id: string, patch: Partial<QueryTab> | ((t: QueryTab) => Partial<QueryTab>)) => void,
	tabId: string
) {
	window.setTimeout(() => updateTab(tabId, { pendingTables: [] }), 1400)
}

function firstNonEmptyLine(text: string): string {
	return (
		text
			.split('\n')
			.find((l) => l.trim())
			?.trim() ?? ''
	)
}
