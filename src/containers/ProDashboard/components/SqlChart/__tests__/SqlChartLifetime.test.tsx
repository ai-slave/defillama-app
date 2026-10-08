// @vitest-environment happy-dom
import { tableFromArrays, type Table } from 'apache-arrow'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { chartDatasets } from '~/containers/Downloads/chart-datasets'
import { defaultChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { readAppStorage, useSavedDownloads, writeAppStorage } from '~/contexts/LocalStorage'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { SqlChartConfig } from '../../../types'
import { SqlChartModal } from '../SqlChartModal'

// DuckDB runs as WebAssembly in a browser worker; the test answers its connection instead.
const engine = vi.hoisted(() => ({ send: vi.fn(), cancelSent: vi.fn(), load: vi.fn() }))
vi.mock('~/containers/Downloads/sql/duckdb', () => ({ getDuckDB: engine.load }))
// Monaco cannot run in happy-dom, and no assertion reads the editor.
vi.mock('~/containers/Downloads/sql/Editor', () => ({ Editor: () => null }))

const session = installSubscriberSession('u1', { resolved: true })
const onEdit = vi.fn()
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	engine.send.mockReset()
	engine.cancelSent.mockReset().mockResolvedValue(true)
	engine.load.mockReset().mockResolvedValue({ db: {}, conn: { send: engine.send, cancelSent: engine.cancelSent } })
	onEdit.mockReset().mockReturnValue({ status: 'saved', ids: ['sql'] })
	localStorage.clear()
	// Chart dataset options only fill the sidebar catalog.
	const options: Record<string, () => Response> = {}
	for (const dataset of chartDatasets) options[dataset.optionsUrl] = fixtureStatus(503)
	session.serve(options)
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
const storedItem: SqlChartConfig = {
	...item,
	// The table view keeps the chart renderer out of the tree.
	displayMode: 'table',
	chart: { ...defaultChartConfig([]), chartType: 'histogram', histogram: { valueCol: 'value', binCount: 12 } },
	snapshot: {
		columns: [{ name: 'value', type: 'INTEGER' }],
		rows: [[5]],
		computedAt: '2024-01-01T00:00:00.000Z',
		rowCount: 1,
		engine: 'browser'
	}
}

function reader(table: Table) {
	return { schema: table.schema, readAll: async () => table.batches }
}
const valueTable = (value: number) => reader(tableFromArrays({ value: new Int32Array([value]) }))

function SavedQueries() {
	const { savedDownloads } = useSavedDownloads()
	return <output aria-label="Saved queries">{savedDownloads.map((download) => download.name).join(',')}</output>
}

async function mount(editItem = item) {
	function Harness() {
		const [open, setOpen] = useState(true)
		return (
			<>
				{open ? (
					<SqlChartModal
						editItem={editItem}
						isOpen
						onClose={() => setOpen(false)}
						onClosed={() => {}}
						onSaved={() => setOpen(false)}
					/>
				) : (
					<button type="button" onClick={() => setOpen(true)}>
						Reopen
					</button>
				)}
				<SavedQueries />
			</>
		)
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider editorActions={{ handleEditItem: onEdit }}>
					<Harness />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
}
function button(name: string) {
	const match = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name)
	if (!match) throw new Error(`No "${name}" button`)
	return match
}
async function click(name: string) {
	await act(async () => button(name).click())
}
const savedNames = () => document.querySelector('[aria-label="Saved queries"]')!.textContent
// The field is named by its visible label.
const cardName = () =>
	([...document.querySelectorAll('label')].find((label) => label.textContent?.startsWith('Card name'))?.control ??
		null) as HTMLInputElement | null

test('Save keeps focus while it becomes Stop query, and Stop returns an editable draft that saves on retry', async () => {
	const stopped = Promise.withResolvers<ReturnType<typeof valueTable>>()
	engine.send.mockReturnValueOnce(stopped.promise).mockResolvedValueOnce(valueTable(1))
	await mount()
	const save = button('Save changes')
	await act(async () => save.focus())
	await click('Save changes')
	expect(save.textContent).toBe('Stop query')
	expect(save.getAttribute('aria-disabled')).toBeNull()
	expect(document.activeElement).toBe(save)
	expect(cardName().readOnly).toBe(true)

	await click('Stop query')
	expect(engine.cancelSent).toHaveBeenCalledOnce()
	expect(save.textContent).toBe('Stopping…')
	expect(save.getAttribute('aria-disabled')).toBe('true')
	await act(async () => stopped.resolve(valueTable(9)))
	expect(save.textContent).toBe('Save changes')
	expect(document.activeElement).toBe(save)
	expect(cardName().readOnly).toBe(false)
	expect(cardName().value).toBe('Query')
	expect(onEdit).not.toHaveBeenCalled()
	expect(savedNames()).toBe('')

	await click('Save changes')
	expect(onEdit).toHaveBeenCalledOnce()
	expect(onEdit.mock.calls[0][1]).toMatchObject({ query: { sql: 'SELECT 1 AS value' }, snapshot: { rows: [[1]] } })
	expect(savedNames()).toBe('Query')
	expect(document.body.textContent).toContain('Reopen')
})

test('an engine that failed to load says so, and reopening the editor loads it again', async () => {
	engine.load.mockRejectedValueOnce(new Error('WebAssembly blocked'))
	engine.send.mockResolvedValueOnce(valueTable(3))
	await mount()
	const failure = () => [...document.querySelectorAll('[role="alert"]')].map((node) => node.textContent)
	expect(failure()).toContain('SQL engine failed to load: WebAssembly blocked.')

	await click('Cancel')
	await click('Reopen')
	expect(failure()).toEqual([])
	await click('Save changes')
	expect(onEdit.mock.calls[0][1]).toMatchObject({ snapshot: { rows: [[3]] } })
})

test('Cancel during Save stops the query, and its late answer never reaches the reopened editor or the saved list', async () => {
	const late = Promise.withResolvers<ReturnType<typeof valueTable>>()
	engine.send.mockReturnValueOnce(late.promise)
	await mount()
	await click('Save changes')
	await click('Cancel')
	expect(engine.cancelSent).toHaveBeenCalledOnce()
	await click('Reopen')
	await act(async () => late.resolve(valueTable(1)))
	expect(button('Save changes').getAttribute('aria-disabled')).toBeNull()
	expect(cardName().readOnly).toBe(false)
	expect(onEdit).not.toHaveBeenCalled()
	expect(savedNames()).toBe('')
})

test('Cancel during Save of a changed query closes without asking, as × and Escape do, and stops the query', async () => {
	const late = Promise.withResolvers<ReturnType<typeof valueTable>>()
	engine.send.mockReturnValueOnce(late.promise)
	await mount()
	const nameInput = await waitForUi(() => {
		const input = cardName()
		expect(input).not.toBeNull()
		return input!
	})
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nameInput, 'Renamed')
		nameInput.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await click('Save changes')
	await click('Cancel')
	expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	expect(button('Reopen')).toBeDefined()
	expect(engine.cancelSent).toHaveBeenCalledOnce()
	expect(onEdit).not.toHaveBeenCalled()
})

test("Stop during a saved query keeps its SQL and name, and Save stores that query's own result instead of the card snapshot", async () => {
	writeAppStorage({
		...readAppStorage(),
		SAVED_DOWNLOADS: [{ id: 'q2', kind: 'query', name: 'Two', sql: 'SELECT 2 AS value', tables: [], createdAt: 0 }]
	})
	const stopped = Promise.withResolvers<ReturnType<typeof valueTable>>()
	engine.send.mockReturnValueOnce(stopped.promise).mockResolvedValueOnce(valueTable(2))
	await mount(storedItem)
	const savedTab = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) =>
		tab.textContent?.startsWith('Saved')
	)!
	await act(async () => savedTab.click())
	const savedQuery = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
		b.textContent?.includes('SELECT 2 AS value')
	)!
	await act(async () => savedQuery.click())
	await click('Stop query')
	await act(async () => stopped.resolve(valueTable(9)))
	expect(cardName().value).toBe('Two')
	expect(document.body.textContent).toContain('Query changed — Save will run it again.')

	await click('Save changes')
	expect(onEdit).toHaveBeenCalledOnce()
	expect(onEdit.mock.calls[0][1]).toMatchObject({ query: { sql: 'SELECT 2 AS value' }, snapshot: { rows: [[2]] } })
})

test('Saving an unchanged card keeps its stored snapshot without running the query again', async () => {
	await mount(storedItem)
	await click('Save changes')
	expect(onEdit).toHaveBeenCalledOnce()
	expect(onEdit.mock.calls[0][1]).toMatchObject({
		snapshot: { rows: [[5]], computedAt: '2024-01-01T00:00:00.000Z' }
	})
})

test("a Run before Save stores the fresh result with the card's chart setup", async () => {
	engine.send.mockResolvedValueOnce(valueTable(2))
	await mount(storedItem)
	const run = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
		b.textContent?.startsWith('Run query')
	)!
	await act(async () => run.click())
	await click('Save changes')
	expect(onEdit).toHaveBeenCalledOnce()
	expect(onEdit.mock.calls[0][1]).toMatchObject({
		snapshot: { rows: [[2]] },
		chart: { chartType: 'histogram', histogram: { valueCol: 'value', binCount: 12 } }
	})
})

test('Cancel reports once that the editor has finished leaving, so its session can be dropped', async () => {
	const onClosed = vi.fn()
	function Harness() {
		const [open, setOpen] = useState(true)
		return (
			<SqlChartModal
				editItem={item}
				isOpen={open}
				onClose={() => setOpen(false)}
				onClosed={onClosed}
				onSaved={() => setOpen(false)}
			/>
		)
	}
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider>
					<Harness />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	expect(document.querySelector('[role="dialog"]')).not.toBeNull()
	expect(onClosed).not.toHaveBeenCalled()

	await click('Cancel')
	expect(document.querySelector('[role="dialog"]')).toBeNull()
	expect(onClosed).toHaveBeenCalledOnce()
})

test('Cancel closes an untouched editor at once, and asks before it drops a changed query', async () => {
	await mount()
	await waitForUi(() => expect(cardName()).not.toBeNull())
	await act(async () => button('Cancel').click())
	await waitForUi(() => expect(button('Reopen')).toBeDefined())
	expect(document.querySelector('[role="alertdialog"]')).toBeNull()

	await act(async () => button('Reopen').click())
	const nameInput = await waitForUi(() => {
		const input = cardName()
		expect(input).not.toBeNull()
		return input!
	})
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nameInput, 'Renamed')
		nameInput.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => button('Cancel').click())
	const confirmation = await waitForUi(() => {
		const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]')
		expect(dialog?.textContent).toContain('Discard this SQL chart?')
		return dialog!
	})
	const keep = [...confirmation.querySelectorAll('button')].find((b) => b.textContent === 'Keep editing')!
	await act(async () => keep.click())
	await waitForUi(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull())
	expect(cardName()!.value).toBe('Renamed')
})

test('a save the dashboard refuses keeps the editor open with the reason in its footer', async () => {
	onEdit.mockReturnValue({ status: 'refused', reason: 'Dashboard is too large (2100 KB). Remove rows or a card.' })
	await mount(storedItem)
	await waitForUi(() => expect(button('Save changes')).toBeDefined())
	await act(async () => button('Save changes').click())
	await waitForUi(() => expect(onEdit).toHaveBeenCalledOnce())
	await waitForUi(() =>
		expect(document.querySelector('[role="dialog"] footer [role="alert"]')?.textContent).toBe(
			'Dashboard is too large (2100 KB). Remove rows or a card.'
		)
	)
	expect(document.querySelector('[role="dialog"]')).not.toBeNull()
	expect(document.querySelector<HTMLOutputElement>('[aria-label="Saved queries"]')!.textContent).toBe('')
})

test('Run and Save with an empty query say so under the editor and run nothing', async () => {
	await mount({ ...item, query: { sql: '', tableSources: [] } })
	const errors = () => [...document.querySelectorAll('.text-error')].map((node) => node.textContent)
	await waitForUi(() => expect(button('Save changes').getAttribute('aria-disabled')).toBeNull())
	const run = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
		b.textContent?.startsWith('Run query')
	)!
	expect(run.getAttribute('aria-disabled')).toBeNull()
	expect(errors()).toEqual([])
	await act(async () => run.click())
	expect(errors()).toEqual(['Enter a query.'])
	await click('Save changes')
	expect(errors()).toEqual(['Enter a query.'])
	expect(engine.send).not.toHaveBeenCalled()
	expect(onEdit).not.toHaveBeenCalled()
})

test('Enter in the card name never saves the card; only the footer Save does', async () => {
	await mount(storedItem)
	const name = cardName()!
	// No form holds the field, so the browser has nothing to submit on Enter.
	expect(name.form).toBeNull()
	await act(async () => {
		name.focus()
		name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
	})
	expect(onEdit).not.toHaveBeenCalled()
	await click('Save changes')
	expect(onEdit).toHaveBeenCalledOnce()
})
