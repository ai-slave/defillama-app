// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { appMetadataFixtures } from '~/utils/testing/appMetadata'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
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

async function renderBuilder(initial: ChartBuilderConfig) {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	http.serve({
		...appMetadataFixtures(),
		'https://api.llama.fi/chains2': { categories: [] },
		'http://localhost:3000/api/public/pro-dashboard/chart-builder/': { series: [] }
	})
	const change = vi.fn()
	function Harness() {
		const [config, setConfig] = useState(initial)
		return (
			<ChartBuilderTab
				chartBuilder={config}
				chartBuilderName=""
				chainOptions={[]}
				protocolOptions={[]}
				protocolsLoading={false}
				timePeriod="365d"
				onChartBuilderNameChange={vi.fn()}
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
	return change
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
	const change = await renderBuilder(initializeFromEditItem(undefined).chartBuilder)
	expect(change).not.toHaveBeenCalled()
	await pressKey(radio('Chart type', 'stackedArea'), 'ArrowRight')
	await vi.waitFor(() => expect(radio('Chart type', 'line').checked).toBe(true))
	await act(async () => radio('Chart type', 'line').click())
	expect(change.mock.calls).toEqual([[{ chartType: 'line' }]])
	await pressKey(radio('Display value as', 'timeSeries'), 'ArrowRight')
	await vi.waitFor(() => expect(radio('Display value as', 'percentage').checked).toBe(true))
	await pressKey(radio('Display value as', 'percentage'), 'ArrowLeft')
	await vi.waitFor(() => expect(radio('Display value as', 'timeSeries').checked).toBe(true))
	expect(change.mock.calls).toEqual([
		[{ chartType: 'line' }],
		[{ displayAs: 'percentage' }],
		[{ displayAs: 'timeSeries' }]
	])
})

test('grouping changes preserve metric normalization and conditional percentage availability', async () => {
	const change = await renderBuilder({
		...initializeFromEditItem(undefined).chartBuilder,
		mode: 'protocol',
		metric: 'chain-fees',
		protocol: 'Ethereum',
		chartType: 'line'
	})
	expect(radio('Display value as', 'percentage')).not.toBeNull()
	await pressKey(radio('Grouping mode', 'protocol'), 'ArrowLeft')
	await vi.waitFor(() => expect(radio('Grouping mode', 'chains').checked).toBe(true))
	expect(change).toHaveBeenLastCalledWith({
		mode: 'chains',
		chains: [],
		protocol: undefined,
		metric: 'tvl',
		chartType: 'stackedArea'
	})
	expect(radio('Chart type', 'stackedArea').checked).toBe(true)
	await pressKey(radio('Grouping mode', 'chains'), 'ArrowRight')
	await vi.waitFor(() => expect(radio('Grouping mode', 'protocol').checked).toBe(true))
	expect(change).toHaveBeenLastCalledWith({ mode: 'protocol', chains: [], protocol: undefined })
})

test('percentage is absent for incomplete breakdowns and mount does not rewrite the draft', async () => {
	const change = await renderBuilder({
		...initializeFromEditItem(undefined).chartBuilder,
		mode: 'protocol',
		metric: 'fees'
	})
	expect(radio('Display value as', 'percentage')).toBeNull()
	await pressKey(radio('Display value as', 'timeSeries'), 'ArrowRight')
	expect(radio('Display value as', 'timeSeries').checked).toBe(true)
	expect(change).not.toHaveBeenCalled()
})
