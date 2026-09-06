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
		await new Promise((resolve) => setTimeout(resolve, 30))
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
	expect(flat.checked).toBe(true)
	expect(container.textContent).not.toContain('Historical TVL')
	const search = container.querySelector<HTMLInputElement>('input[type="text"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'balances')
		search.dispatchEvent(new Event('input', { bubbles: true }))
		flat.focus()
	})
	await press(flat, 'ArrowRight')
	expect(timeseries.checked).toBe(true)
	expect(container.textContent).toContain('No tables match')
	await press(timeseries, 'ArrowRight')
	expect(all.checked).toBe(true)
	expect(search.value).toBe('balances')
	expect(container.textContent).toContain('Current balances')
	expect(load).not.toHaveBeenCalled()
})
test('SQL samples activate on Enter and mount only the selected panel', async () => {
	await act(async () => root.render(<UpsellGate isAuthenticated={false} isTrial={false} />))
	const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
	const initialPanel = container.querySelector('[role="tabpanel"]:not([hidden])')!
	expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1)
	for (const panel of container.querySelectorAll('[role="tabpanel"][hidden]')) expect(panel.textContent).toBe('')
	await act(async () => tabs[0].focus())
	await press(tabs[0], 'End')
	expect(document.activeElement).toBe(tabs[2])
	expect(container.querySelector('[role="tabpanel"]:not([hidden])')).toBe(initialPanel)
	await press(tabs[2], 'Enter')
	const selectedPanel = container.querySelector('[role="tabpanel"]:not([hidden])')!
	expect(selectedPanel.getAttribute('aria-labelledby')).toBe(tabs[2].id)
	expect(initialPanel.textContent).toBe('')
	expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1)
	await act(async () => tabs[0].click())
	expect(container.querySelector('[role="tabpanel"]:not([hidden])')!.getAttribute('aria-labelledby')).toBe(tabs[0].id)
})
