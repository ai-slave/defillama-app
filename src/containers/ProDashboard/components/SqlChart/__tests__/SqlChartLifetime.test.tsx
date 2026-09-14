// @vitest-environment happy-dom
import { act, useState, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defaultChartConfig } from '~/containers/Downloads/sql/chartConfig'
import type { Editor } from '~/containers/Downloads/sql/Editor'
import type { ResultsPanel } from '~/containers/Downloads/sql/ResultsPanel'
import { DASHBOARD_CARD_HEIGHT_SCALE } from '../../../dashboardLayout/cardHeight'
import type { SqlChartConfig, SqlSnapshot } from '../../../types'
import { CardHeightScaleContext } from '../../cardHeightContext'
import { SqlChartCard } from '../SqlChartCard'
import { SqlChartModal } from '../SqlChartModal'

const api = vi.hoisted(() => ({
	run: vi.fn(),
	load: vi.fn(),
	add: vi.fn((config: { id: string }) => config.id),
	edit: vi.fn(),
	save: vi.fn()
}))
const serverRun = vi.hoisted(() => ({
	state: {
		snapshot: null as unknown,
		isRefreshing: false,
		error: null as string | null,
		canRefresh: true,
		refresh: vi.fn()
	}
}))
vi.mock('../useServerSqlRun', () => ({ useServerSqlRun: () => serverRun.state }))
vi.mock('../../ProCardHeader', () => ({
	ProCardHeader: ({
		title,
		subtitle,
		viewerControls,
		controls
	}: {
		title?: ReactNode
		subtitle?: ReactNode
		viewerControls?: ReactNode
		controls?: ReactNode
	}) => (
		<div>
			<h2>{title}</h2>
			{subtitle}
			{viewerControls}
			{controls}
		</div>
	)
}))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ authorizedFetch: vi.fn() }) }))
vi.mock('~/containers/Downloads/sql/useDuckDB', () => ({ useDuckDB: () => ({ conn: {}, status: 'ready' }) }))
vi.mock('~/containers/Downloads/sql/executor', () => ({ runSql: api.run }))
vi.mock('~/containers/Downloads/sql/useTableRegistry', () => ({
	useTableRegistry: () => ({ tables: [], load: api.load }),
	tableNameFor: () => 'chart_table'
}))
vi.mock('~/containers/Downloads/sql/Editor', () => ({
	Editor: ({ value, onChange, onRun, readOnly }: ComponentProps<typeof Editor>) => (
		<textarea
			aria-label="SQL"
			value={value}
			readOnly={readOnly}
			onChange={(event) => onChange(event.target.value)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' && event.ctrlKey) onRun()
			}}
		/>
	)
}))
vi.mock('~/containers/Downloads/sql/ResultsPanel', () => ({
	ResultsPanel: ({ result }: ComponentProps<typeof ResultsPanel>) => (
		<output aria-label="Query result">{JSON.stringify(result?.rows)}</output>
	)
}))
vi.mock('~/contexts/LocalStorage', () => ({
	useSavedDownloads: () => ({ savedDownloads: [], saveDownload: api.save })
}))
vi.mock('../../../ProDashboardAPIContext', () => ({
	useProDashboardEditorActions: () => ({ handleAddSqlChart: api.add, handleEditItem: api.edit })
}))
vi.mock('../chartOptions', () => ({ loadChartOptions: async () => ({}) }))
vi.mock('~/containers/Downloads/sql/chart', () => ({
	ChartRouter: ({ height }: { height?: string }) => <p data-height={height}>chart</p>
}))
vi.mock('../SqlChartModalSidebar', () => ({
	SqlChartModalSidebar: ({
		onApplySaved,
		onLoadTable
	}: {
		onApplySaved: (query: object) => void
		onLoadTable: (source: object) => Promise<unknown>
	}) => (
		<>
			<button type="button" onClick={() => void onLoadTable({ kind: 'dataset', slug: 'protocols' })}>
				Load source
			</button>
			<button
				type="button"
				onClick={() =>
					onApplySaved({
						id: 'saved',
						name: 'Saved query',
						sql: 'SELECT * FROM chart_table',
						tables: [{ kind: 'chart', slug: 'chain-tvl', param: 'Ethereum' }]
					})
				}
			>
				Apply saved
			</button>
		</>
	)
}))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.resetAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
const item: SqlChartConfig = {
	id: 'sql',
	kind: 'sql',
	name: 'Query',
	chart: defaultChartConfig([]),
	query: { sql: 'SELECT 1 AS value', tableSources: [] }
}
async function mount() {
	function Harness() {
		const [open, setOpen] = useState(true)
		return open ? (
			<SqlChartModal editItem={item} onClose={() => setOpen(false)} />
		) : (
			<>
				<p>Closed</p>
				<button type="button" onClick={() => setOpen(true)}>
					Reopen
				</button>
			</>
		)
	}
	await act(async () => root.render(<Harness />))
}
async function click(name: string) {
	await act(async () =>
		[...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name)!.click()
	)
}
test('closing during source preparation aborts loading and never starts execution', async () => {
	let finish!: () => void
	api.load.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve
			})
	)
	await mount()
	await click('Apply saved')
	expect(api.load).toHaveBeenCalledOnce()
	const signal = api.load.mock.calls[0][1] as AbortSignal
	await click('Cancel')
	expect(signal.aborted).toBe(true)
	await act(async () => finish())
	expect(api.run).not.toHaveBeenCalled()
	expect(api.edit).not.toHaveBeenCalled()
})
test('closing a save ignores a late successful query result', async () => {
	let finish!: (value: object) => void
	api.run.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	await mount()
	await click('Save changes')
	await click('Cancel')
	await act(async () =>
		finish({ ok: true, result: { columns: [{ name: 'value', type: 'INTEGER' }], rows: [[1]] }, durationMs: 1 })
	)
	expect(api.edit).not.toHaveBeenCalled()
	expect(api.save).not.toHaveBeenCalled()
})
test('a query failure leaves Save available, and retry saves the matching query result', async () => {
	api.run.mockResolvedValueOnce({ ok: false, error: 'Query failed' }).mockResolvedValueOnce({
		ok: true,
		result: { columns: [{ name: 'value', type: 'INTEGER' }], rows: [[1]] },
		durationMs: 1
	})
	await mount()
	await click('Save changes')
	expect(document.body.textContent).toContain('Query failed')
	expect(api.edit).not.toHaveBeenCalled()
	await click('Save changes')
	expect(api.edit).toHaveBeenCalledOnce()
	expect(api.edit.mock.calls[0][1]).toMatchObject({ query: { sql: 'SELECT 1 AS value' }, snapshot: { rows: [[1]] } })
	expect(container.textContent).toContain('Closed')
})

const successfulQuery = {
	ok: true,
	result: { columns: [{ name: 'value', type: 'INTEGER' }], rows: [[1]] },
	durationMs: 1
}

async function shortcut() {
	await act(async () =>
		document
			.querySelector('textarea')!
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
	)
}
async function editSql(value: string) {
	const input = document.querySelector('textarea')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}

test('Save locks its submitted fields and ignores repeated query shortcuts until failure unlocks them', async () => {
	let finish!: (value: object) => void
	api.run.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve
			})
	)
	await mount()
	const saveButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Save changes'
	)!
	await act(async () => saveButton.focus())
	await click('Save changes')
	expect(document.activeElement).toBe(saveButton)
	expect(saveButton.textContent).toBe('Stop query')
	expect(saveButton.getAttribute('aria-disabled')).not.toBe('true')
	expect(document.querySelector<HTMLInputElement>('[aria-label="Card name"]')!.readOnly).toBe(true)
	expect(document.querySelector('textarea')!.readOnly).toBe(true)
	expect(document.querySelector<HTMLInputElement>('[type="number"]')!.readOnly).toBe(true)
	await shortcut()
	expect(api.run).toHaveBeenCalledOnce()
	await act(async () => finish({ ok: false, error: 'Try again' }))
	expect(document.querySelector('textarea')!.readOnly).toBe(false)
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Try again')
	expect(api.edit).not.toHaveBeenCalled()
})

test('Run allows newer SQL edits without saving an old result as the new query', async () => {
	let finish!: (value: object) => void
	api.run
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve
				})
		)
		.mockResolvedValueOnce({ ...successfulQuery, result: { ...successfulQuery.result, rows: [[2]] } })
	await mount()
	await shortcut()
	expect(document.querySelector('textarea')!.readOnly).toBe(false)
	await editSql('SELECT 2 AS value')
	await shortcut()
	expect(api.run).toHaveBeenCalledOnce()
	await act(async () => finish(successfulQuery))
	expect(document.body.textContent).toContain('Query changed')
	await click('Save changes')
	expect(api.run.mock.calls[1][1]).toBe('SELECT 2 AS value')
	expect(api.edit.mock.calls[0][1]).toMatchObject({ query: { sql: 'SELECT 2 AS value' }, snapshot: { rows: [[2]] } })
})

test('Save retains table sources loaded by its own execution', async () => {
	const source = { kind: 'dataset', slug: 'protocols' }
	const table = { name: 'protocols', source, columns: [], rowCount: 1, loadedAt: 0 }
	api.load.mockResolvedValue(table)
	api.run.mockImplementation(async (context, _sql, _options, _skip, signal) => {
		await context.loadSource(source, signal)
		return successfulQuery
	})
	await mount()
	await editSql('SELECT * FROM protocols')
	await click('Save changes')
	expect(api.edit.mock.calls[0][1].query.tableSources).toEqual([source])
})

test('a previous opening cannot overwrite a reopened editor after cancellation', async () => {
	let finish!: (value: object) => void
	api.run
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve
				})
		)
		.mockResolvedValueOnce(successfulQuery)
	await mount()
	await click('Save changes')
	await click('Cancel')
	await click('Reopen')
	await editSql('SELECT 3 AS value')
	await act(async () => finish(successfulQuery))
	expect(document.querySelector('textarea')!.value).toBe('SELECT 3 AS value')
	expect(api.edit).not.toHaveBeenCalled()
	await click('Save changes')
	expect(api.edit).toHaveBeenCalledOnce()
	expect(api.edit.mock.calls[0][1].query.sql).toBe('SELECT 3 AS value')
})

test('failed saved-query source preparation remains retryable without executing incomplete sources', async () => {
	const table = {
		name: 'chart_table',
		source: { kind: 'chart', slug: 'chain-tvl', param: 'Ethereum' },
		columns: [],
		rowCount: 1,
		loadedAt: 0
	}
	api.load.mockResolvedValueOnce(null).mockResolvedValueOnce(table)
	api.run.mockResolvedValue(successfulQuery)
	await mount()
	await click('Apply saved')
	expect(api.run).not.toHaveBeenCalled()
	expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load table')
	await click('Apply saved')
	expect(api.run).toHaveBeenCalledOnce()
	expect(api.run.mock.calls[0][0].loadedTables).toEqual([table])
})

test('schema loading blocks overlapping execution and is aborted when the editor closes', async () => {
	let finish!: () => void
	api.load.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve
			})
	)
	await mount()
	await click('Load source')
	await shortcut()
	await click('Save changes')
	expect(api.run).not.toHaveBeenCalled()
	await click('Cancel')
	expect((api.load.mock.calls[0][1] as AbortSignal).aborted).toBe(true)
	await act(async () => finish())
	expect(api.edit).not.toHaveBeenCalled()
})

test('Stop preserves the draft and previous results, ignores late completion, and allows rerunning', async () => {
	const cancelled = Promise.withResolvers<object>()
	api.run
		.mockResolvedValueOnce(successfulQuery)
		.mockReturnValueOnce(cancelled.promise)
		.mockResolvedValueOnce({
			...successfulQuery,
			result: { ...successfulQuery.result, rows: [[3]] }
		})
	await mount()
	await shortcut()
	await editSql('SELECT 2 AS value')
	await shortcut()
	const signal = api.run.mock.calls[1][4] as AbortSignal
	const stop = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Stop query'
	)!
	await act(async () => stop.focus())
	await click('Stop query')
	expect(signal.aborted).toBe(true)
	expect(document.activeElement).toBe(stop)
	expect(stop.getAttribute('aria-disabled')).toBe('true')
	await shortcut()
	expect(api.run).toHaveBeenCalledTimes(2)
	await editSql('SELECT 3 AS value')
	await act(async () => cancelled.resolve({ ...successfulQuery, result: { ...successfulQuery.result, rows: [[2]] } }))
	expect(document.querySelector('textarea')!.value).toBe('SELECT 3 AS value')
	expect(document.activeElement).toBe(stop)
	expect(stop.textContent).toContain('Run query')
	expect(document.body.textContent).toContain('Query changed')
	expect(document.querySelector('[role="alert"]')).toBeNull()
	expect(document.querySelector('[aria-label="Query result"]')!.textContent).toBe('[[1]]')
	await click('Save changes')
	expect(api.edit.mock.calls[0][1]).toMatchObject({ query: { sql: 'SELECT 3 AS value' }, snapshot: { rows: [[3]] } })
})

test('stopping save preparation unlocks the same editor and never persists its late result', async () => {
	const cancelled = Promise.withResolvers<object>()
	api.run.mockReturnValueOnce(cancelled.promise).mockResolvedValueOnce(successfulQuery)
	await mount()
	await click('Save changes')
	const stop = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(button) => button.textContent === 'Stop query'
	)!
	await act(async () => stop.focus())
	await click('Stop query')
	expect((api.run.mock.calls[0][4] as AbortSignal).aborted).toBe(true)
	await act(async () => cancelled.resolve(successfulQuery))
	expect(document.activeElement).toBe(stop)
	expect(stop.textContent).toBe('Save changes')
	expect(document.querySelector('textarea')!.readOnly).toBe(false)
	expect(document.querySelector<HTMLInputElement>('[aria-label="Card name"]')!.value).toBe('Query')
	expect(api.edit).not.toHaveBeenCalled()
	expect(api.save).not.toHaveBeenCalled()
	await click('Save changes')
	expect(api.edit).toHaveBeenCalledOnce()
	expect(api.save).toHaveBeenCalledOnce()
})

test('stopping source preparation leaves the selected SQL in place and skips execution', async () => {
	const cancelled = Promise.withResolvers<object>()
	api.load.mockReturnValueOnce(cancelled.promise)
	await mount()
	await click('Apply saved')
	await click('Stop query')
	expect((api.load.mock.calls[0][1] as AbortSignal).aborted).toBe(true)
	await act(async () => cancelled.resolve({ name: 'chart_table' }))
	expect(document.querySelector('textarea')!.value).toBe('SELECT * FROM chart_table')
	expect(document.querySelector<HTMLInputElement>('[aria-label="Card name"]')!.value).toBe('Saved query')
	expect(api.run).not.toHaveBeenCalled()
	expect(document.querySelector('[role="alert"]')).toBeNull()
	api.run.mockResolvedValueOnce(successfulQuery)
	await shortcut()
	expect(api.run).toHaveBeenCalledOnce()
})

test('a query that has never run offers to run it', async () => {
	serverRun.state = { snapshot: null, isRefreshing: false, error: null, canRefresh: true, refresh: vi.fn() }
	await act(async () => root.render(<SqlChartCard config={item} />))
	expect(document.body.textContent).toContain("This query hasn't run yet.")
	await click('Run query')
	expect(serverRun.state.refresh).toHaveBeenCalledOnce()
})

test('a viewer is told the owner has not run the query', async () => {
	serverRun.state = { snapshot: null, isRefreshing: false, error: null, canRefresh: false, refresh: vi.fn() }
	await act(async () => root.render(<SqlChartCard config={item} />))
	expect(document.body.textContent).toContain("The owner hasn't run this query yet.")
	expect([...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Run query')).toBe(false)
})

test('a failed refresh explains itself without printing the raw error', async () => {
	serverRun.state = {
		snapshot: null,
		isRefreshing: false,
		error: 'Refresh failed with HTTP 500',
		canRefresh: true,
		refresh: vi.fn()
	}
	await act(async () => root.render(<SqlChartCard config={item} />))
	const alert = document.querySelector('[role="alert"]')
	expect(alert?.textContent).toContain("Couldn't refresh this query.")
	expect(alert?.textContent).not.toContain('HTTP 500')
	expect(alert?.getAttribute('title')).toBe('Refresh failed with HTTP 500')
	await click('Try again')
	expect(serverRun.state.refresh).toHaveBeenCalledOnce()
})

const heightSnapshot: SqlSnapshot = {
	columns: [{ name: 'value', type: 'INTEGER' }],
	rows: [[1], [2]],
	computedAt: new Date().toISOString(),
	rowCount: 2,
	engine: 'server'
}

test('the card height preset scales the chart instead of padding the card', async () => {
	serverRun.state = { snapshot: heightSnapshot, isRefreshing: false, error: null, canRefresh: false, refresh: vi.fn() }
	await act(async () => root.render(<SqlChartCard config={item} />))
	expect(container.querySelector('[data-height]')?.getAttribute('data-height')).toBe('420px')
	await act(async () =>
		root.render(
			<CardHeightScaleContext.Provider value={DASHBOARD_CARD_HEIGHT_SCALE.compact}>
				<SqlChartCard config={item} />
			</CardHeightScaleContext.Provider>
		)
	)
	expect(container.querySelector('[data-height]')?.getAttribute('data-height')).toBe('315px')
})
