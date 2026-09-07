import * as Ariakit from '@ariakit/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import type { ChartOptionsMap } from '~/containers/Downloads/chart-datasets'
import {
	defaultPresetName,
	extractQueryConfig,
	generatePresetId,
	type QuerySavedConfig
} from '~/containers/Downloads/savedDownloads'
import { defaultChartConfig, migrateChartConfig, type ChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { classifyColumns } from '~/containers/Downloads/sql/columnKind'
import { Editor, type EditorHandle } from '~/containers/Downloads/sql/Editor'
import type { ExampleQuery } from '~/containers/Downloads/sql/examples'
import { runSql } from '~/containers/Downloads/sql/executor'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import { Keycap } from '~/containers/Downloads/sql/primitives'
import { ResultsPanel } from '~/containers/Downloads/sql/ResultsPanel'
import { useDuckDB } from '~/containers/Downloads/sql/useDuckDB'
import { tableNameFor, useTableRegistry, type TableSource } from '~/containers/Downloads/sql/useTableRegistry'
import { useSavedDownloads } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { formatNumber } from '~/utils/numberFormat'
import { useProDashboardEditorActions } from '../../ProDashboardAPIContext'
import { clampRowCap, snapshotToResult, SQL_SNAPSHOT_ROW_CAP_MAX, SQL_SNAPSHOT_ROW_CAP_MIN } from '../../sqlSnapshot'
import type { SqlChartConfig } from '../../types'
import { buildSqlChartConfig } from './buildSqlChartConfig'
import { loadChartOptions } from './chartOptions'
import { SqlChartModalSidebar } from './SqlChartModalSidebar'

interface SqlChartModalProps {
	editItem?: SqlChartConfig | null
	onClose: () => void
}

type RunOutcome = { result: QueryResult; chartConfig: ChartConfig }

async function runWithSources(
	context: Parameters<typeof runSql>[0],
	sql: string,
	sources: Array<TableSource>,
	options: Parameters<typeof runSql>[2],
	signal: AbortSignal
) {
	const loadedNames = new Set(context.loadedTables.map((table) => table.name))
	for (const source of sources) {
		if (signal.aborted) return { ok: false, cancelled: true } as const
		if (source.kind === 'chart' && !loadedNames.has(tableNameFor(source))) {
			await context.loadSource(source, signal)
			loadedNames.add(tableNameFor(source))
		}
	}
	if (signal.aborted) return { ok: false, cancelled: true } as const
	return runSql(context, sql, options, undefined, signal)
}

export function SqlChartModal({ editItem, onClose }: SqlChartModalProps) {
	const { authorizedFetch } = useAuthContext()
	const { handleAddSqlChart, handleEditItem } = useProDashboardEditorActions()
	const duckdb = useDuckDB()
	const registry = useTableRegistry({ conn: duckdb.conn ?? null, authorizedFetch })
	const { savedDownloads, saveDownload } = useSavedDownloads()
	const savedQueries = useMemo(
		() => savedDownloads.filter((d): d is QuerySavedConfig => d.kind === 'query'),
		[savedDownloads]
	)

	const [chartOptionsMap, setChartOptionsMap] = useState<ChartOptionsMap>({})
	const [sql, setSql] = useState(editItem?.query.sql ?? '')
	const [name, setName] = useState(editItem?.name ?? '')
	const [result, setResult] = useState<QueryResult | null>(
		editItem?.snapshot ? snapshotToResult(editItem.snapshot) : null
	)
	const [resultSql, setResultSql] = useState(editItem?.query.sql ?? '')
	const [ranFresh, setRanFresh] = useState(false)
	const [chartConfig, setChartConfig] = useState<ChartConfig | undefined>(editItem?.chart)
	const [displayMode, setDisplayMode] = useState<'chart' | 'table'>(editItem?.displayMode ?? 'chart')
	const [rowCap, setRowCap] = useState(clampRowCap(editItem?.rowCap))
	const [running, setRunning] = useState(false)
	const [savePending, setSavePending] = useState(false)
	const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
	const [loadingStage, setLoadingStage] = useState<string | null>(null)
	const [queryError, setQueryError] = useState<string | null>(null)
	const [durationMs, setDurationMs] = useState<number | null>(null)

	const editorRef = useRef<EditorHandle | null>(null)
	const runControllerRef = useRef<AbortController | null>(null)
	const chartConfigRef = useRef(chartConfig)
	useLayoutEffect(() => {
		chartConfigRef.current = chartConfig
	})

	useEffect(() => {
		let active = true
		loadChartOptions().then((m) => {
			if (active) setChartOptionsMap(m)
		})
		return () => {
			active = false
		}
	}, [])

	useEffect(() => () => runControllerRef.current?.abort(), [])

	const run = useCallback(
		async (override?: string, sources: Array<TableSource> = []): Promise<RunOutcome | null> => {
			if (!duckdb.conn) return null
			const trimmed = (override ?? sql).trim()
			if (!trimmed) return null
			runControllerRef.current?.abort()
			const controller = new AbortController()
			runControllerRef.current = controller
			setRunning(true)
			setQueryError(null)
			setLoadingStage(null)
			const res = await runWithSources(
				{ conn: duckdb.conn, loadedTables: registry.tables, loadSource: registry.load, chartOptionsMap },
				trimmed,
				sources,
				{
					onLoadingStage: (stage) => {
						if (runControllerRef.current === controller) setLoadingStage(stage)
					}
				},
				controller.signal
			).catch((error: unknown) => ({
				ok: false as const,
				cancelled: false,
				error: error instanceof Error ? error.message : 'Could not load query sources'
			}))
			if (controller.signal.aborted || runControllerRef.current !== controller) return null
			runControllerRef.current = null
			setRunning(false)
			setLoadingStage(null)
			if (res.ok) {
				const classified = classifyColumns(res.result)
				const nextChartConfig = chartConfigRef.current
					? migrateChartConfig(chartConfigRef.current, classified)
					: defaultChartConfig(classified)
				setResult(res.result)
				setResultSql(trimmed)
				setRanFresh(true)
				setDurationMs(res.durationMs)
				setChartConfig(nextChartConfig)
				return { result: res.result, chartConfig: nextChartConfig }
			}
			if ('error' in res && !res.cancelled) setQueryError(res.error)
			return null
		},
		[duckdb.conn, registry.tables, registry.load, chartOptionsMap, sql]
	)

	const applyQuery = useCallback(
		async (taskId: string, title: string, nextSql: string, tables?: Array<TableSource>, overwriteName?: boolean) => {
			if (running || savePending || busyTaskId) return
			setSql(nextSql)
			setName((prev) => (overwriteName ? title : prev.trim() ? prev : title))
			if (!duckdb.conn) return
			setBusyTaskId(taskId)
			try {
				await run(nextSql, tables)
			} finally {
				setBusyTaskId(null)
			}
		},
		// oxlint-disable-next-line react/memo-dependencies -- React Compiler does not see dependencies read inside an async try/finally; these are correct.
		[running, savePending, busyTaskId, duckdb.conn, run]
	)

	const editorLineCount = sql.split('\n').length
	const editorHeight = `${(Math.min(Math.max(editorLineCount + 1, 6), 22) * 19 + 16).toString()}px`

	const isDirty = sql.trim() !== resultSql
	const resultRowCount = result?.rows.length ?? null
	const needsRun = isDirty || !result || !chartConfig
	const engineLoading = duckdb.status === 'loading'
	const engineError = duckdb.status === 'error'
	const canSave = !!sql.trim() && !running && !savePending && !(needsRun && (engineLoading || engineError))

	const handleSave = useCallback(async () => {
		if (!canSave) return
		let outcome: RunOutcome | null = !needsRun && result && chartConfig ? { result, chartConfig } : null
		let ranForSave = false
		if (!outcome) {
			setSavePending(true)
			try {
				outcome = await run()
			} finally {
				setSavePending(false)
			}
			if (!outcome) return
			ranForSave = true
		}
		const config = buildSqlChartConfig({
			editItem: editItem ?? null,
			name,
			sql,
			result: outcome.result,
			ranFresh: ranForSave || ranFresh,
			chartConfig: outcome.chartConfig,
			displayMode,
			rowCap,
			registryTables: registry.tables
		})
		if (editItem) {
			handleEditItem(config.id, config)
		} else {
			handleAddSqlChart(config)
		}
		const queryInput = extractQueryConfig({
			sql: config.query.sql,
			tables: config.query.tableSources,
			chartConfig: outcome.chartConfig
		})
		saveDownload(
			{
				id: generatePresetId(),
				name: config.name ?? defaultPresetName(queryInput),
				createdAt: Date.now(),
				...queryInput
			},
			{ replaceByName: true }
		)
		onClose()
	}, [
		canSave,
		needsRun,
		result,
		chartConfig,
		// oxlint-disable-next-line react/memo-dependencies -- React Compiler does not see dependencies read inside an async try/finally; `run` is used.
		run,
		editItem,
		name,
		sql,
		ranFresh,
		displayMode,
		rowCap,
		registry.tables,
		handleEditItem,
		handleAddSqlChart,
		saveDownload,
		onClose
	])

	return (
		<Ariakit.DialogProvider
			open
			setOpen={(open) => {
				if (!open) onClose()
			}}
		>
			<Ariakit.Dialog
				unmountOnHide
				portal
				hideOnInteractOutside={false}
				className="fixed inset-0 z-50 flex flex-col gap-3 overflow-hidden pro-dashboard bg-surface p-3 md:inset-4 md:rounded-md md:border md:border-medium md:p-4 md:shadow-xl"
			>
				<div className="flex shrink-0 items-center justify-between">
					<Ariakit.DialogHeading
						render={<h2>{editItem ? 'Edit SQL chart' : 'New SQL chart'}</h2>}
						className="text-xl font-semibold text-pro-text-primary"
					/>
					<Ariakit.DialogDismiss className="rounded-md pro-hover-bg p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary">
						<Icon name="x" height={20} width={20} />
						<span className="sr-only">Close dialog</span>
					</Ariakit.DialogDismiss>
				</div>

				<div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_540px]">
					<div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							aria-label="Widget name"
							placeholder="Widget name (optional)"
							className="shrink-0 rounded-md border pro-border bg-page px-3 py-2 text-sm text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden"
						/>

						<div className="shrink-0">
							<Editor
								ref={editorRef}
								value={sql}
								onChange={setSql}
								onRun={() => void run()}
								tables={registry.tables}
								height={editorHeight}
							/>
						</div>

						<div className="flex shrink-0 flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={() => void run()}
								disabled={running || savePending || engineLoading || !sql.trim()}
								className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-sm transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
									<path d="M8 5v14l11-7z" />
								</svg>
								{running ? 'Running…' : 'Run query'}
								<span aria-hidden className="flex items-center gap-0.5">
									<Keycap muted>⌘</Keycap>
									<Keycap muted>↵</Keycap>
								</span>
							</button>
							{loadingStage ? <span className="text-xs text-pro-text-tertiary">{loadingStage}</span> : null}
							{engineLoading ? <span className="text-xs text-pro-text-tertiary">Starting SQL engine…</span> : null}
							{engineError ? (
								<span className="text-xs text-error">
									SQL engine failed to load{duckdb.error ? `: ${duckdb.error}` : ''}.
								</span>
							) : null}
							{isDirty && result ? (
								<span className="text-xs text-pro-text-tertiary">Query changed — Save will run it again.</span>
							) : null}
						</div>

						{queryError ? (
							<div className="shrink-0 rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error">
								{queryError}
							</div>
						) : null}

						{resultRowCount !== null && resultRowCount > rowCap ? (
							<div className="shrink-0 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-pro-text-secondary">
								Result has {formatNumber(resultRowCount)} rows. The widget will show the first {formatNumber(rowCap)}
								with this widget.
							</div>
						) : null}

						<ResultsPanel
							result={result}
							running={running}
							busyLabel={loadingStage}
							chartConfig={chartConfig}
							onChartConfigChange={(next) => setChartConfig(next ?? undefined)}
							durationMs={durationMs}
							view={displayMode}
							onViewChange={setDisplayMode}
							viewToggleLabel="Display as"
						/>
					</div>

					<SqlChartModalSidebar
						chartOptionsMap={chartOptionsMap}
						loadedTables={registry.tables}
						onLoadTable={registry.load}
						schemaLoading={registry.loading}
						busyTaskId={busyTaskId}
						savedQueries={savedQueries}
						onApplyExample={(example: ExampleQuery) =>
							void applyQuery(`example:${example.title}`, example.title, example.sql, example.tables)
						}
						onApplySaved={(query: QuerySavedConfig) =>
							void applyQuery(`saved:${query.id}`, query.name, query.sql, query.tables, true)
						}
						onReplaceSql={setSql}
						onInsertAtCursor={(text) => editorRef.current?.insertSnippet(text)}
						onApplyAndRun={(snippet) => {
							setSql(snippet)
							void run(snippet)
						}}
					/>
				</div>

				<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-medium pt-3">
					<div className="flex flex-wrap items-center gap-4">
						<span className="text-xs text-pro-text-tertiary">
							{displayMode === 'table' ? 'Widget shows the result as a table.' : 'Widget shows the result as a chart.'}
						</span>
						<label className="flex items-center gap-2 text-xs text-pro-text-tertiary">
							Rows to display
							<input
								type="number"
								min={SQL_SNAPSHOT_ROW_CAP_MIN}
								max={SQL_SNAPSHOT_ROW_CAP_MAX}
								step={100}
								value={rowCap}
								onChange={(e) => {
									const next = Number(e.target.value)
									if (Number.isFinite(next)) setRowCap(next)
								}}
								onBlur={() => setRowCap((prev) => clampRowCap(prev))}
								title={`How many query result rows the widget can display (${SQL_SNAPSHOT_ROW_CAP_MIN}–${SQL_SNAPSHOT_ROW_CAP_MAX}). Query results are refreshed at request time and are not stored in the dashboard.`}
								className="w-20 rounded-md border pro-border bg-page px-2 py-1 text-xs text-pro-text-primary focus:ring-1 focus:ring-brand focus:outline-hidden"
							/>
						</label>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onClose}
							className="rounded-md border pro-border pro-hover-bg px-4 py-2 text-sm text-pro-text-secondary transition-colors hover:text-pro-text-primary"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => void handleSave()}
							disabled={!canSave}
							className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{savePending ? 'Running…' : editItem ? 'Save changes' : 'Add to dashboard'}
						</button>
					</div>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
