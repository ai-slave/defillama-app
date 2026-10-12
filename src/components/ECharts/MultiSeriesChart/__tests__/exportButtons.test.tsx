// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as echarts from 'echarts/core'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import MultiSeriesChart from '..'
import type { ChartExportHandle } from '../../../ChartExport/types'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '../types'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/', push: vi.fn() }) }))

const CHARTS: Array<MultiSeriesChartSeriesConfig> = [{ type: 'line', name: 'Value', encode: { x: 0, y: 1 } }]
const dataset = (...values: Array<number>): MultiSeriesChartDataset => ({
	dimensions: ['timestamp', 'Value'],
	source: values.map((value, index) => [Date.UTC(2026, 8, 20 + index), value])
})

let container: HTMLDivElement
let root: Root
// Charts probe their icons through React Query.
const client = new QueryClient()

beforeEach(() => {
	installChartCanvas()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})

const render = (node: ReactNode) =>
	act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>))

const exportButtonNames = () =>
	[...container.querySelectorAll('button')]
		.map((button) => accessibleName(button))
		.filter((name) => name.startsWith('.'))

test('a chart drawing its own buttons shows .csv and .png only while it plots a point', async () => {
	// A series with no rows, as when every compared protocol failed to load, has nothing to export.
	await render(<MultiSeriesChart title="TVL" dataset={dataset()} charts={CHARTS} exportButtons="auto" />)
	expect(exportButtonNames()).toEqual([])

	await render(<MultiSeriesChart title="TVL" dataset={dataset(10, 20)} charts={CHARTS} exportButtons="auto" />)
	expect(exportButtonNames()).toEqual(['.csv', '.png'])
})

test('a chart given a handle draws no buttons and hands the page its instance until it unmounts', async () => {
	let handle: ChartExportHandle | undefined
	function Page() {
		handle = useGetChartInstance()
		return <MultiSeriesChart title="TVL" dataset={dataset(10)} charts={CHARTS} exportButtons={handle} />
	}
	await render(<Page />)

	expect(exportButtonNames()).toEqual([])
	const element = container.querySelector<HTMLElement>('[_echarts_instance_]')!
	expect(handle!.chartInstance()).toBe(echarts.getInstanceByDom(element))

	await render(null)
	expect(handle!.chartInstance()).toBeNull()
})
