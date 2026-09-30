import * as Ariakit from '@ariakit/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import type { ChartOptionsMap } from '~/containers/Downloads/chart-datasets'
import {
	defaultPresetName,
	extractQueryConfig,
	generatePresetId,
	type QuerySavedConfig
} from '~/containers/Downloads/savedDownloads'
import type { ChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { Editor, type EditorHandle } from '~/containers/Downloads/sql/Editor'
import type { ExampleQuery } from '~/containers/Downloads/sql/examples'
import { runSql, type ExecutorCtx } from '~/containers/Downloads/sql/executor'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import { Keycap } from '~/containers/Downloads/sql/primitives'
import { ResultsPanel } from '~/containers/Downloads/sql/ResultsPanel'
import { useDuckDB } from '~/containers/Downloads/sql/useDuckDB'
import { useTableRegistry, type RegisteredTable, type TableSource } from '~/containers/Downloads/sql/useTableRegistry'
import { useSavedDownloads } from '~/contexts/LocalStorage'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { formatNumber } from '~/utils/numberFormat'
import { requestDashboardItemReveal } from '../../hooks/useDashboardItemDeepLink'
import { useProDashboardEditorActions } from '../../ProDashboardAPIContext'
import { clampRowCap, SQL_SNAPSHOT_ROW_CAP_MAX, SQL_SNAPSHOT_ROW_CAP_MIN } from '../../sqlSnapshot'
import type { SqlChartConfig } from '../../types'
import { ProButton } from '../../ui'
import type { DashboardItemPlacement } from '../../useDashboardActions'
import { buildSqlChartConfig } from './buildSqlChartConfig'
import { loadChartOptions } from './chartOptions'
import { SqlChartModalSidebar } from './SqlChartModalSidebar'
import {
	collectLoadedTables,
	initialSqlChartModalState,
	prepareSources,
	reusableResult,
	settleRun,
	sqlChartModalControls,
	sqlChartModalReducer,
	type RunResponse
} from './sqlChartModalState'

interface SqlChartModalProps {
	editItem?: SqlChartConfig | null
	placement?: DashboardItemPlacement
	isOpen?: boolean
	onClose: () => void
	onClosed?: () => void
	onSaved?: () => void
}

type RunOutcome = { result: QueryResult; chartConfig: ChartConfig; tables: Array<RegisteredTable> }

async function runWithSources(
	context: ExecutorCtx,
	sql: string,
	sources: Array<TableSource>,
	options: Parameters<typeof runSql>[2],
	signal: AbortSignal
): Promise<RunResponse> {
	return (await prepareSources(context, sources, signal)) ?? runSql(context, sql, options, undefined, signal)
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
	const [displayMode, setDisplayMode] = useState<'chart' | 'table'>(editItem?.displayMode ?? 'chart')
	const [rowCap, setRowCap] = useState(clampRowCap(editItem?.rowCap))
	const [state, dispatch] = useReducer(sqlChartModalReducer, editItem, initialSqlChartModalState)
	const { result, chartConfig, queryError, durationMs } = state

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
		dispatch({ type: 'stopRequested' })
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
			dispatch({ type: 'runStarted', saving, taskId })
			const { tables, loadSource } = collectLoadedTables(loadedTables, loadTable)
			const res = await runWithSources(
				{ conn: duckdb.conn, loadedTables: tables, loadSource, chartOptionsMap },
				trimmed,
				sources,
				{
					onLoadingStage: (stage) => {
						if (runControllerRef.current === controller && !controller.signal.aborted)
							dispatch({ type: 'stageChanged', stage })
					}
				},
				controller.signal
			).catch((error: unknown): RunResponse => ({
				ok: false,
				cancelled: false,
				error: error instanceof Error ? error.message : 'Could not load query sources'
			}))
			if (runControllerRef.current !== controller) return null
			// A mounted editor must unlock after Stop, but an aborted result must never reach Save.
			runControllerRef.current = null
			const settlement = settleRun(res, {
				aborted: controller.signal.aborted,
				sql: trimmed,
				chartConfig: chartConfigRef.current
			})
			dispatch({ type: 'runSettled', settlement })
			return settlement.kind === 'completed'
				? { result: settlement.result, chartConfig: settlement.chartConfig, tables }
				: null
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
		},
		// Ariakit reports mounted = false once the exit transition ends, never on a first render that starts closed.
		setMounted: (mounted) => {
			if (!mounted) onClosed?.()
		}
	})

	const editorLineCount = sql.split('\n').length
	const editorHeight = `${(Math.min(Math.max(editorLineCount + 1, 6), 22) * 19 + 16).toString()}px`

	const resultRowCount = result?.rows.length ?? null
	const engineLoading = duckdb.status === 'loading'
	const engineError = duckdb.status === 'error'
	const controls = sqlChartModalControls(state, {
		sql,
		engine: duckdb.status,
		schemaLoading: !!schemaLoading,
		editing: !!editItem
	})
	const { running, locked: savePending, stage: loadingStage, canSave } = controls

	const handleSave = useCallback(async () => {
		if (!canSave || runControllerRef.current) return
		const reusable = reusableResult(state, sql)
		let outcome: RunOutcome | null = reusable ? { ...reusable, tables: loadedTables } : null
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
			ranFresh: ranForSave || state.ranFresh,
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
		state,
		run,
		editItem,
		name,
		sql,
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
								disabled={controls.run.disabled}
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
								{controls.run.label}
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
							{controls.queryChanged ? (
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
							onChartConfigChange={(next) => dispatch({ type: 'chartConfigChanged', chartConfig: next ?? undefined })}
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
							dispatch({ type: 'sourceLoadStarted' })
							const controller = new AbortController()
							runControllerRef.current = controller
							return loadTable(source, controller.signal).finally(() => {
								if (runControllerRef.current === controller) runControllerRef.current = null
							})
						}}
						schemaLoading={schemaLoading}
						schemaError={schemaError}
						busyTaskId={state.execution?.taskId ?? null}
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
					{controls.status}
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
							disabled={controls.save.disabled}
							render={<ProButton variant="primary" {...(savePending ? { icon: <LoadingSpinner size={14} /> } : {})} />}
						>
							{controls.save.label}
						</Ariakit.Button>
					</div>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
