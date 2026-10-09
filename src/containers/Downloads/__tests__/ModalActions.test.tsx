// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ChartDatasetDefinition } from '../chart-datasets'
import { ChartDatasetModal } from '../ChartDatasetModal'
import { DatasetPreviewModal } from '../DatasetPreviewModal'
import type { DatasetDefinition } from '../datasets'
import { MultiMetricModal } from '../MultiMetricModal'
import type { ChartSavedConfig, MultiMetricSavedConfig } from '../savedDownloads'

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ toast: toasts, default: toasts }))
vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)
const downloads = installDownloadSink()

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
	vi.useRealTimers()
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
/** Opens a picker from its trigger with the keyboard and clicks the option. */
async function pickOption(trigger: HTMLElement, label: string) {
	await act(async () => {
		trigger.focus()
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
	})
	const option = await waitForUi(() => {
		const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
			(row) => row.textContent === label
		)
		expect(found).toBeDefined()
		return found!
	})
	await act(async () => option.click())
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

test('a download from the sidebar saves the combined file and is announced inside the modal', async () => {
	// Only Date is faked: the combined file name carries the download day.
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(new Date('2026-09-15T12:00:00Z'))
	await renderMetrics()
	await waitForUi(() => expect(button('Download combined CSV').disabled).toBe(false))
	await press(button('Download combined CSV'))
	await waitForUi(() => expect(announced()).toContain('Downloaded alpha_metrics.csv'))
	expect(toasts.success).not.toHaveBeenCalled()
	expect(downloads.map(({ filename }) => filename)).toEqual(['alpha_metrics_2026-09-15.csv'])
	expect(await downloads[0]!.blob.text()).toBe('date,tvl,active_loans\n2026-09-01,20,20\n2026-09-02,10,10')
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
	expect(document.activeElement).toBe(button('Protocol: Gamma'))
	expect(document.querySelector('[aria-label="Remove Gamma"]')).toBeNull()
})

test.each(['suggestion', 'picker'] as const)(
	'picking a protocol from the empty combined report by %s lands on the metric picker',
	async (via) => {
		await render(
			<MultiMetricModal
				chartOptionsMap={{ 'protocol-tvl-chart': options }}
				authorizedFetch={fetchCsv}
				onClose={() => {}}
				isPreview={false}
			/>
		)
		const trigger = await waitForUi(() => button('Protocol Pick a protocol'))
		if (via === 'suggestion') await press(button('Alpha'))
		else await pickOption(trigger, 'Alpha')
		await waitForUi(() => expect(accessibleName(document.activeElement!)).toBe('Metrics: None'))
	}
)

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
	expect(accessibleName(document.activeElement!)).toBe('Metrics: None')
})

test('Select all in the protocol picker adds every protocol, then clears them, keeping focus in the open picker', async () => {
	await renderChart()
	const trigger = await waitForUi(() => button('Protocol: 2 of 3'))
	await act(async () => {
		trigger.focus()
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
	})
	const list = await waitForUi(() => {
		const found = document.querySelector<HTMLElement>('[role="listbox"]')
		expect(found).not.toBeNull()
		return found!
	})
	const selectAll = () =>
		[...list.querySelectorAll<HTMLElement>('[role="option"]')].find((row) => row.textContent?.startsWith('Select all'))!
	// Three protocols open without a search field, so focus stays on the trigger or in the list.
	const focusInPicker = () => document.activeElement === trigger || list.contains(document.activeElement)

	await act(async () => selectAll().click())
	expect(trigger.textContent).toBe('Protocol: All')
	expect(focusInPicker()).toBe(true)
	await act(async () => selectAll().click())
	expect(trigger.textContent).toBe('Protocol: None')
	expect(focusInPicker()).toBe(true)
	expect(trigger.getAttribute('aria-expanded')).toBe('true')
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
	// The menu has closed, so the dialog announces the confirmation itself.
	await waitForUi(() =>
		expect([...document.querySelectorAll('[role="dialog"] [role="status"]')].map((node) => node.textContent)).toContain(
			'Link copied'
		)
	)
	// SharedLink.test.tsx owns what the link encodes; here it only has to be a Downloads link.
	expect(writeClipboard).toHaveBeenCalledOnce()
	expect(new URL(writeClipboard.mock.calls[0]![0]).pathname).toBe('/downloads')
})

test('the phone Selected toggle counts the selected protocols, says whether the list is showing, and leaves at one', async () => {
	await renderChart()
	const toggle = await waitForUi(() => button('Selected (2)'))
	expect(toggle.getAttribute('aria-pressed')).toBe('false')
	await press(toggle)
	expect(button('Selected (2)').getAttribute('aria-pressed')).toBe('true')
	await press(button('Remove Alpha'))
	expect([...document.querySelectorAll('button')].some((node) => node.textContent?.startsWith('Selected'))).toBe(false)
	const trigger = button('Protocol: Beta')

	// A second pick later brings the toggle back on the table, not on the list it last showed.
	await pickOption(trigger, 'Gamma')
	expect(button('Selected (2)').getAttribute('aria-pressed')).toBe('false')
})

test('previewing a protocol from the phone Selected list switches back to the table', async () => {
	await renderChart()
	await press(await waitForUi(() => button('Selected (2)')))
	await press(button('Beta'))
	expect(button('Selected (2)').getAttribute('aria-pressed')).toBe('false')
	expect(button('Beta').getAttribute('aria-current')).toBe('true')
})

test('the phone Selected toggle counts the selected metrics and says whether the list is showing', async () => {
	await renderMetrics()
	const toggle = await waitForUi(() => button('Selected (2)'))
	expect(toggle.getAttribute('aria-pressed')).toBe('false')
	await press(toggle)
	expect(button('Selected (2)').getAttribute('aria-pressed')).toBe('true')
})

const listButton = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('aside button')].find((node) => accessibleName(node) === name)!

test('the selected metrics list marks the metric the table previews', async () => {
	await renderMetrics()
	await waitForUi(() => expect(listButton('TVL').getAttribute('aria-current')).toBe('true'))
	await press(listButton('Active Loans'))
	expect(listButton('Active Loans').getAttribute('aria-current')).toBe('true')
	expect(listButton('TVL').hasAttribute('aria-current')).toBe(false)
})

test('each selected metric has a Remove button named for it', async () => {
	await renderMetrics()
	await waitForUi(() =>
		expect(
			[...document.querySelectorAll('aside button')].map(accessibleName).filter((name) => name.startsWith('Remove'))
		).toEqual(['Remove TVL', 'Remove Active Loans'])
	)
	await press(button('Remove TVL'))
	expect(accessibleName(document.activeElement!)).toBe('Metrics: Active Loans')
})

/** Opens the metric picker from its trigger with the keyboard and returns the option named `name`. */
async function metricOption(trigger: string, name: string) {
	await act(async () => {
		const node = button(trigger)
		node.focus()
		node.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
	})
	return waitForUi(() => {
		const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((row) =>
			row.textContent?.startsWith(name)
		)
		expect(found).toBeDefined()
		return found!
	})
}

test('a previewed metric that is removed and picked again does not take the preview back', async () => {
	await renderMetrics()
	await press(await waitForUi(() => listButton('Active Loans')))
	await press(button('Remove Active Loans'))
	const option = await metricOption('Metrics: TVL', 'Active Loans')
	await act(async () => option.click())
	expect(listButton('TVL').getAttribute('aria-current')).toBe('true')
	expect(listButton('Active Loans').hasAttribute('aria-current')).toBe(false)
})

test('Select all keeps the metric the table already previews', async () => {
	await render(
		<MultiMetricModal
			chartOptionsMap={{ 'protocol-tvl-chart': options, 'protocol-active-loans-chart': options }}
			authorizedFetch={fetchCsv}
			onClose={() => {}}
			isPreview={false}
			initialConfig={{ ...metricsConfig, metrics: ['protocol-active-loans-chart'] }}
		/>
	)
	await waitForUi(() => button('Metrics: Active Loans'))
	const selectAll = await metricOption('Metrics: Active Loans', 'Select all')
	await act(async () => selectAll.click())
	await waitForUi(() => expect(listButton('Active Loans').getAttribute('aria-current')).toBe('true'))
	expect(listButton('TVL').hasAttribute('aria-current')).toBe(false)
})
