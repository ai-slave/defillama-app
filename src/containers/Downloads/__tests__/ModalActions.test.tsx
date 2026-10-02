// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ChartDatasetDefinition } from '../chart-datasets'
import { ChartDatasetModal } from '../ChartDatasetModal'
import { DatasetPreviewModal } from '../DatasetPreviewModal'
import type { DatasetDefinition } from '../datasets'
import { MultiMetricModal } from '../MultiMetricModal'
import type { ChartSavedConfig, MultiMetricSavedConfig } from '../savedDownloads'

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ toast: toasts, default: toasts }))
// Downloads write a Blob through an object URL, which happy-dom cannot follow.
vi.mock('~/utils/download', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/download')>()),
	downloadTabular: vi.fn()
}))

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
	extractItems: () => []
}
const options = [
	{ value: 'alpha', label: 'Alpha', category: 'Lending' },
	{ value: 'beta', label: 'Beta', category: 'Lending' },
	{ value: 'gamma', label: 'Gamma', category: 'Lending' }
]
const chartConfig: ChartSavedConfig = {
	id: 'saved',
	createdAt: 1,
	name: 'Saved',
	kind: 'chart',
	slug: chart.slug,
	params: ['alpha', 'beta']
}
const metricsConfig: MultiMetricSavedConfig = {
	id: 'saved',
	createdAt: 1,
	name: 'Saved',
	kind: 'multiMetric',
	paramType: 'protocol',
	param: 'alpha',
	paramLabel: 'Alpha',
	metrics: ['protocol-tvl-chart', 'protocol-active-loans-chart']
}
const csv = 'date,value\n2026-09-01,20\n2026-09-02,10'

let root: Root
let container: HTMLDivElement
let client: QueryClient
let writeClipboard: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>
const fetchCsv = vi.fn(async () => new Response(csv))
beforeEach(() => {
	vi.clearAllMocks()
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	writeClipboard = vi.fn(async () => {})
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: writeClipboard } })
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
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
	await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>))
	await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
}
const renderChart = (params = chartConfig.params) =>
	render(
		<ChartDatasetModal
			dataset={chart}
			options={options}
			authorizedFetch={fetchCsv}
			onClose={() => {}}
			initialConfig={{ ...chartConfig, params }}
		/>
	)
const renderMetrics = () =>
	render(
		<MultiMetricModal
			chartOptionsMap={{ 'protocol-tvl-chart': options, 'protocol-active-loans-chart': options }}
			authorizedFetch={fetchCsv}
			onClose={() => {}}
			isPreview={false}
			initialConfig={metricsConfig}
		/>
	)
function button(name: string) {
	const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(node) => accessibleName(node) === name || node.title === name
	)
	if (!found) throw new Error(`Missing button: ${name}`)
	return found
}
/** Clicks as a user does: the control takes focus first. */
async function press(node: HTMLElement) {
	await act(async () => {
		node.focus()
		node.click()
	})
}
const announced = () => [...document.querySelectorAll('[role="status"]')].map((node) => node.textContent).join('|')

test('a copied link is announced inside the modal instead of in a toast', async () => {
	await render(<DatasetPreviewModal dataset={dataset} authorizedFetch={fetchCsv} onClose={() => {}} />)
	await waitForUi(() => expect(button('Copy shareable link')).toBeTruthy())
	await press(button('Copy shareable link'))
	await waitForUi(() => expect(announced()).toContain('Link copied'))
	expect(toasts.success).not.toHaveBeenCalled()
})

test('a failed copy keeps its reason in the modal until the next action', async () => {
	writeClipboard.mockRejectedValueOnce(new Error('denied'))
	await renderChart()
	await waitForUi(() => expect(button('Copy shareable link')).toBeTruthy())
	await press(button('Copy shareable link'))
	await waitForUi(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Failed to copy link'))
	expect(toasts.error).not.toHaveBeenCalled()
	await press(button('Copy shareable link'))
	await waitForUi(() => expect(announced()).toContain('Link copied'))
	expect(document.querySelector('[role="alert"]')).toBeNull()
})

test('a download from the sidebar is announced inside the modal', async () => {
	await renderMetrics()
	await waitForUi(() => expect(button('Download combined CSV').disabled).toBe(false))
	await press(button('Download combined CSV'))
	await waitForUi(() => expect(announced()).toContain('Downloaded alpha_metrics.csv'))
	expect(toasts.success).not.toHaveBeenCalled()
})

test('the multi-metric modal is named by its heading', async () => {
	await renderMetrics()
	const dialog = await waitForUi(() => {
		const found = document.querySelector('[role="dialog"]')
		expect(found).not.toBeNull()
		return found!
	})
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Alpha Combined')
})

test('removing a selected protocol hands focus to the next row; with one left the list closes onto the picker', async () => {
	await renderChart(['alpha', 'beta', 'gamma'])
	await waitForUi(() => expect(button('Remove Alpha')).toBeTruthy())
	await press(button('Remove Alpha'))
	expect(document.activeElement).toBe(button('Remove Beta'))
	await press(button('Remove Beta'))
	expect(document.activeElement).toBe(button('Gamma'))
	expect(document.querySelector('[aria-label="Remove Gamma"]')).toBeNull()
})

test('each selected metric offers its own download, named for the metric', async () => {
	await renderMetrics()
	await waitForUi(() =>
		expect(
			[...document.querySelectorAll<HTMLButtonElement>('aside button')]
				.map(accessibleName)
				.filter((name) => name.startsWith('Download'))
		).toEqual(['Download TVL CSV', 'Download Active Loans CSV'])
	)
})

test('clearing the selected metrics hands focus to the metric picker', async () => {
	await renderMetrics()
	await waitForUi(() => expect(button('Clear all')).toBeTruthy())
	await press(button('Clear all'))
	expect(accessibleName(document.activeElement!)).toBe('Pick metrics')
})

test('Add all and Clear all in the protocol picker leave focus in its search field', async () => {
	await renderChart()
	await press(button('2 protocols'))
	const search = await waitForUi(() => {
		const found = document.querySelector<HTMLInputElement>('input[placeholder="Search protocol…"]')
		expect(found).not.toBeNull()
		return found!
	})
	await press(button('Add all (1)'))
	expect(document.activeElement).toBe(search)
	const popover = search.closest('[role="dialog"]')!
	await press([...popover.querySelectorAll('button')].find((node) => node.textContent === 'Clear all')!)
	expect(document.activeElement).toBe(search)
})

test('on a phone, More actions offers Copy, Save preset and Copy link, and Copy link copies the share link', async () => {
	await render(<DatasetPreviewModal dataset={dataset} authorizedFetch={fetchCsv} onClose={() => {}} />)
	await waitForUi(() => expect(button('More actions')).toBeTruthy())
	await press(button('More actions'))
	const items = await waitForUi(() => {
		const found = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
		expect(found.map(accessibleName)).toEqual(['Copy', 'Save preset', 'Copy link'])
		return found
	})
	await press(items[2])
	await waitForUi(() => expect(announced()).toContain('Link copied'))
	// The menu has closed, so the dialog shows the confirmation itself.
	expect([...document.querySelectorAll('[role="dialog"] p')].map((node) => node.textContent)).toContain('Link copied')
	expect(writeClipboard).toHaveBeenCalledExactlyOnceWith(
		'http://localhost:3000/downloads?k=dataset&s=test-dataset&c=date%2Cvalue'
	)
})

test('the phone Selected toggle counts the selected protocols, says whether the list is showing, and leaves at one', async () => {
	await renderChart()
	const toggle = await waitForUi(() => button('Selected (2)'))
	expect(toggle.getAttribute('aria-pressed')).toBe('false')
	await press(toggle)
	expect(button('Selected (2)').getAttribute('aria-pressed')).toBe('true')
	await press(button('Remove Alpha'))
	expect([...document.querySelectorAll('button')].some((node) => node.textContent?.startsWith('Selected'))).toBe(false)
	expect(button('Beta')).toBeTruthy()
})

test('previewing a protocol from the phone Selected list switches back to the table', async () => {
	await renderChart()
	await press(await waitForUi(() => button('Selected (2)')))
	await press(button('Preview Beta'))
	expect(button('Selected (2)').getAttribute('aria-pressed')).toBe('false')
	expect(button('Preview Beta').getAttribute('aria-current')).toBe('true')
})

test('the phone Selected toggle counts the selected metrics and says whether the list is showing', async () => {
	await renderMetrics()
	const toggle = await waitForUi(() => button('Selected (2)'))
	expect(toggle.getAttribute('aria-pressed')).toBe('false')
	await press(toggle)
	expect(button('Selected (2)').getAttribute('aria-pressed')).toBe('true')
})
