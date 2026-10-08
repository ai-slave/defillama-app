import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { type ChartOptionsMap, fetchAllChartOptions } from '~/containers/Downloads/chart-datasets'
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
import { useMedia } from '~/hooks/useMedia'
import { useStableCallback } from '~/hooks/useStableCallback'
import { Button } from '~/ui/Button'
import {
	Dialog,
	DialogCancelButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	DialogToolbar,
	useRefusal
} from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { formatNumber } from '~/utils/numberFormat'
import { requestDashboardItemReveal } from '../../hooks/useDashboardItemDeepLink'
import { useProDashboardEditorActions } from '../../ProDashboardAPIContext'
import { clampRowCap, SQL_SNAPSHOT_ROW_CAP_MAX, SQL_SNAPSHOT_ROW_CAP_MIN } from '../../sqlSnapshot'
import type { SqlChartConfig } from '../../types'
import type { DashboardItemPlacement } from '../../useDashboardActions'
import { buildSqlChartConfig } from './buildSqlChartConfig'
import { SqlChartModalSidebar } from './SqlChartModalSidebar'
import {
	collectLoadedTables,
	initialSqlChartModalState,
	prepareSources,
	reusableResult,
	settleRun,
	sqlChartModalControls,
	sqlChartModalReducer,
	sqlDraftSnapshot,
	type RunResponse
} from './sqlChartModalState'

interface SqlChartModalProps {
	editItem?: SqlChartConfig | null
	placement?: DashboardItemPlacement
	isOpen: boolean
	onClose: () => void
	onClosed: () => void
	onSaved: () => void
}

const NO_CHART_OPTIONS: ChartOptionsMap = {}
// Chart dataset options name the `chart_*` tables a query can read. They are the same for every card, so one
// load serves the page, as the module promise it replaces did.
const chartOptionsQuery = {
	queryKey: ['sql-chart-options'],
	queryFn: fetchAllChartOptions,
	staleTime: Infinity,
	gcTime: Infinity
} as const

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

type SqlPane = 'query' | 'results' | 'reference'
const SQL_PANES = [
	{ value: 'query', label: 'Query' },
	{ value: 'results', label: 'Results' },
	{ value: 'reference', label: 'Reference' }
] as const

export function SqlChartModal({ editItem, placement, isOpen, onClose, onClosed, onSaved }: SqlChartModalProps) {
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
	const [schemaParams, setSchemaParams] = useState<Record<string, string>>({})
	const savedQueries = useMemo(
		() => savedDownloads.filter((d): d is QuerySavedConfig => d.kind === 'query'),
		[savedDownloads]
	)

	const { data: chartOptionsMap = NO_CHART_OPTIONS } = useQuery(chartOptionsQuery)
	const [sql, setSql] = useState(editItem?.query.sql ?? '')
	const [name, setName] = useState(editItem?.name ?? '')
	const [displayMode, setDisplayMode] = useState<'chart' | 'table'>(editItem?.displayMode ?? 'chart')
	const [rowCap, setRowCap] = useState(clampRowCap(editItem?.rowCap))
	const [state, dispatch] = useReducer(sqlChartModalReducer, editItem, initialSqlChartModalState)
	const { result, chartConfig, queryError, durationMs } = state

	const editorRef = useRef<EditorHandle | null>(null)
	const runControllerRef = useRef<AbortController | null>(null)

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

	// Called after the run's await, so it reads the chart setup of the latest render: edits made while the
	// query ran carry over to its columns.
	const settle = useStableCallback((res: RunResponse, aborted: boolean, query: string) => {
		const settlement = settleRun(res, { aborted, sql: query, chartConfig })
		dispatch({ type: 'runSettled', settlement })
		return settlement
	})

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
			const settlement = settle(res, controller.signal.aborted, trimmed)
			return settlement.kind === 'completed'
				? { result: settlement.result, chartConfig: settlement.chartConfig, tables }
				: null
		},
		[duckdb.conn, loadedTables, loadTable, schemaLoading, chartOptionsMap, settle]
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

	// The draft as it opened: leaving with the query, name, card or chart settings changed asks first.
	const draftSnapshot = sqlDraftSnapshot(state, { sql, name, rowCap, displayMode })
	const [openedSnapshot] = useState(draftSnapshot)
	const dirty = draftSnapshot !== openedSnapshot
	// A refusal describes the draft that was refused; any edit since clears it.
	const [refusalReason, setRefusal] = useRefusal(draftSnapshot)

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
		const written = editItem ? handleEditItem(config.id, config) : handleAddSqlChart(config, placement)
		if (written.status === 'refused') {
			// The dashboard refused the card (still loading, or over the size limit): keep the draft and say why.
			// Keyed to the draft as it now renders: a run for this save may have adapted the chart setup.
			const draft = sqlDraftSnapshot({ ...state, chartConfig: outcome.chartConfig }, { sql, name, rowCap, displayMode })
			setRefusal({ draft, reason: written.reason })
			return
		}
		const queryInput = extractQueryConfig({
			sql: config.query.sql,
			tables: config.query.tableSources,
			chartConfig: outcome.chartConfig
		})
		saveDownload({
			id: generatePresetId(),
			name: config.name ?? defaultPresetName(queryInput),
			createdAt: Date.now(),
			...queryInput
		})
		onSaved()
		if (!editItem) requestDashboardItemReveal(config.id)
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
		onSaved,
		setRefusal
	])

	// Below lg one pane shows at a time; a run that finishes there brings its results into view.
	const [pane, setPane] = useState<SqlPane>('query')
	const isNarrow = useMedia('(max-width: 1023px)')
	const runAndShow = (query: string) =>
		void run(query).then((outcome) => {
			if (outcome && isNarrow) setPane('results')
		})

	// Run and Save both need a query; pressing either without one says so under the editor, on the query pane.
	// The query pane is no form: Enter in the card name never saves, and the footer's Save is the only way to save
	// (as in Add card). The pane is the scope showFieldErrors searches.
	const queryPaneRef = useRef<HTMLDivElement>(null)
	const [submitted, setSubmitted] = useState(false)
	const sqlError = sql.trim() ? null : 'Enter a query.'
	const showSqlError = () =>
		showFieldErrors(queryPaneRef.current!, () => {
			setSubmitted(true)
			setPane('query')
		})
	const runOrExplain = () => (sqlError ? showSqlError() : runAndShow(sql))
	const handleSaveClick = () => {
		// While saving, the same button stops the run that the save started.
		if (savePending) return stopQuery()
		if (sqlError) return showSqlError()
		void handleSave()
	}

	return (
		// An outside tap never drops the query; Cancel, × and Escape ask first once it has changed.
		<Dialog
			size="xl"
			workspace
			open={isOpen}
			onClose={() => {
				runControllerRef.current?.abort()
				onClose()
			}}
			onClosed={onClosed}
			unmountOnHide
			portal
			hideOnInteractOutside={false}
		>
			{/* Leaving during Save stops its run instead, so it never asks. */}
			<DialogDiscardGuard
				when={dirty && !savePending}
				title="Discard this SQL chart?"
				description="Your query and card settings are not saved to the dashboard."
			/>
			<DialogHeader
				title={editItem ? 'Edit SQL chart' : 'New SQL chart'}
				actions={
					<Button
						variant="secondary"
						size="md"
						onClick={() => (running ? stopQuery() : runOrExplain())}
						disabled={controls.run.disabled}
						accessibleWhenDisabled
					>
						{running ? (
							<LoadingSpinner size={14} />
						) : (
							<svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
								<path d="M8 5v14l11-7z" />
							</svg>
						)}
						{controls.run.label}
						{!running ? (
							<span aria-hidden className="flex items-center gap-0.5 pointer-coarse:hidden">
								<Keycap muted>⌘</Keycap>
								<Keycap muted>↵</Keycap>
							</span>
						) : null}
					</Button>
				}
			/>
			<div className="lg:hidden">
				<DialogToolbar>
					<SegmentedControl<SqlPane>
						label="Editor view"
						options={SQL_PANES}
						value={pane}
						onValueChange={setPane}
						variant="solid-responsive"
						size="md"
					/>
				</DialogToolbar>
			</div>

			{/* Save owns this snapshot; keep Cancel and its status outside the locked editing region. */}
			<div
				inert={savePending}
				className="flex min-h-0 min-w-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_540px]"
			>
				<div
					className={`min-h-0 min-w-0 flex-1 flex-col lg:flex lg:overflow-y-auto ${pane === 'reference' ? 'hidden' : 'flex'}`}
				>
					<div
						ref={queryPaneRef}
						className={`min-h-0 flex-col gap-3 p-4 max-lg:flex-1 max-lg:overflow-y-auto lg:flex lg:pb-0 ${pane === 'query' ? 'flex' : 'hidden'}`}
					>
						<Field label="Card name (optional)" className="shrink-0">
							{(control) => (
								<Input
									{...control}
									type="text"
									value={name}
									readOnly={savePending}
									aria-busy={savePending || undefined}
									onChange={(e) => setName(e.target.value)}
								/>
							)}
						</Field>

						<Field label="SQL query" hideLabel error={submitted ? sqlError : null} className="shrink-0">
							{(control) => (
								<Editor
									{...control}
									ref={editorRef}
									value={sql}
									onChange={setSql}
									onRun={runOrExplain}
									tables={loadedTables}
									height={editorHeight}
									readOnly={savePending}
									autoFocus={!isNarrow}
								/>
							)}
						</Field>

						{loadingStage || engineLoading || engineError || controls.queryChanged ? (
							<div className="flex shrink-0 flex-wrap items-center gap-3">
								{loadingStage ? <span className="body-sm text-tertiary">{loadingStage}</span> : null}
								{engineLoading ? (
									<span className="body-sm text-tertiary">
										Loading the in-browser SQL engine… queries run locally, this takes a few seconds the first time.
									</span>
								) : null}
								{engineError ? (
									<span role="alert" className="body-sm text-error">
										SQL engine failed to load{duckdb.error ? `: ${duckdb.error}` : ''}.
									</span>
								) : null}
								{controls.queryChanged ? (
									<span className="body-sm text-tertiary">Query changed — Save will run it again.</span>
								) : null}
							</div>
						) : null}

						{queryError ? (
							<div
								role="alert"
								className="shrink-0 rounded-md border border-error-muted bg-error-tint px-3 py-2 body-sm text-error"
							>
								{queryError}
							</div>
						) : null}
					</div>
					<div
						className={`min-h-0 flex-col gap-3 p-4 max-lg:flex-1 max-lg:overflow-y-auto lg:flex ${pane === 'results' ? 'flex' : 'hidden'}`}
					>
						{resultRowCount !== null && resultRowCount > rowCap ? (
							<div className="shrink-0 rounded-md border border-warning-muted bg-warning-tint px-3 py-2 body-sm text-secondary">
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
						<div className="flex shrink-0 flex-wrap items-center gap-4">
							<span className="body-sm text-tertiary">
								{displayMode === 'table' ? 'Card shows the result as a table.' : 'Card shows the result as a chart.'}
							</span>
							<label className="flex items-center gap-2 label-sm text-tertiary">
								Rows to display
								<Input
									type="number"
									min={SQL_SNAPSHOT_ROW_CAP_MIN}
									max={SQL_SNAPSHOT_ROW_CAP_MAX}
									step={1}
									value={rowCap}
									readOnly={savePending}
									aria-busy={savePending || undefined}
									onChange={(e) => {
										const next = Number(e.target.value)
										if (Number.isFinite(next)) setRowCap(next)
									}}
									onBlur={() => setRowCap((prev) => clampRowCap(prev))}
									title={`How many query result rows the card can display (${SQL_SNAPSHOT_ROW_CAP_MIN}–${SQL_SNAPSHOT_ROW_CAP_MAX}). The card keeps a preview of the query result and refreshes it when requested.`}
									className="w-20"
								/>
							</label>
						</div>
					</div>
				</div>

				<div
					className={`min-h-0 flex-col p-4 max-lg:flex-1 lg:flex lg:pl-0 ${pane === 'reference' ? 'flex' : 'hidden'}`}
				>
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
						schemaParams={schemaParams}
						setSchemaParams={setSchemaParams}
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
			</div>

			<DialogFooter
				leading={
					refusalReason ? (
						<span role="alert" className="body-sm text-error">
							{refusalReason}
						</span>
					) : (
						<span role="status" className="body-sm text-tertiary">
							{controls.status}
						</span>
					)
				}
				dismiss={<DialogCancelButton />}
			>
				<Button
					variant="primary"
					size="md"
					onClick={handleSaveClick}
					disabled={controls.save.disabled}
					accessibleWhenDisabled
				>
					{savePending ? <LoadingSpinner size={14} /> : null}
					{controls.save.label}
				</Button>
			</DialogFooter>
		</Dialog>
	)
}
