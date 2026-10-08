// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { appMetadataFixtures } from '~/utils/testing/appMetadata'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import { AppMetadataProvider } from '../../../AppMetadataContext'
import { normalizeChartBuilderConfig } from '../../../chartBuilderCapabilities'
import { ChartBuilderTab } from '../ChartBuilderTab'
import { initializeFromEditItem } from '../modalReducer'
import type { ChartBuilderConfig } from '../types'

// The builder's category and preview requests answer empty; these tests only drive the radio controls.
const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
let client: QueryClient
afterEach(async () => {
	await act(async () => root.unmount())
	client.clear()
	container.remove()
})

async function renderBuilder(initial: ChartBuilderConfig, previewStatus = 200) {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	http.serve({
		...appMetadataFixtures(),
		'https://api.llama.fi/chains2': { categories: [] },
		'http://localhost:3000/api/public/pro-dashboard/chart-builder/': () =>
			previewStatus === 200 ? Response.json({ series: [] }) : new Response(null, { status: previewStatus })
	})
	const change = vi.fn()
	const nameChange = vi.fn()
	function Harness() {
		const [config, setConfig] = useState(initial)
		return (
			<ChartBuilderTab
				error={null}
				pane="configure"
				onPaneChange={vi.fn()}
				chartBuilder={config}
				chartBuilderName=""
				chainOptions={[]}
				protocolOptions={[]}
				protocolsLoading={false}
				timePeriod="365d"
				onChartBuilderNameChange={nameChange}
				onChartBuilderChange={(updates) => {
					change(updates)
					setConfig((previous) => normalizeChartBuilderConfig({ ...previous, ...updates }))
				}}
			/>
		)
	}
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AppMetadataProvider>
					<DashboardTestProvider>
						<Harness />
					</DashboardTestProvider>
				</AppMetadataProvider>
			</QueryClientProvider>
		)
	)
	return { change, nameChange }
}
function radio(group: string, value: string) {
	return document.querySelector<HTMLInputElement>(`[role="radiogroup"][aria-label="${group}"] input[value="${value}"]`)!
}
async function pressKey(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
	})
}

test('chart and display selection uses arrows without changing the draft on mount or repeated selection', async () => {
	const { change } = await renderBuilder(initializeFromEditItem(undefined).chartBuilder)
	expect(change).not.toHaveBeenCalled()
	await pressKey(radio('Chart type', 'stackedArea'), 'ArrowRight')
	await waitForUi(() => expect(radio('Chart type', 'line').checked).toBe(true))
	await act(async () => radio('Chart type', 'line').click())
	expect(change.mock.calls).toEqual([[{ chartType: 'line' }]])
	await pressKey(radio('Display value as', 'timeSeries'), 'ArrowRight')
	await waitForUi(() => expect(radio('Display value as', 'percentage').checked).toBe(true))
	await pressKey(radio('Display value as', 'percentage'), 'ArrowLeft')
	await waitForUi(() => expect(radio('Display value as', 'timeSeries').checked).toBe(true))
	expect(change.mock.calls).toEqual([
		[{ chartType: 'line' }],
		[{ displayAs: 'percentage' }],
		[{ displayAs: 'timeSeries' }]
	])
})

test('grouping changes preserve metric normalization and conditional percentage availability', async () => {
	const { change } = await renderBuilder({
		...initializeFromEditItem(undefined).chartBuilder,
		mode: 'protocol',
		metric: 'chain-fees',
		protocol: 'Ethereum',
		chartType: 'line'
	})
	expect(radio('Display value as', 'percentage')).not.toBeNull()
	await pressKey(radio('Grouping mode', 'protocol'), 'ArrowLeft')
	await waitForUi(() => expect(radio('Grouping mode', 'chains').checked).toBe(true))
	expect(change).toHaveBeenLastCalledWith({
		mode: 'chains',
		chains: [],
		protocol: undefined,
		metric: 'tvl',
		chartType: 'stackedArea'
	})
	expect(radio('Chart type', 'stackedArea').checked).toBe(true)
	await pressKey(radio('Grouping mode', 'chains'), 'ArrowRight')
	await waitForUi(() => expect(radio('Grouping mode', 'protocol').checked).toBe(true))
	expect(change).toHaveBeenLastCalledWith({ mode: 'protocol', chains: [], protocol: undefined })
})

test('percentage is absent for incomplete breakdowns and mount does not rewrite the draft', async () => {
	const { change } = await renderBuilder({
		...initializeFromEditItem(undefined).chartBuilder,
		mode: 'protocol',
		metric: 'fees'
	})
	expect(radio('Display value as', 'percentage')).toBeNull()
	await pressKey(radio('Display value as', 'timeSeries'), 'ArrowRight')
	expect(radio('Display value as', 'timeSeries').checked).toBe(true)
	expect(change).not.toHaveBeenCalled()
})

test('the card name field is found by its visible label and edits the name', async () => {
	const { nameChange } = await renderBuilder(initializeFromEditItem(undefined).chartBuilder)
	const label = [...document.querySelectorAll('label')].find((node) => node.textContent === 'Card name (optional)')!
	const input = document.getElementById(label.htmlFor) as HTMLInputElement
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Top fees')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(nameChange.mock.calls).toEqual([['Top fees']])
})

test('a preview that fails to load says so and offers a retry, and an empty one says there is no data', async () => {
	const config = normalizeChartBuilderConfig({ ...initializeFromEditItem(null).chartBuilder, metric: 'fees' })
	await renderBuilder(config, 503)
	await waitForUi(() => expect(document.body.textContent).toContain("Couldn't load the preview."))
	expect(document.body.textContent).not.toContain('Configure chart settings to see preview')
	await act(async () => root.unmount())
	client.clear()
	container.remove()

	await renderBuilder(config)
	await waitForUi(() => expect(document.body.textContent).toContain('No data for these settings.'))
})
