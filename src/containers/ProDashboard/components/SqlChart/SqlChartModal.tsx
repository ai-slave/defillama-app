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
import {
	tableNameFor,
	useTableRegistry,
	type RegisteredTable,
	type TableSource
} from '~/containers/Downloads/sql/useTableRegistry'
import { useSavedDownloads } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { formatNumber } from '~/utils/numberFormat'
import { requestDashboardItemReveal } from '../../hooks/useDashboardItemDeepLink'
import { useProDashboardEditorActions } from '../../ProDashboardAPIContext'
import { clampRowCap, snapshotToResult, SQL_SNAPSHOT_ROW_CAP_MAX, SQL_SNAPSHOT_ROW_CAP_MIN } from '../../sqlSnapshot'
import type { SqlChartConfig } from '../../types'
import { ProButton } from '../../ui'
import type { DashboardItemPlacement } from '../../useDashboardActions'
import { buildSqlChartConfig } from './buildSqlChartConfig'
import { loadChartOptions } from './chartOptions'
import { SqlChartModalSidebar } from './SqlChartModalSidebar'

interface SqlChartModalProps {
	editItem?: SqlChartConfig | null
	placement?: DashboardItemPlacement
	isOpen?: boolean
	onClose: () => void
	onClosed?: () => void
	onSaved?: () => void
}

type RunOutcome = { result: QueryResult; chartConfig: ChartConfig; tables: Array<RegisteredTable> }
type Execution = { saving: boolean; taskId: string | null; stage: string | null; stopping?: boolean }

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
			const loaded = await context.loadSource(source, signal)
			if (signal.aborted) return { ok: false, cancelled: true } as const
			if (!loaded) return { ok: false, error: `Could not load table "${tableNameFor(source)}".` } as const
			loadedNames.add(loaded.name)
		}
	}
	if (signal.aborted) return { ok: false, cancelled: true } as const
	return runSql(context, sql, options, undefined, signal)
}

export function SqlChartModal({ editItem, placement, isOpen = true, onClose, onClosed, onSaved }: SqlChartModalProps) {
	const { authorizedFetch } = useAuthContext()
	const { handleAddSqlChart, handleEditItem } = useProDashboardEditorActions()
	const duckdb = useDuckDB()
	const {
		tables: loadedTables,
		load: loadTable,
		loading: schemaLoading,
		error: schemaError
	} = useTableRegistry({ conn: duckdb.conn ?? null, authorizedFetch })
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
	const [execution, setExecution] = useState<Execution | null>(null)
	const running = execution !== null
	const savePending = execution?.saving ?? false
	const loadingStage = execution?.stage ?? null
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

	useEffect(
		() => () => {
			runControllerRef.current?.abort()
			runControllerRef.current = null
		},
		[]
	)

	const stopQuery = () => {
		const controller = runControllerRef.current
		if (!controller || controller.signal.aborted) return
		setExecution((current) => (current ? { ...current, stopping: true } : current))
		controller.abort()
	}

	const run = useCallback(
		async (
			query: string,
			{
				sources = [],
				saving = false,
				taskId = null
			}: {
				sources?: Array<TableSource>
				saving?: boolean
				taskId?: string | null
			} = {}
		): Promise<RunOutcome | null> => {
			// Shortcuts and sidebar actions share the same ownership gate as the buttons.
			if (!duckdb.conn || runControllerRef.current || schemaLoading) return null
			const trimmed = query.trim()
			if (!trimmed) return null
			const controller = new AbortController()
			runControllerRef.current = controller
			setExecution({ saving, taskId, stage: null })
			setQueryError(null)
			// React's registry snapshot predates auto-loading. Carry the loaded sources with this result.
			const tables = [...loadedTables]
			const loadSource = async (source: TableSource, signal?: AbortSignal) => {
				const table = await loadTable(source, signal)
				if (table) tables.push(table)
				return table
			}
			const res = await runWithSources(
				{ conn: duckdb.conn, loadedTables: tables, loadSource, chartOptionsMap },
				trimmed,
				sources,
				{
					onLoadingStage: (stage) => {
						if (runControllerRef.current === controller && !controller.signal.aborted)
							setExecution({ saving, taskId, stage })
					}
				},
				controller.signal
			).catch((error: unknown) => ({
				ok: false as const,
				cancelled: false,
				error: error instanceof Error ? error.message : 'Could not load query sources'
			}))
			if (runControllerRef.current !== controller) return null
			// A mounted editor must unlock after Stop, but an aborted result must never reach Save.
			runControllerRef.current = null
			setExecution(null)
			if (controller.signal.aborted) return null
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
				return { result: res.result, chartConfig: nextChartConfig, tables }
			}
			if ('error' in res && !res.cancelled) setQueryError(res.error)
			return null
		},
		[duckdb.conn, loadedTables, loadTable, schemaLoading, chartOptionsMap]
	)

	const applyQuery = useCallback(
		(taskId: string, title: string, nextSql: string, tables?: Array<TableSource>, overwriteName?: boolean) => {
			if (runControllerRef.current || schemaLoading) return
			setSql(nextSql)
			setName((prev) => (overwriteName ? title : prev.trim() ? prev : title))
			void run(nextSql, { sources: tables, taskId })
		},
		[schemaLoading, run]
	)

	const handleClose = () => {
		runControllerRef.current?.abort()
		onClose()
	}

	const dialogStore = Ariakit.useDialogStore({
		open: isOpen,
		setOpen: (open) => {
			if (!open) handleClose()
		}
	})
	const isMounted = Ariakit.useStoreState(dialogStore, 'mounted')
	const wasMountedRef = useRef(false)
	useEffect(() => {
		if (isMounted) {
			wasMountedRef.current = true
			return
		}
		if (!wasMountedRef.current) return
		wasMountedRef.current = false
		onClosed?.()
	}, [isMounted, onClosed])

	const editorLineCount = sql.split('\n').length
	const editorHeight = `${(Math.min(Math.max(editorLineCount + 1, 6), 22) * 19 + 16).toString()}px`

	const isDirty = sql.trim() !== resultSql
	const resultRowCount = result?.rows.length ?? null
	const needsRun = isDirty || !result || !chartConfig
	const engineLoading = duckdb.status === 'loading'
	const engineError = duckdb.status === 'error'
	const canSave = !!sql.trim() && !running && !schemaLoading && !(needsRun && (engineLoading || engineError))

	const handleSave = useCallback(async () => {
		if (!canSave || runControllerRef.current) return
		let outcome: RunOutcome | null =
			!needsRun && result && chartConfig ? { result, chartConfig, tables: loadedTables } : null
		let ranForSave = false
		if (!outcome) {
			outcome = await run(sql, { saving: true })
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
			registryTables: outcome.tables
		})
		let addedId: false | string = false
		if (editItem) {
			handleEditItem(config.id, config)
		} else {
			addedId = handleAddSqlChart(config, placement)
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
		if (onSaved) onSaved()
		else onClose()
		if (addedId) requestDashboardItemReveal(addedId)
	}, [
		canSave,
		needsRun,
		result,
		chartConfig,
		run,
		editItem,
		name,
		sql,
		ranFresh,
		displayMode,
		rowCap,
		loadedTables,
		handleEditItem,
		handleAddSqlChart,
		placement,
		saveDownload,
		onClose,
		onSaved
	])

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog
				unmountOnHide
				portal
				hideOnInteractOutside={false}
				className="fixed inset-0 z-50 flex flex-col gap-3 overflow-hidden bg-surface p-3 pro-dashboard md:inset-4 md:scale-[.98] md:rounded-xl md:border md:border-pro-cards-border md:p-4 md:opacity-0 md:shadow-dialog md:transition-[opacity,scale] md:duration-260 md:ease-out-quart md:data-enter:scale-100 md:data-enter:opacity-100 md:data-leave:duration-200"
			>
				<div className="flex shrink-0 items-center justify-between">
					<Ariakit.DialogHeading
						render={<h2>{editItem ? 'Edit SQL chart' : 'New SQL chart'}</h2>}
						className="text-xl font-semibold text-pro-text-primary"
					/>
					<Ariakit.DialogDismiss render={<ProButton size="md" square variant="ghost" />}>
						<Icon name="x" height={16} width={16} />
						<span className="sr-only">Close dialog</span>
					</Ariakit.DialogDismiss>
				</div>

				{/* Save owns this snapshot; keep Cancel and its status outside the locked editing region. */}
				<div
					inert={savePending}
					className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_540px] lg:overflow-hidden"
				>
					<div className="flex min-h-0 min-w-0 shrink-0 flex-col gap-3 pr-1 lg:shrink lg:overflow-y-auto">
						<input
							type="text"
							value={name}
							readOnly={savePending}
							onChange={(e) => setName(e.target.value)}
							aria-label="Card name"
							placeholder="Optional"
							className="shrink-0 rounded-md border border-pro-cards-border bg-page px-3 py-2 text-sm text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden"
						/>

						<div className="shrink-0">
							<Editor
								ref={editorRef}
								value={sql}
								onChange={setSql}
								onRun={() => void run(sql)}
								tables={loadedTables}
								height={editorHeight}
								readOnly={savePending}
							/>
						</div>

						<div className="flex shrink-0 flex-wrap items-center gap-3">
							<Ariakit.Button
								type="button"
								onClick={() => (running ? stopQuery() : void run(sql))}
								disabled={
									savePending ||
									(running ? execution.stopping : !!schemaLoading || engineLoading || engineError || !sql.trim())
								}
								accessibleWhenDisabled
								{...(engineLoading
									? { title: 'The in-browser SQL engine is still loading, this takes a few seconds the first time.' }
									: {})}
								render={
									<ProButton
										variant="primary"
										icon={
											running ? (
												<LoadingSpinner size={14} />
											) : (
												<svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
													<path d="M8 5v14l11-7z" />
												</svg>
											)
										}
									/>
								}
							>
								{savePending ? 'Running…' : execution?.stopping ? 'Stopping…' : running ? 'Stop query' : 'Run query'}
								{!running ? (
									<span aria-hidden className="flex items-center gap-0.5">
										<Keycap muted>⌘</Keycap>
										<Keycap muted>↵</Keycap>
									</span>
								) : null}
							</Ariakit.Button>
							{loadingStage ? <span className="text-xs text-pro-text-tertiary">{loadingStage}</span> : null}
							{engineLoading ? (
								<span className="text-xs text-pro-text-tertiary">
									Loading the in-browser SQL engine… queries run locally, this takes a few seconds the first time.
								</span>
							) : null}
							{engineError ? (
								<span role="alert" className="text-xs text-error">
									SQL engine failed to load{duckdb.error ? `: ${duckdb.error}` : ''}.
								</span>
							) : null}
							{isDirty && result ? (
								<span className="text-xs text-pro-text-tertiary">Query changed — Save will run it again.</span>
							) : null}
						</div>

						{queryError ? (
							<div
								role="alert"
								className="shrink-0 rounded-md border border-error/40 bg-error/10 px-3 py-2 text-xs text-error"
							>
								{queryError}
							</div>
						) : null}

						{resultRowCount !== null && resultRowCount > rowCap ? (
							<div className="shrink-0 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-pro-text-secondary">
								Result has {formatNumber(resultRowCount)} rows. The card will show the first {formatNumber(rowCap)}{' '}
								rows.
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
						loadedTables={loadedTables}
						onLoadTable={async (source) => {
							if (runControllerRef.current) return null
							setQueryError(null)
							const controller = new AbortController()
							runControllerRef.current = controller
							return loadTable(source, controller.signal).finally(() => {
								if (runControllerRef.current === controller) runControllerRef.current = null
							})
						}}
						schemaLoading={schemaLoading}
						schemaError={schemaError}
						busyTaskId={execution?.taskId ?? null}
						savedQueries={savedQueries}
						onApplyExample={(example: ExampleQuery) =>
							applyQuery(`example:${example.title}`, example.title, example.sql, example.tables)
						}
						onApplySaved={(query: QuerySavedConfig) =>
							applyQuery(`saved:${query.id}`, query.name, query.sql, query.tables, true)
						}
						onReplaceSql={setSql}
						onInsertAtCursor={(text) => editorRef.current?.insertSnippet(text)}
						onApplyAndRun={(snippet) => {
							if (runControllerRef.current || schemaLoading) return
							setSql(snippet)
							void run(snippet)
						}}
					/>
				</div>

				<span role="status" className="text-xs text-pro-text-tertiary">
					{execution?.stopping
						? 'Stopping query…'
						: savePending
							? 'Running query before saving. Stop query keeps your draft; Cancel closes the editor.'
							: running
								? (loadingStage ?? 'Running query…')
								: ''}
				</span>
				<div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-pro-cards-border pt-3">
					<div className="flex flex-wrap items-center gap-4">
						<span className="text-xs text-pro-text-tertiary">
							{displayMode === 'table' ? 'Card shows the result as a table.' : 'Card shows the result as a chart.'}
						</span>
						<label className="flex items-center gap-2 text-xs text-pro-text-tertiary">
							Rows to display
							<input
								type="number"
								min={SQL_SNAPSHOT_ROW_CAP_MIN}
								max={SQL_SNAPSHOT_ROW_CAP_MAX}
								step={1}
								value={rowCap}
								readOnly={savePending}
								onChange={(e) => {
									const next = Number(e.target.value)
									if (Number.isFinite(next)) setRowCap(next)
								}}
								onBlur={() => setRowCap((prev) => clampRowCap(prev))}
								title={`How many query result rows the card can display (${SQL_SNAPSHOT_ROW_CAP_MIN}–${SQL_SNAPSHOT_ROW_CAP_MAX}). The card keeps a preview of the query result and refreshes it when requested.`}
								className="w-20 rounded-md border border-pro-cards-border bg-page px-2 py-1 text-xs text-pro-text-primary focus:ring-1 focus:ring-brand focus:outline-hidden"
							/>
						</label>
					</div>
					<div className="flex items-center gap-2">
						<ProButton type="button" variant="secondary" onClick={handleClose}>
							Cancel
						</ProButton>
						<Ariakit.Button
							type="button"
							onClick={() => (savePending ? stopQuery() : void handleSave())}
							accessibleWhenDisabled
							disabled={savePending ? execution?.stopping : !canSave}
							render={<ProButton variant="primary" {...(savePending ? { icon: <LoadingSpinner size={14} /> } : {})} />}
						>
							{savePending
								? execution?.stopping
									? 'Stopping…'
									: 'Stop query'
								: editItem
									? 'Save changes'
									: 'Add to dashboard'}
						</Ariakit.Button>
					</div>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
