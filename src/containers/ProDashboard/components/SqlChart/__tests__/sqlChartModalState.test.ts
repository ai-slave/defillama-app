import { expect, test } from 'vitest'
import type { ChartConfig } from '~/containers/Downloads/sql/chartConfig'
import type { RegisteredTable, TableSource } from '~/containers/Downloads/sql/useTableRegistry'
import {
	collectLoadedTables,
	initialSqlChartModalState,
	prepareSources,
	reusableResult,
	settleRun,
	sqlChartModalControls,
	sqlChartModalReducer,
	sqlDraftSnapshot,
	type SqlChartModalEvent,
	type SqlChartModalState
} from '../sqlChartModalState'

const lineChart: ChartConfig = {
	chartType: 'line',
	xCol: 'day',
	yCols: ['tvl'],
	splitByCol: null,
	stackMode: 'off',
	rightAxisCols: [],
	seriesKinds: {},
	seriesColors: {},
	numberFormat: 'auto'
}
const tvlResult = {
	columns: [
		{ name: 'day', type: 'DATE' },
		{ name: 'tvl', type: 'DOUBLE' }
	],
	rows: [['2024-01-01', 1]]
}
const feesResult = {
	columns: [
		{ name: 'day', type: 'DATE' },
		{ name: 'tvl', type: 'DOUBLE' },
		{ name: 'fees', type: 'DOUBLE' }
	],
	rows: [['2024-01-02', 2, 3]]
}
const saved: SqlChartModalState = {
	result: tvlResult,
	resultSql: 'SELECT day, tvl FROM t',
	ranFresh: false,
	chartConfig: lineChart,
	chartEdited: false,
	durationMs: null,
	queryError: null,
	execution: null
}
const ready = { sql: 'SELECT day, tvl FROM t', engine: 'ready', schemaLoading: false, editing: true } as const

function apply(state: SqlChartModalState, ...events: Array<SqlChartModalEvent>) {
	let next = state
	for (const event of events) next = sqlChartModalReducer(next, event)
	return next
}

test('an edited card opens with its saved snapshot, so Save needs no run', () => {
	const state = initialSqlChartModalState({
		id: 'sql',
		kind: 'sql',
		name: 'TVL',
		chart: lineChart,
		query: { sql: 'SELECT day, tvl FROM t', tableSources: [] },
		snapshot: { ...tvlResult, computedAt: '2024-01-01T00:00:00.000Z', rowCount: 1, engine: 'server' }
	})
	expect(reusableResult(state, 'SELECT day, tvl FROM t')).toEqual({ result: tvlResult, chartConfig: lineChart })
	expect(sqlChartModalControls(state, { ...ready, engine: 'loading' }).canSave).toBe(true)
})

test('a new card has nothing to save until its query runs', () => {
	const state = initialSqlChartModalState(null)
	expect(reusableResult(state, 'SELECT 1')).toBeNull()
	expect(sqlChartModalControls(state, { ...ready, sql: 'SELECT 1', engine: 'loading', editing: false })).toMatchObject({
		canSave: false,
		save: { label: 'Add to dashboard', disabled: true },
		run: { label: 'Run query', disabled: true }
	})
	// An empty query keeps Run and Save enabled: pressing them says "Enter a query." under the editor.
	expect(sqlChartModalControls(saved, { ...ready, sql: '   ', editing: false })).toMatchObject({
		canSave: true,
		run: { label: 'Run query', disabled: false }
	})
})

test('Save locks the draft and becomes the Stop control while its own run is in flight', () => {
	const state = apply(saved, { type: 'runStarted', saving: true, taskId: null })
	expect(sqlChartModalControls(state, { ...ready, sql: 'SELECT day, tvl, fees FROM t' })).toEqual({
		running: true,
		locked: true,
		stage: null,
		canSave: false,
		queryChanged: true,
		run: { label: 'Running…', disabled: true },
		save: { label: 'Stop query', disabled: false },
		status: 'Running query before saving. Stop query keeps your draft; Cancel closes the editor.'
	})
})

test('a plain run keeps the draft editable and shows its loading stage', () => {
	const state = apply(
		saved,
		{ type: 'runStarted', saving: false, taskId: 'saved:q1' },
		{ type: 'stageChanged', stage: 'Loading Chain TVL…' }
	)
	expect(state.execution).toEqual({ saving: false, taskId: 'saved:q1', stage: 'Loading Chain TVL…' })
	expect(sqlChartModalControls(state, ready)).toMatchObject({
		locked: false,
		canSave: false,
		run: { label: 'Stop query', disabled: false },
		status: 'Loading Chain TVL…'
	})
})

test('Stop disables the stop control until the run settles, then Run and Save return', () => {
	const running = apply(saved, { type: 'runStarted', saving: false, taskId: null }, { type: 'stopRequested' })
	expect(sqlChartModalControls(running, ready)).toMatchObject({
		run: { label: 'Stopping…', disabled: true },
		status: 'Stopping query…'
	})
	const saving = apply(saved, { type: 'runStarted', saving: true, taskId: null }, { type: 'stopRequested' })
	expect(sqlChartModalControls(saving, ready).save).toEqual({ label: 'Stopping…', disabled: true })

	const settled = apply(saving, { type: 'runSettled', settlement: { kind: 'cancelled' } })
	expect(settled).toEqual(saved)
	expect(sqlChartModalControls(settled, ready)).toMatchObject({
		locked: false,
		canSave: true,
		run: { label: 'Run query', disabled: false },
		save: { label: 'Save changes', disabled: false },
		status: ''
	})
})

test('an answer that arrives after Stop or Cancel is discarded, even a successful one', () => {
	const response = { ok: true, result: feesResult, durationMs: 4, justLoaded: false } as const
	expect(settleRun(response, { aborted: true, sql: 'SELECT *', chartConfig: lineChart })).toEqual({
		kind: 'cancelled'
	})
	expect(
		settleRun({ ok: false, error: 'Cancelled', cancelled: true }, { aborted: false, sql: 'x', chartConfig: lineChart })
	).toEqual({ kind: 'cancelled' })
	expect(settleRun({ ok: false, cancelled: true }, { aborted: false, sql: 'x', chartConfig: lineChart })).toEqual({
		kind: 'cancelled'
	})
})

test('a failed run shows its error and leaves Save available to retry', () => {
	const settlement = settleRun(
		{ ok: false, error: 'Query failed' },
		{ aborted: false, sql: 'x', chartConfig: undefined }
	)
	expect(settlement).toEqual({ kind: 'failed', error: 'Query failed' })
	const state = apply(saved, { type: 'runStarted', saving: true, taskId: null }, { type: 'runSettled', settlement })
	expect(state).toEqual({ ...saved, queryError: 'Query failed' })
	expect(sqlChartModalControls(state, ready).save).toEqual({ label: 'Save changes', disabled: false })
	expect(apply(state, { type: 'runStarted', saving: false, taskId: null }).queryError).toBeNull()
	expect(apply(state, { type: 'sourceLoadStarted' }).queryError).toBeNull()
})

test('a completed run keeps the chart set up while it ran and adapts it to the new columns', () => {
	const barChart = { ...lineChart, chartType: 'bar' } as const
	const settlement = settleRun(
		{ ok: true, result: feesResult, durationMs: 4, justLoaded: false },
		{ aborted: false, sql: 'SELECT day, tvl, fees FROM t', chartConfig: barChart }
	)
	expect(settlement).toEqual({
		kind: 'completed',
		sql: 'SELECT day, tvl, fees FROM t',
		result: feesResult,
		durationMs: 4,
		chartConfig: barChart
	})
	expect(apply(saved, { type: 'runStarted', saving: false, taskId: null }, { type: 'runSettled', settlement })).toEqual(
		{
			result: feesResult,
			resultSql: 'SELECT day, tvl, fees FROM t',
			ranFresh: true,
			chartConfig: barChart,
			chartEdited: false,
			durationMs: 4,
			queryError: null,
			execution: null
		}
	)
})

test('a first run without a chart picks a line chart of every numeric column', () => {
	expect(
		settleRun(
			{ ok: true, result: feesResult, durationMs: 4, justLoaded: false },
			{ aborted: false, sql: 'q', chartConfig: undefined }
		)
	).toMatchObject({ kind: 'completed', chartConfig: { ...lineChart, yCols: ['tvl', 'fees'] } })
})

test('a result from older SQL is flagged and Save runs the current draft instead of storing it', () => {
	expect(reusableResult(saved, '  SELECT day, tvl FROM t\n')).toEqual({ result: tvlResult, chartConfig: lineChart })
	expect(reusableResult(saved, 'SELECT day, tvl, fees FROM t')).toBeNull()
	const edited = { ...ready, sql: 'SELECT day, tvl, fees FROM t' }
	expect(sqlChartModalControls(saved, edited)).toMatchObject({ queryChanged: true, canSave: true })
	// Save must run the edited SQL, which needs the engine.
	expect(sqlChartModalControls(saved, { ...edited, engine: 'error' }).canSave).toBe(false)
	expect(sqlChartModalControls({ ...saved, result: null }, edited).queryChanged).toBe(false)
})

test('a result whose chart setup was cleared runs again on Save so the card gets a chart', () => {
	const cleared = apply(saved, { type: 'chartConfigChanged', chartConfig: undefined })
	expect(reusableResult(cleared, saved.resultSql)).toBeNull()
	expect(sqlChartModalControls(cleared, { ...ready, engine: 'loading' }).canSave).toBe(false)
})

test('schema loading blocks Run and Save', () => {
	expect(sqlChartModalControls(saved, { ...ready, schemaLoading: true })).toMatchObject({
		canSave: false,
		run: { label: 'Run query', disabled: true },
		save: { label: 'Save changes', disabled: true }
	})
})

const chainTvl: TableSource = { kind: 'chart', slug: 'chain-tvl', param: 'Ethereum' }
const chainFees: TableSource = { kind: 'chart', slug: 'chain-fees', param: 'Ethereum' }
function registered(name: string, source: TableSource): RegisteredTable {
	return { name, source, columns: [], rowCount: 1, loadedAt: 0 }
}

test('a saved query loads its missing chart sources and skips loaded tables and datasets', async () => {
	const loads: Array<TableSource> = []
	const outcome = await prepareSources(
		{
			loadedTables: [registered('ts_chain_tvl_ethereum', chainTvl)],
			loadSource: async (source) => {
				loads.push(source)
				return registered('ts_chain_fees_ethereum', source)
			}
		},
		[chainTvl, { kind: 'dataset', slug: 'protocols' }, chainFees],
		new AbortController().signal
	)
	expect(outcome).toBeNull()
	expect(loads).toEqual([chainFees])
})

test('a source that fails to load stops the query with a retryable error', async () => {
	const outcome = await prepareSources(
		{ loadedTables: [], loadSource: async () => null },
		[chainTvl, chainFees],
		new AbortController().signal
	)
	expect(outcome).toEqual({ ok: false, error: 'Could not load table "ts_chain_tvl_ethereum".' })
})

test('closing or stopping during source loading never loads the rest or runs the query', async () => {
	const controller = new AbortController()
	const loads: Array<TableSource> = []
	const outcome = await prepareSources(
		{
			loadedTables: [],
			loadSource: async (source) => {
				loads.push(source)
				controller.abort()
				return registered('ts_chain_tvl_ethereum', source)
			}
		},
		[chainTvl, chainFees],
		controller.signal
	)
	expect(outcome).toEqual({ ok: false, cancelled: true })
	expect(loads).toEqual([chainTvl])
	// An aborted load answers null; Stop must not surface that as a load failure.
	const stopped = new AbortController()
	const abortedLoad = await prepareSources(
		{
			loadedTables: [],
			loadSource: async () => {
				stopped.abort()
				return null
			}
		},
		[chainTvl],
		stopped.signal
	)
	expect(abortedLoad).toEqual({ ok: false, cancelled: true })
	expect(await prepareSources({ loadedTables: [], loadSource: async () => null }, [], controller.signal)).toEqual({
		ok: false,
		cancelled: true
	})
})

test('a run records the tables it loaded itself, so Save stores every source of its result', async () => {
	const loaded = registered('ts_chain_fees_ethereum', chainFees)
	const { tables, loadSource } = collectLoadedTables([registered('ts_chain_tvl_ethereum', chainTvl)], async (source) =>
		source === chainFees ? loaded : null
	)
	expect(await loadSource(chainFees)).toBe(loaded)
	expect(await loadSource({ kind: 'dataset', slug: 'missing' })).toBeNull()
	expect(tables.map((table) => table.source)).toEqual([chainTvl, chainFees])
})

test('an idle Save that cannot run says why', () => {
	const fresh = initialSqlChartModalState(null)
	const status = (overrides: Partial<Parameters<typeof sqlChartModalControls>[1]>) =>
		sqlChartModalControls(fresh, { ...ready, editing: false, ...overrides }).status
	expect(status({ schemaLoading: true })).toBe('Loading tables…')
	expect(status({ engine: 'loading' })).toBe('Waiting for the SQL engine to load…')
	expect(status({ engine: 'error' })).toBe('The SQL engine failed to load.')
	// An edited card's saved snapshot saves without the engine, so there is nothing to explain.
	expect(sqlChartModalControls(saved, { ...ready, engine: 'loading' }).status).toBe('')
})

test('a run that adapts the saved chart leaves the draft unchanged, and changing only its chart type does not', () => {
	const draft = { sql: 'SELECT day, tvl FROM t', name: 'TVL', rowCap: 1000, displayMode: 'chart' } as const
	const opened = sqlDraftSnapshot(saved, draft)
	const settlement = settleRun(
		{ ok: true, result: feesResult, durationMs: 4, justLoaded: false },
		{ aborted: false, sql: draft.sql, chartConfig: lineChart }
	)
	const ran = apply(saved, { type: 'runStarted', saving: false, taskId: null }, { type: 'runSettled', settlement })
	expect(sqlDraftSnapshot(ran, draft) === opened).toBe(true)
	const toBar = apply(ran, { type: 'chartConfigChanged', chartConfig: { ...lineChart, chartType: 'bar' } })
	expect(sqlDraftSnapshot(toBar, draft) === opened).toBe(false)
})
