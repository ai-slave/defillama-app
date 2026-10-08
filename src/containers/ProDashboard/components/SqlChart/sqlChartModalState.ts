import { defaultChartConfig, migrateChartConfig, type ChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { classifyColumns } from '~/containers/Downloads/sql/columnKind'
import type { ExecutorCtx, ExecutorResult } from '~/containers/Downloads/sql/executor'
import type { QueryResult } from '~/containers/Downloads/sql/exportResults'
import type { DuckDBStatus } from '~/containers/Downloads/sql/useDuckDB'
import { tableNameFor, type RegisteredTable, type TableSource } from '~/containers/Downloads/sql/useTableRegistry'
import { snapshotToResult } from '../../sqlSnapshot'
import type { SqlChartConfig } from '../../types'

type Execution = { saving: boolean; taskId: string | null; stage: string | null; stopping?: boolean }

export type SqlChartModalState = {
	result: QueryResult | null
	// The trimmed SQL that produced `result`; a draft that differs must run again before Save.
	resultSql: string
	ranFresh: boolean
	chartConfig: ChartConfig | undefined
	// The reader changed the chart setup. A run adapts the setup to new columns on its own, which is not an edit.
	chartEdited: boolean
	durationMs: number | null
	queryError: string | null
	// One run at a time owns the editor: a plain Run, a sidebar action, or Save's own run.
	execution: Execution | null
}

type SourcePreparation = { ok: false; cancelled: true } | { ok: false; error: string } | null
export type RunResponse = ExecutorResult | { ok: false; cancelled: true }

export type RunSettlement =
	| { kind: 'completed'; sql: string; result: QueryResult; durationMs: number; chartConfig: ChartConfig }
	| { kind: 'failed'; error: string }
	| { kind: 'cancelled' }

export type SqlChartModalEvent =
	| { type: 'runStarted'; saving: boolean; taskId: string | null }
	| { type: 'stageChanged'; stage: string | null }
	| { type: 'stopRequested' }
	| { type: 'runSettled'; settlement: RunSettlement }
	| { type: 'sourceLoadStarted' }
	| { type: 'chartConfigChanged'; chartConfig: ChartConfig | undefined }

export function initialSqlChartModalState(editItem: SqlChartConfig | null | undefined): SqlChartModalState {
	return {
		result: editItem?.snapshot ? snapshotToResult(editItem.snapshot) : null,
		resultSql: editItem?.query.sql ?? '',
		ranFresh: false,
		chartConfig: editItem?.chart,
		chartEdited: false,
		durationMs: null,
		queryError: null,
		execution: null
	}
}

export function sqlChartModalReducer(state: SqlChartModalState, event: SqlChartModalEvent): SqlChartModalState {
	switch (event.type) {
		case 'runStarted':
			return { ...state, execution: { saving: event.saving, taskId: event.taskId, stage: null }, queryError: null }
		case 'stageChanged':
			return state.execution ? { ...state, execution: { ...state.execution, stage: event.stage } } : state
		case 'stopRequested':
			return state.execution ? { ...state, execution: { ...state.execution, stopping: true } } : state
		case 'runSettled': {
			const { settlement } = event
			if (settlement.kind === 'cancelled') return { ...state, execution: null }
			if (settlement.kind === 'failed') return { ...state, execution: null, queryError: settlement.error }
			return {
				...state,
				execution: null,
				result: settlement.result,
				resultSql: settlement.sql,
				ranFresh: true,
				durationMs: settlement.durationMs,
				chartConfig: settlement.chartConfig
			}
		}
		case 'sourceLoadStarted':
			return { ...state, queryError: null }
		case 'chartConfigChanged':
			return { ...state, chartConfig: event.chartConfig, chartEdited: true }
	}
}

/** What leaving would lose and what a refusal describes: the query, name and card settings, and the chart setup once
    the reader changed it. */
export function sqlDraftSnapshot(
	state: SqlChartModalState,
	draft: { sql: string; name: string; rowCap: number; displayMode: 'chart' | 'table' }
): string {
	return JSON.stringify({ ...draft, chart: state.chartEdited ? state.chartConfig : null })
}

/**
 * Turns a finished run into what the editor keeps. A stopped or closed run never reaches the
 * result or Save, even when the engine answered before the abort landed. `chartConfig` is the
 * chart setup at completion time, so edits made while the query ran carry over to the new columns.
 */
export function settleRun(
	response: RunResponse,
	{ aborted, sql, chartConfig }: { aborted: boolean; sql: string; chartConfig: ChartConfig | undefined }
): RunSettlement {
	if (aborted) return { kind: 'cancelled' }
	if (response.ok) {
		const classified = classifyColumns(response.result)
		return {
			kind: 'completed',
			sql,
			result: response.result,
			durationMs: response.durationMs,
			chartConfig: chartConfig ? migrateChartConfig(chartConfig, classified) : defaultChartConfig(classified)
		}
	}
	if ('error' in response && !response.cancelled) return { kind: 'failed', error: response.error }
	return { kind: 'cancelled' }
}

/** Loads the chart sources a saved or example query needs before its SQL runs; null means ready. */
export async function prepareSources(
	context: Pick<ExecutorCtx, 'loadedTables' | 'loadSource'>,
	sources: Array<TableSource>,
	signal: AbortSignal
): Promise<SourcePreparation> {
	const loadedNames = new Set(context.loadedTables.map((table) => table.name))
	for (const source of sources) {
		if (signal.aborted) return { ok: false, cancelled: true }
		if (source.kind === 'chart' && !loadedNames.has(tableNameFor(source))) {
			const loaded = await context.loadSource(source, signal)
			if (signal.aborted) return { ok: false, cancelled: true }
			if (!loaded) return { ok: false, error: `Could not load table "${tableNameFor(source)}".` }
			loadedNames.add(loaded.name)
		}
	}
	if (signal.aborted) return { ok: false, cancelled: true }
	return null
}

/**
 * React's registry snapshot predates the tables a run loads itself, so the run carries its own list
 * and Save records every source the result came from.
 */
export function collectLoadedTables(loadedTables: Array<RegisteredTable>, load: ExecutorCtx['loadSource']) {
	const tables = [...loadedTables]
	const loadSource: ExecutorCtx['loadSource'] = async (source, signal) => {
		const table = await load(source, signal)
		if (table) tables.push(table)
		return table
	}
	return { tables, loadSource }
}

/** The result Save can store without running again: only one produced by the current draft SQL. */
export function reusableResult(state: SqlChartModalState, sql: string) {
	if (!state.result || !state.chartConfig || sql.trim() !== state.resultSql) return null
	return { result: state.result, chartConfig: state.chartConfig }
}

export function sqlChartModalControls(
	state: SqlChartModalState,
	{
		sql,
		engine,
		schemaLoading,
		editing
	}: { sql: string; engine: DuckDBStatus; schemaLoading: boolean; editing: boolean }
) {
	const { execution } = state
	const running = execution !== null
	// Save owns its snapshot while its run is in flight, so the draft fields lock.
	const locked = execution?.saving ?? false
	const stopping = execution?.stopping === true
	const stage = execution?.stage ?? null
	const isDirty = sql.trim() !== state.resultSql
	const needsRun = !reusableResult(state, sql)
	const engineUnavailable = engine !== 'ready'
	// An empty query is not a reason to disable: Run and Save say "Enter a query." under the editor instead.
	const canSave = !running && !schemaLoading && !(needsRun && engineUnavailable)
	return {
		running,
		locked,
		stage,
		canSave,
		queryChanged: isDirty && !!state.result,
		run: {
			label: locked ? 'Running…' : stopping ? 'Stopping…' : running ? 'Stop query' : 'Run query',
			disabled: locked || (running ? stopping : schemaLoading || engineUnavailable)
		},
		save: {
			label: locked ? (stopping ? 'Stopping…' : 'Stop query') : editing ? 'Save changes' : 'Add to dashboard',
			disabled: locked ? stopping : !canSave
		},
		status: stopping
			? 'Stopping query…'
			: locked
				? 'Running query before saving. Stop query keeps your draft; Cancel closes the editor.'
				: running
					? (stage ?? 'Running query…')
					: // An idle Save that cannot run says why, in the row it sits in.
						schemaLoading
						? 'Loading tables…'
						: needsRun && engine === 'error'
							? 'The SQL engine failed to load.'
							: needsRun && engineUnavailable
								? 'Waiting for the SQL engine to load…'
								: ''
	}
}
