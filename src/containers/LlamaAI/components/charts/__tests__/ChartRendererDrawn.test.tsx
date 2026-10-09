// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as echarts from 'echarts/core'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import type { ChartConfiguration } from '~/containers/LlamaAI/chartTypes'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, push: vi.fn(), pathname: '/ai/chat' }) }))
vi.mock('~/components/ChartExport/ChartPngExportButton', () => ({ ChartPngExportButton: () => null }))

import { pickOption } from '~/utils/testing/pickOption'
import { ChartRenderer } from '../ChartRenderer'

function revenueChart(id: string, datasetName?: string): ChartConfiguration {
	return {
		id,
		type: 'combo',
		title: id.toUpperCase(),
		description: '',
		...(datasetName ? { datasetName } : {}),
		axes: {
			x: { field: 'timestamp', label: 'Date', type: 'time' },
			yAxes: [{ id: 'value', fields: ['fees', 'revenue'], label: 'USD', position: 'left', valueSymbol: '$' }]
		},
		series: [
			{
				name: 'Fees',
				type: 'bar',
				yAxisId: 'value',
				metricClass: 'flow',
				dataMapping: { xField: 'timestamp', yField: 'fees' },
				styling: {}
			},
			{
				name: 'Revenue',
				type: 'bar',
				yAxisId: 'value',
				metricClass: 'flow',
				dataMapping: { xField: 'timestamp', yField: 'revenue' },
				styling: {}
			}
		],
		dataTransformation: { timeField: 'timestamp', metrics: ['fees', 'revenue'] },
		displayOptions: { canStack: true, canShowPercentage: true, canShowCumulative: true, supportsGrouping: true }
	}
}

const rows = [
	{ timestamp: 1_767_225_600, fees: 10, revenue: 4 },
	{ timestamp: 1_767_312_000, fees: 12, revenue: 5 }
]

let container: HTMLDivElement
let root: Root
// Charts probe their icons through React Query.
const client = new QueryClient()
const render = (node: ReactNode) =>
	act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>))

// ChartRenderer lazy-loads the chart; load it once so every test draws without waiting on the import.
beforeAll(() => import('~/components/ECharts/MultiSeriesChart'))

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	installChartCanvas()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
	vi.restoreAllMocks()
})

/** The drawn ECharts options in document order: the applied chart, then the style editor's preview. */
const drawnOptions = () =>
	[...document.querySelectorAll<HTMLElement>('[_echarts_instance_]')].map(
		(element) => echarts.getInstanceByDom(element)!.getOption() as Record<string, any>
	)
// Charts load lazily and redraw after React commits, so assertions retry until the drawing settles.
const settle = (assertion: () => void) =>
	act(async () => {
		await waitForUi(assertion, { timeout: 5000 })
	})
const seriesTypes = (option: Record<string, any>) =>
	option.series.map((series: { name: string; type: string }) => `${series.name}:${series.type}`)

async function clickButton(text: string) {
	const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(candidate) => candidate.textContent?.trim() === text || candidate.getAttribute('aria-label') === text
	)
	if (!button) throw new Error(`Expected ${text} button`)
	await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

test('each tab draws its own persisted dataset', async () => {
	await render(
		<ChartRenderer
			charts={[revenueChart('a', 'dataset-a'), revenueChart('b', 'dataset-b')]}
			chartData={{ 'dataset-a': [rows[0]], 'dataset-b': [rows[1]] }}
		/>
	)
	const drawnValues = () =>
		drawnOptions().map((option) => option.dataset[0].source.map((row: Array<unknown>) => row.slice(1)))

	await settle(() => expect(drawnValues()).toEqual([[[10, 4]]]))
	await clickButton('B')
	await settle(() => expect(drawnValues()).toEqual([[[12, 5]]]))
})

test('previewing an area series redraws only the preview, as a line', async () => {
	await render(<ChartRenderer charts={[revenueChart('revenue')]} chartData={rows} onLocalStyleSave={() => undefined} />)
	await clickButton('Edit chart style')
	await pickOption(document.querySelector<HTMLElement>('[aria-label="Series 2 type"]')!, 'area')

	await settle(() =>
		expect(drawnOptions().map(seriesTypes)).toEqual([
			['Fees:bar', 'Revenue:bar'],
			['Fees:bar', 'Revenue:line']
		])
	)
})

test('a draft annotation is drawn in the preview but not on the applied chart', async () => {
	await render(<ChartRenderer charts={[revenueChart('revenue')]} chartData={rows} onLocalStyleSave={() => undefined} />)
	await clickButton('Edit chart style')
	await clickButton('+ Add annotation')
	const label = document.querySelector<HTMLInputElement>('[aria-label="Annotation 1 label"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(label, 'Preview note')
		label.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => label.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

	// Chat charts draw annotations as mark lines on the first series.
	const annotationLabels = (option: Record<string, any>) =>
		(option.series[0].markLine?.data ?? []).map((line: { name: string }) => line.name)
	await settle(() => expect(drawnOptions().map(annotationLabels)).toEqual([[], ['Preview note']]))
})
