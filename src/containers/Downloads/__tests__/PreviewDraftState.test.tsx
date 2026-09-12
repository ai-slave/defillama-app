// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ChartDatasetDefinition } from '../chart-datasets'
import { ChartDatasetModal } from '../ChartDatasetModal'
import { DatasetPreviewModal } from '../DatasetPreviewModal'
import type { DatasetDefinition } from '../datasets'
import type { ChartSavedConfig, DatasetSavedConfig, SavedDownloadInput } from '../savedDownloads'

const mocks = vi.hoisted(() => ({ changed: vi.fn(), toast: vi.fn(), save: vi.fn(), recent: vi.fn() }))
vi.mock('~/contexts/LocalStorage', () => ({
	useSavedDownloads: () => ({ savedDownloads: [], saveDownload: mocks.save }),
	useRecentDownloads: () => ({ recordRecent: mocks.recent })
}))
vi.mock('react-hot-toast', () => ({ toast: Object.assign(mocks.toast, { error: mocks.toast, success: mocks.toast }) }))
vi.mock('~/auth/signupSource', () => ({ setSignupSource: vi.fn() }))
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
beforeEach(() => {
	vi.clearAllMocks()
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
})
async function render(node: ReactNode) {
	await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>))
}
function latest(): SavedDownloadInput {
	return mocks.changed.mock.calls.at(-1)![0]
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
			onConfigChange={mocks.changed}
		/>
	)
	await settle()
}

test('late options and CSV initialize saved selections once, preserving edits and empty selection', async () => {
	await renderChart([])
	await renderChart()
	await vi.waitFor(() => expect(selectedColumns()).toEqual(['date']))
	expect(latest()).toMatchObject({ sort: { column: 'value', dir: 'asc' } })
	await click(column('date'))
	expect(selectedColumns()).toEqual([])
	await renderChart([...options])
	expect(selectedColumns()).toEqual([])
	await act(async () =>
		client.setQueryData(['chart-preview', chart.slug, 'alpha', undefined], `${csv}\n2026-09-03,30,5`)
	)
	await settle()
	expect(selectedColumns()).toEqual([])
	await click(column('other'))
	expect(selectedColumns()).toEqual(['other'])
})

test('switching or removing the active preview and toggling sum reset table controls but retain dates', async () => {
	await renderChart()
	await vi.waitFor(() => expect(selectedColumns()).toEqual(['date']))
	await click(button('Preview Beta'))
	expect(selectedColumns()).toEqual(['date', 'value', 'other'])
	expect(latest()).toMatchObject({
		sort: { column: 'date', dir: 'desc' },
		dateRange: { kind: 'custom', from: '2026-01-01', to: '2026-12-31' }
	})
	await click(column('other'))
	await click(button('Preview Beta'))
	expect(selectedColumns()).toEqual(['date', 'value'])
	await click(button('Remove Beta'))
	expect(selectedColumns()).toEqual(['date', 'value', 'other'])
	expect(latest()).toMatchObject({
		params: ['alpha'],
		dateRange: { kind: 'custom', from: '2026-01-01', to: '2026-12-31' }
	})
	await click(button('Sum all'))
	expect(selectedColumns()).toEqual(['date', 'total'])
	expect(latest()).toMatchObject({ dateRange: { kind: 'custom', from: '2026-01-01', to: '2026-12-31' } })
	await click(button('Sum all'))
	expect(selectedColumns()).toEqual(['date', 'value', 'other'])
})

test('category drafts use CSV protocols absent from the catalog and do not reselect a removed column', async () => {
	fetchCsv.mockResolvedValue(new Response('date,Alpha,Unlisted\n2026-09-01,20,30'))
	const categoryConfig = { ...config, columns: undefined, categoryBreakdown: { category: 'Lending' } }
	await renderChart(options, categoryConfig)
	await vi.waitFor(() => expect(latest()).toMatchObject({ params: ['alpha', 'unlisted'] }))
	expect(selectedColumns()).toEqual(['date', 'Alpha', 'Unlisted'])
	await click(column('Unlisted'))
	await renderChart(options, categoryConfig)
	expect(latest()).toMatchObject({ columns: ['date', 'Alpha'] })
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
		<DatasetPreviewModal
			dataset={dataset}
			authorizedFetch={fetchCsv}
			onClose={() => {}}
			initialConfig={saved}
			onConfigChange={mocks.changed}
		/>
	)
	await settle()
	await vi.waitFor(() => expect(selectedColumns()).toEqual(['date']))
	expect(latest()).toMatchObject({ sort: { column: 'value', dir: 'asc' } })
	expect(mocks.toast.mock.calls.map(([message]) => message)).toEqual(['1 saved column no longer available: missing'])
	await click(column('date'))
	expect(selectedColumns()).toEqual([])
	await act(async () =>
		client.setQueryData(['downloads-preview', dataset.slug, null, undefined], `${csv}\n2026-09-03,50,2`)
	)
	await settle()
	expect(selectedColumns()).toEqual([])
	expect(mocks.toast.mock.calls.map(([message]) => message)).toEqual(['1 saved column no longer available: missing'])
})

test('dataset default sort initializes without a preset and remains user-editable after refresh', async () => {
	await render(
		<DatasetPreviewModal
			dataset={dataset}
			authorizedFetch={fetchCsv}
			onClose={() => {}}
			onConfigChange={mocks.changed}
		/>
	)
	await settle()
	await vi.waitFor(() => expect(latest()).toMatchObject({ sort: { column: 'value', dir: 'desc' } }))
	expect(selectedColumns()).toEqual(['date', 'value', 'other'])
	await click(button('value'))
	expect(latest()).toMatchObject({ sort: { column: 'value', dir: 'asc' } })
	await act(async () =>
		client.setQueryData(['downloads-preview', dataset.slug, null, undefined], `${csv}\n2026-09-03,50,2`)
	)
	await settle()
	expect(latest()).toMatchObject({ sort: { column: 'value', dir: 'asc' } })
})
