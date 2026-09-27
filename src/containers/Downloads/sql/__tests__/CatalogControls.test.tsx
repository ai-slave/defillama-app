// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import { chartDatasets } from '../../chart-datasets'
import { datasets } from '../../datasets'
import { SchemaBrowser } from '../SchemaBrowser'
import { UpsellGate } from '../UpsellGate'

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
