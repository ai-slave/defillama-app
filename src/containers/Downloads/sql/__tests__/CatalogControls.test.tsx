// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SchemaBrowser } from '../SchemaBrowser'
import { UpsellGate } from '../UpsellGate'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/downloads?mode=sql' }) }))
vi.mock('../../datasets', () => ({
	datasetCategories: ['Test'],
	datasets: [{ slug: 'balances', category: 'Test', description: 'Current balances', fields: ['value'] }]
}))
vi.mock('../../chart-datasets', () => ({
	chartDatasetCategories: ['Test'],
	chartDatasets: [{ slug: 'tvl', category: 'Test', description: 'Historical TVL', paramLabel: 'Protocol', columns: [] }]
}))
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
			/>
		)
	)
	const [all, flat, timeseries] = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
	expect(all.checked).toBe(true)
	expect(container.textContent).toContain('Current balances')
	expect(container.textContent).toContain('Historical TVL')
	await act(async () => all.focus())
	await press(all, 'ArrowRight')
	await vi.waitFor(() => expect(flat.checked).toBe(true))
	expect(container.textContent).not.toContain('Historical TVL')
	const search = container.querySelector<HTMLInputElement>('input[type="text"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'balances')
		search.dispatchEvent(new Event('input', { bubbles: true }))
		flat.focus()
	})
	await press(flat, 'ArrowRight')
	await vi.waitFor(() => expect(timeseries.checked).toBe(true))
	expect(container.textContent).toContain('No tables match')
	await press(timeseries, 'ArrowRight')
	await vi.waitFor(() => expect(all.checked).toBe(true))
	expect(search.value).toBe('balances')
	expect(container.textContent).toContain('Current balances')
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
	await vi.waitFor(() => expect(document.activeElement).toBe(chains))
	expect(notebook.getAttribute('aria-selected')).toBe('true')
	expect(activePanel().textContent).toBe(initialContent)
	await press(chains, 'Enter')
	await vi.waitFor(() => expect(chains.getAttribute('aria-selected')).toBe('true'))
	expect(activePanel().getAttribute('aria-labelledby')).toBe(chains.id)
	expect(activePanel().querySelector('code')?.textContent).toContain('FROM chains')
	expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1)
	await act(async () => notebook.click())
	expect(activePanel().getAttribute('aria-labelledby')).toBe(notebook.id)
	expect(activePanel().textContent).toBe(initialContent)
})
