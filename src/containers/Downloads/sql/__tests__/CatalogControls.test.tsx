// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { chartDatasets } from '../../chart-datasets'
import { datasets } from '../../datasets'
import { SchemaBrowser } from '../SchemaBrowser'
import { SchemaDrawer } from '../SchemaDrawer'
import { UpsellGate } from '../UpsellGate'
import { useTableRegistry, type RegisteredTable } from '../useTableRegistry'

vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/downloads?mode=sql' }) }))
const flatDescription = datasets.find((dataset) => dataset.slug === 'hacks')!.description
const chartDescription = chartDatasets.find((dataset) => dataset.slug === 'protocol-tvl-chart')!.description
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	localStorage.clear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
async function press(el: HTMLElement, key: string) {
	await act(async () => {
		el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
		el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
	})
}
test('schema radio filtering is reversible and retains search without loading a dataset', async () => {
	const load = vi.fn()
	await act(async () =>
		root.render(
			<SchemaBrowser
				chartOptionsMap={{}}
				loadedTables={[]}
				onLoad={load}
				onReplaceSql={vi.fn()}
				onInsertAtCursor={vi.fn()}
				loading={null}
				loadError={null}
				pickedParams={{}}
				setPickedParams={vi.fn()}
			/>
		)
	)
	const [all, flat, timeseries] = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
	expect(all.checked).toBe(true)
	expect(container.textContent).toContain(flatDescription)
	expect(container.textContent).toContain(chartDescription)
	await act(async () => all.focus())
	await press(all, 'ArrowRight')
	await waitForUi(() => expect(flat.checked).toBe(true))
	expect(container.textContent).not.toContain(chartDescription)
	const search = container.querySelector<HTMLInputElement>('input[type="text"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'hacks')
		search.dispatchEvent(new Event('input', { bubbles: true }))
		flat.focus()
	})
	await press(flat, 'ArrowRight')
	await waitForUi(() => expect(timeseries.checked).toBe(true))
	expect(container.textContent).toContain('No tables match')
	await press(timeseries, 'ArrowRight')
	await waitForUi(() => expect(all.checked).toBe(true))
	expect(search.value).toBe('hacks')
	expect(container.textContent).toContain(flatDescription)
	expect(load).not.toHaveBeenCalled()
})
test('SQL sample focus preserves the current query until activation', async () => {
	await act(async () => root.render(<UpsellGate isAuthenticated={false} isTrial={false} />))
	const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
	const notebook = tabs.find((tab) => tab.textContent?.includes('revenue-capture.nb'))!
	const chains = tabs.find((tab) => tab.textContent?.includes('chains-tvl.sql'))!
	const activePanel = () => container.querySelector('[role="tabpanel"]:not([hidden])')!
	const initialContent = activePanel().textContent
	await act(async () => notebook.focus())
	await press(notebook, 'End')
	await waitForUi(() => expect(document.activeElement).toBe(chains))
	expect(notebook.getAttribute('aria-selected')).toBe('true')
	expect(activePanel().textContent).toBe(initialContent)
	await press(chains, 'Enter')
	await waitForUi(() => expect(chains.getAttribute('aria-selected')).toBe('true'))
	expect(activePanel().getAttribute('aria-labelledby')).toBe(chains.id)
	expect(activePanel().querySelector('code')?.textContent).toContain('FROM chains')
	expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1)
	await act(async () => notebook.click())
	expect(activePanel().getAttribute('aria-labelledby')).toBe(notebook.id)
	expect(activePanel().textContent).toBe(initialContent)
})

function RegistryBrowser({ authorizedFetch }: { authorizedFetch: () => Promise<Response> }) {
	// The fetch fails before the table reaches DuckDB, so the connection is never used.
	const registry = useTableRegistry({ conn: {} as never, authorizedFetch })
	const [pickedParams, setPickedParams] = useState<Record<string, string>>({})
	return (
		<SchemaBrowser
			pickedParams={pickedParams}
			setPickedParams={setPickedParams}
			chartOptionsMap={{}}
			loadedTables={registry.tables}
			onLoad={registry.load}
			onReplaceSql={vi.fn()}
			onInsertAtCursor={vi.fn()}
			loading={registry.loading}
			loadError={registry.error}
		/>
	)
}

test('a table that fails to load says why on its own row', async () => {
	const authorizedFetch = vi.fn(async () => Response.json({ error: 'Hacks export is unavailable' }, { status: 503 }))
	await act(async () => root.render(<RegistryBrowser authorizedFetch={authorizedFetch} />))
	const row = (description: string) =>
		[...container.querySelectorAll('li')].find((li) => li.textContent?.includes(description))!
	const load = [...row(flatDescription).querySelectorAll('button')].find((el) => el.textContent === 'Load')!
	await act(async () => load.click())
	await waitForUi(() =>
		expect(row(flatDescription).querySelector('[role="alert"]')?.textContent).toBe('Hacks export is unavailable')
	)
	expect(authorizedFetch).toHaveBeenCalledWith('/api/private/downloads/hacks', undefined)
	expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1)
})

// Holds the picks the way the SQL workspace does, above the sheet's tabs.
function RegistryDrawer({ authorizedFetch }: { authorizedFetch: () => Promise<Response> }) {
	const registry = useTableRegistry({ conn: {} as never, authorizedFetch })
	const [pickedParams, setPickedParams] = useState<Record<string, string>>({})
	return (
		<SchemaDrawer
			pickedParams={pickedParams}
			setPickedParams={setPickedParams}
			open
			onClose={vi.fn()}
			chartOptionsMap={{ 'protocol-tvl-chart': [{ label: 'Aave', value: 'aave' }] }}
			loadedTables={registry.tables}
			onLoad={registry.load}
			onReplaceSql={vi.fn()}
			onInsertAtCursor={vi.fn()}
			onApplyAndRun={vi.fn()}
			loading={registry.loading}
			loadError={registry.error}
		/>
	)
}

test('a time series keeps its parameter across a tab switch and shows a failure that lands after the reader returns', async () => {
	let fail!: () => void
	const authorizedFetch = vi.fn(
		() =>
			new Promise<Response>((resolve) => {
				fail = () => resolve(Response.json({ error: 'Aave TVL is unavailable' }, { status: 503 }))
			})
	)
	await act(async () => root.render(<RegistryDrawer authorizedFetch={authorizedFetch} />))
	const row = () => [...document.querySelectorAll('li')].find((li) => li.textContent?.includes(chartDescription))!
	const control = (el: Element, name: string) =>
		[...el.querySelectorAll<HTMLElement>('button, [role="tab"]')].find((b) => b.textContent === name)!
	await act(async () => row().querySelector<HTMLElement>('[role="combobox"]')!.click())
	const aave = await waitForUi(() => {
		const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent === 'Aave')
		expect(option).toBeDefined()
		return option!
	})
	await act(async () => aave.click())
	await act(async () => control(row(), 'Load').click())
	await waitForUi(() => expect(authorizedFetch).toHaveBeenCalledTimes(1))

	await act(async () => control(document.body, 'Cookbook').click())
	await act(async () => control(document.body, 'Schema').click())
	expect(row().querySelector('[role="combobox"]')!.textContent).toBe('Protocol: Aave')
	expect(row().querySelector('[aria-busy="true"]')?.textContent).toContain('Loading…')

	await act(async () => fail())
	await waitForUi(() => expect(row().querySelector('[role="alert"]')?.textContent).toBe('Aave TVL is unavailable'))
	expect(authorizedFetch).toHaveBeenCalledWith('/api/private/downloads/chart/protocol-tvl-chart?param=aave', undefined)
	expect(authorizedFetch).toHaveBeenCalledTimes(1)
})

const hacksTable: RegisteredTable = {
	name: 'hacks',
	source: { kind: 'dataset', slug: 'hacks' },
	columns: [{ name: 'name', type: 'VARCHAR' }],
	rowCount: 3,
	loadedAt: 1
}

// Holds the search and picks the way the SQL workspace does.
const noTables: Array<RegisteredTable> = []

function Browser({
	loadedTables = noTables,
	onInsertAtCursor = vi.fn()
}: {
	loadedTables?: Array<RegisteredTable>
	onInsertAtCursor?: ((text: string) => void) | null
}) {
	const [pickedParams, setPickedParams] = useState<Record<string, string>>({ 'protocol-tvl-chart': 'aave' })
	return (
		<SchemaBrowser
			chartOptionsMap={{ 'protocol-tvl-chart': [{ label: 'Aave', value: 'aave' }] }}
			loadedTables={loadedTables}
			onLoad={vi.fn(async () => null)}
			onReplaceSql={vi.fn()}
			onInsertAtCursor={onInsertAtCursor}
			loading={null}
			loadError={null}
			pickedParams={pickedParams}
			setPickedParams={setPickedParams}
		/>
	)
}

const schemaRow = (description: string) =>
	[...container.querySelectorAll('li')].find((li) => li.textContent?.includes(description))!
const buttonIn = (el: Element, name: string) =>
	[...el.querySelectorAll<HTMLButtonElement>('button')].find(
		(b) => b.textContent === name || b.getAttribute('aria-label') === name
	)!

test('clearing the schema search hands focus back to the search field', async () => {
	await act(async () => root.render(<Browser />))
	const search = container.querySelector<HTMLInputElement>('input[type="text"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'hacks')
		search.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => {
		buttonIn(container, 'Clear search').focus()
		buttonIn(container, 'Clear search').click()
	})
	expect(search.value).toBe('')
	expect(document.activeElement).toBe(search)
})

test("clearing a time series' parameter hands focus to its picker", async () => {
	await act(async () => root.render(<Browser />))
	const row = schemaRow(chartDescription)
	expect(row.querySelector('[role="combobox"]')!.textContent).toBe('Protocol: Aave')
	await act(async () => {
		buttonIn(row, 'Clear').focus()
		buttonIn(row, 'Clear').click()
	})
	expect(row.querySelector('[role="combobox"]')!.textContent).toBe('Protocol: Pick a protocol')
	expect(document.activeElement).toBe(row.querySelector('[role="combobox"]'))
})

test('Load stays focusable when its table lands and it turns into Loaded', async () => {
	await act(async () => root.render(<Browser />))
	const load = buttonIn(schemaRow(flatDescription), 'Load')
	await act(async () => load.focus())
	await act(async () => root.render(<Browser loadedTables={[hacksTable]} />))
	expect(load.textContent).toBe('Loaded')
	expect(load.getAttribute('aria-disabled')).toBe('true')
	expect(load.matches(':disabled')).toBe(false)
	expect(document.activeElement).toBe(load)
})

test('with no editor to insert into, a table lists its columns without offering them', async () => {
	const insert = vi.fn()
	await act(async () => root.render(<Browser loadedTables={[hacksTable]} onInsertAtCursor={insert} />))
	const columns = () => schemaRow(flatDescription).querySelector('ul[aria-label^="Columns"]')!
	await act(async () => columns().querySelector('button')!.click())
	expect(insert).toHaveBeenCalledWith('date')

	await act(async () => root.render(<Browser loadedTables={[hacksTable]} onInsertAtCursor={null} />))
	expect(columns().getAttribute('aria-label')).toBe('Columns')
	expect(columns().querySelectorAll('button')).toHaveLength(0)
	expect(columns().textContent).not.toBe('')
})

test('the upsell sample shows its notebook controls without offering dead buttons', async () => {
	await act(async () => root.render(<UpsellGate isAuthenticated={false} isTrial={false} />))
	const panel = container.querySelector('[role="tabpanel"]:not([hidden])')!
	expect(panel.textContent).toContain('Run all')
	expect(panel.querySelectorAll('button')).toHaveLength(0)
})
