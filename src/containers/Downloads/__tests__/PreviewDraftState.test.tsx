// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ChartDatasetDefinition } from '../chart-datasets'
import { ChartDatasetModal } from '../ChartDatasetModal'
import { DatasetPreviewModal } from '../DatasetPreviewModal'
import type { DatasetDefinition } from '../datasets'
import type { ChartSavedConfig, DatasetSavedConfig, SavedDownloadInput } from '../savedDownloads'
import { decodeDownloadConfig } from '../urlState'

const chart: ChartDatasetDefinition = {
	slug: 'test-chart',
	name: 'Test chart',
	description: '',
	category: 'Test',
	paramType: 'protocol',
	paramLabel: 'Protocol',
	optionsUrl: '',
	extractOptions: () => [],
	buildUrl: () => '',
	extractRows: () => [],
	sumMode: { columnLabel: 'total' },
	categoryBreakdown: { kind: 'tvl' }
}
const dataset: DatasetDefinition = {
	slug: 'test-dataset',
	name: 'Test dataset',
	description: '',
	category: 'Test',
	url: '',
	extractItems: () => [],
	defaultSortField: 'value'
}
const options = [
	{ value: 'alpha', label: 'Alpha', category: 'Lending' },
	{ value: 'beta', label: 'Beta', category: 'Lending' }
]
const config: ChartSavedConfig = {
	id: 'saved',
	createdAt: 1,
	name: 'Saved',
	kind: 'chart',
	slug: chart.slug,
	params: ['alpha', 'beta'],
	columns: ['date'],
	sort: { column: 'value', dir: 'asc' },
	dateRange: { kind: 'custom', from: '2026-01-01', to: '2026-12-31' }
}
const csv = 'date,value,other\n2026-09-01,20,3\n2026-09-02,10,4'
let root: Root
let container: HTMLDivElement
let client: QueryClient
let fetchCsv: ReturnType<typeof vi.fn<(url: string) => Promise<Response>>>
let writeClipboard: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>
beforeEach(() => {
	writeClipboard = vi.fn(async () => {})
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: writeClipboard } })
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	fetchCsv = vi.fn(async () => new Response(csv))
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
	localStorage.clear()
})
async function render(node: ReactNode) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				{node}
				<Toaster />
			</QueryClientProvider>
		)
	)
}
const missingColumnNotices = () =>
	document.body.textContent!.split('1 saved column no longer available: missing').length - 1
// The draft as the modal shares it: the Copy link URL, read back by the page's own decoder.
async function sharedLink(): Promise<SavedDownloadInput> {
	await click(button('Copy shareable link'))
	const url = new URL(writeClipboard.mock.calls.at(-1)![0])
	return decodeDownloadConfig(Object.fromEntries(url.searchParams))!
}
// Refetches through the modal's own fetcher, so the test does not depend on its query keys.
async function refreshCsv(body: string) {
	const calls = fetchCsv.mock.calls.length
	fetchCsv.mockImplementation(async () => new Response(body))
	await act(async () => client.invalidateQueries())
	await waitForUi(() => expect(fetchCsv.mock.calls.length).toBeGreaterThan(calls))
	await settle()
}
async function settle() {
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
}
function button(text: string) {
	const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(node) => node.textContent?.trim() === text || node.title === text || node.getAttribute('aria-label') === text
	)
	expect(found).toBeDefined()
	return found!
}
async function click(node: HTMLElement) {
	await act(async () => node.click())
}
function column(name: string) {
	return document.querySelector<HTMLInputElement>(`input[aria-label="Include ${name} column"]`)!
}
function selectedColumns() {
	return [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][aria-label^="Include "]')]
		.filter((input) => input.checked)
		.map((input) => input.getAttribute('aria-label')!.slice('Include '.length, -' column'.length))
}
async function renderChart(nextOptions = options, initialConfig = config) {
	await render(
		<ChartDatasetModal
			dataset={chart}
			options={nextOptions}
			authorizedFetch={fetchCsv}
			onClose={() => {}}
			initialConfig={initialConfig}
		/>
	)
	await settle()
}

test('late options and CSV initialize saved selections once, preserving edits and empty selection', async () => {
	await renderChart([])
	await renderChart()
	await waitForUi(() => expect(selectedColumns()).toEqual(['date']))
	expect(await sharedLink()).toMatchObject({ sort: { column: 'value', dir: 'asc' } })
	await click(column('date'))
	expect(selectedColumns()).toEqual([])
	await renderChart([...options])
	expect(selectedColumns()).toEqual([])
	await refreshCsv(`${csv}\n2026-09-03,30,5`)
	expect(selectedColumns()).toEqual([])
	await click(column('other'))
	expect(selectedColumns()).toEqual(['other'])
})

test('switching or removing the active preview and toggling sum reset table controls but retain dates', async () => {
	await renderChart()
	await waitForUi(() => expect(selectedColumns()).toEqual(['date']))
	await click(button('Preview Beta'))
	expect(selectedColumns()).toEqual(['date', 'value', 'other'])
	expect(await sharedLink()).toMatchObject({
		sort: { column: 'date', dir: 'desc' },
		dateRange: { kind: 'custom', from: '2026-01-01', to: '2026-12-31' }
	})
	await click(column('other'))
	await click(button('Preview Beta'))
	expect(selectedColumns()).toEqual(['date', 'value'])
	await click(button('Remove Beta'))
	expect(selectedColumns()).toEqual(['date', 'value', 'other'])
	expect(await sharedLink()).toMatchObject({
		params: ['alpha'],
		dateRange: { kind: 'custom', from: '2026-01-01', to: '2026-12-31' }
	})
	await click(button('Sum all'))
	expect(selectedColumns()).toEqual(['date', 'total'])
	expect(await sharedLink()).toMatchObject({ dateRange: { kind: 'custom', from: '2026-01-01', to: '2026-12-31' } })
	await click(button('Sum all'))
	expect(selectedColumns()).toEqual(['date', 'value', 'other'])
})

test('category drafts use CSV protocols absent from the catalog and do not reselect a removed column', async () => {
	fetchCsv.mockResolvedValue(new Response('date,Alpha,Unlisted\n2026-09-01,20,30'))
	const categoryConfig = { ...config, columns: undefined, categoryBreakdown: { category: 'Lending' } }
	await renderChart(options, categoryConfig)
	await waitForUi(() => expect(selectedColumns()).toEqual(['date', 'Alpha', 'Unlisted']))
	expect(await sharedLink()).toMatchObject({ params: ['alpha', 'unlisted'] })
	await click(column('Unlisted'))
	await renderChart(options, categoryConfig)
	expect(await sharedLink()).toMatchObject({ columns: ['date', 'Alpha'] })
	const clearCategory = document.querySelector<HTMLButtonElement>('[aria-label="Clear category"]')!
	await click(clearCategory)
	expect(button('All categories').getAttribute('aria-expanded')).toBe('false')
	expect(button('Select Protocol').textContent?.trim()).toBe('Select Protocol')
	expect(document.activeElement).toBe(button('All categories'))
})

test('dataset defaults initialize from loaded rows and saved settings do not overwrite user edits', async () => {
	const saved: DatasetSavedConfig = {
		id: 'saved',
		createdAt: 1,
		name: 'Saved',
		kind: 'dataset',
		slug: dataset.slug,
		columns: ['date', 'missing'],
		sort: { column: 'value', dir: 'asc' }
	}
	await render(
		<DatasetPreviewModal dataset={dataset} authorizedFetch={fetchCsv} onClose={() => {}} initialConfig={saved} />
	)
	await settle()
	await waitForUi(() => expect(selectedColumns()).toEqual(['date']))
	expect(await sharedLink()).toMatchObject({ sort: { column: 'value', dir: 'asc' } })
	await waitForUi(() => expect(missingColumnNotices()).toBe(1))
	await click(column('date'))
	expect(selectedColumns()).toEqual([])
	await refreshCsv(`${csv}\n2026-09-03,50,2`)
	expect(selectedColumns()).toEqual([])
	expect(missingColumnNotices()).toBe(1)
})

test('dataset default sort initializes without a preset and remains user-editable after refresh', async () => {
	await render(<DatasetPreviewModal dataset={dataset} authorizedFetch={fetchCsv} onClose={() => {}} />)
	await settle()
	await waitForUi(() => expect(selectedColumns()).toEqual(['date', 'value', 'other']))
	expect(await sharedLink()).toMatchObject({ sort: { column: 'value', dir: 'desc' } })
	await click(button('value'))
	expect(await sharedLink()).toMatchObject({ sort: { column: 'value', dir: 'asc' } })
	await refreshCsv(`${csv}\n2026-09-03,50,2`)
	expect(await sharedLink()).toMatchObject({ sort: { column: 'value', dir: 'asc' } })
})
