// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ChartDatasetDefinition } from '../chart-datasets'
import { ChartDatasetModal } from '../ChartDatasetModal'
import { DatasetPreviewModal } from '../DatasetPreviewModal'
import type { DatasetDefinition } from '../datasets'

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
	extractRows: () => []
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
const csv = 'date,value,other\n2026-09-01,20,3\n2026-09-02,10,4'
let root: Root
let container: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		queueMicrotask(() => callback(0))
		return 1
	})
	vi.stubGlobal('cancelAnimationFrame', () => {})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	vi.unstubAllGlobals()
	client.clear()
	container.remove()
	localStorage.clear()
})
async function render(node: ReactNode) {
	await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>))
}
async function type(value: string) {
	const input = document.querySelector<HTMLInputElement>('input[placeholder^="Filter rows"]')!
	const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
	await act(async () => {
		setValue.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
// The first column's header cell carries the sticky shadow; its table scroller sits above the header row,
// and the right-edge fade is the scroller's sibling.
function stickyHeader() {
	return document.querySelector<HTMLInputElement>('input[aria-label="Include date column"]')!.parentElement!
		.parentElement!
}
function scroller() {
	return stickyHeader().parentElement!.parentElement!.parentElement!
}
function shadows() {
	return {
		sticky: getComputedStyle(stickyHeader()).boxShadow,
		fade: getComputedStyle(scroller().previousElementSibling!).opacity
	}
}
// jsdom has no layout, so the scroller reports whatever the test sets.
async function scrollTo(scrollLeft: number) {
	const element = scroller()
	for (const [property, value] of Object.entries({ scrollLeft, scrollWidth: 1200, clientWidth: 600 })) {
		Object.defineProperty(element, property, { configurable: true, value })
	}
	await act(async () => element.dispatchEvent(new Event('scroll')))
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
}
const shadowAtStart = { sticky: 'none', fade: '1' }
const shadowMidway = { sticky: '4px 0 8px -2px rgba(0,0,0,0.25)', fade: '1' }
const shadowAtEnd = { sticky: '4px 0 8px -2px rgba(0,0,0,0.25)', fade: '0' }

async function renderChart() {
	await render(
		<ChartDatasetModal
			dataset={chart}
			options={[{ value: 'alpha', label: 'Alpha' }]}
			authorizedFetch={async () => new Response(csv)}
			onClose={() => {}}
			initialConfig={{ id: 'saved', createdAt: 1, name: 'Saved', kind: 'chart', slug: chart.slug, params: ['alpha'] }}
		/>
	)
	await waitForUi(() => expect(document.querySelector('input[aria-label="Include date column"]')).not.toBeNull())
}
async function renderDataset() {
	await render(
		<DatasetPreviewModal dataset={dataset} authorizedFetch={async () => new Response(csv)} onClose={() => {}} />
	)
	await waitForUi(() => expect(document.querySelector('input[aria-label="Include date column"]')).not.toBeNull())
}

test.each([
	['chart', renderChart],
	['dataset', renderDataset]
])(
	'%s preview shows the sticky shadow after a horizontal scroll and fades the right edge until the end',
	async (_, open) => {
		await open()
		await scrollTo(0)
		expect(shadows()).toEqual(shadowAtStart)
		await scrollTo(200)
		expect(shadows()).toEqual(shadowMidway)
		await scrollTo(600)
		expect(shadows()).toEqual(shadowAtEnd)
	}
)

test.each([
	['chart', renderChart],
	['dataset', renderDataset]
])('%s preview keeps updating scroll shadows after a search with no matches is cleared', async (_, open) => {
	await open()
	await type('no such row')
	await waitForUi(() => expect(document.querySelector('input[aria-label="Include date column"]')).toBeNull())
	await type('')
	await waitForUi(() => expect(document.querySelector('input[aria-label="Include date column"]')).not.toBeNull())
	await scrollTo(200)
	expect(shadows()).toEqual(shadowMidway)
	await scrollTo(600)
	expect(shadows()).toEqual(shadowAtEnd)
})
