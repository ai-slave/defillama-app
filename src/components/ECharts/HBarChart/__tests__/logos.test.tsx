// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as echarts from 'echarts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { waitForUi } from '~/utils/testing/waitForUi'
import HBarChart from '..'

let container: HTMLDivElement
let root: Root
const client = new QueryClient()

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	installChartCanvas()
	// happy-dom loads no images. Logo URLs settle here: one containing "missing" fails, the others load. Other
	// images, such as ECharts' own, stay pending as before.
	vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement, url: string) {
		if (!url.startsWith('/icons/')) return
		queueMicrotask(() => this.dispatchEvent(new Event(url.includes('missing') ? 'error' : 'load')))
	})
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

async function renderBars(logos: Array<string>) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<HBarChart categories={['Aave', 'Lido']} values={[2, 1]} logos={logos} />
			</QueryClientProvider>
		)
	)
}

// The chart draws its own category labels until the logo overlay takes over.
function chartDrawsCategoryLabels() {
	const element = container.querySelector<HTMLElement>('[_echarts_instance_]')!
	const option = echarts.getInstanceByDom(element)!.getOption() as { yAxis: Array<{ axisLabel: { show?: boolean } }> }
	return option.yAxis[0].axisLabel.show !== false
}

test('logos replace the category labels once every logo loads', async () => {
	await renderBars(['/icons/aave-loads.png', '/icons/lido-loads.png'])
	await waitForUi(() => expect(chartDrawsCategoryLabels()).toBe(false))
})

test('one logo that fails to load keeps the category labels and shows no logos', async () => {
	await renderBars(['/icons/aave-loads-too.png', '/icons/lido-missing.png'])
	// Both probes settle within a task; give them one before checking nothing changed.
	await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
	expect(chartDrawsCategoryLabels()).toBe(true)
})
