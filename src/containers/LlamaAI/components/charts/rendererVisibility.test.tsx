// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import CandlestickChart from '~/components/ECharts/CandlestickChart'
import type { CandlestickPoint } from '~/components/ECharts/CandlestickChart/types'
import { EChartsRenderVisibilityProvider } from '~/components/ECharts/renderVisibility'
import ScatterChart from '~/components/ECharts/ScatterChart'
import { installChartCanvas } from '~/utils/test/chartCanvas'

afterEach(() => {
	vi.restoreAllMocks()
	document.body.replaceChildren()
})

// Stable data, as the chat message holds it: a new array would redraw the chart and reset its zoom.
const scatterData = [{ projectName: 'Project', sigma: 1, mu: 2 }]
const candles: Array<CandlestickPoint> = [
	[1, 10, 12, 9, 13, 100],
	[2, 12, 11, 10, 14, 120]
]

function Harness({ visible }: { visible: boolean }) {
	const [view, setView] = useState('chart')
	return (
		<EChartsRenderVisibilityProvider visible={visible}>
			<button type="button" onClick={() => setView('table')}>
				{view}
			</button>
			<ScatterChart chartData={scatterData} />
			<CandlestickChart data={candles} />
		</EChartsRenderVisibilityProvider>
	)
}

test('scatter and candlestick charts come back with their zoom after scrolling away, and the parent keeps its state', async () => {
	installChartCanvas()
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	const charts = () =>
		[...container.querySelectorAll<HTMLElement>('[_echarts_instance_]')].map((el) => echarts.getInstanceByDom(el)!)
	const zooms = () =>
		charts().map((chart) => {
			const [zoom] = (chart.getOption() as { dataZoom: Array<{ start: number; end: number }> }).dataZoom
			return [zoom.start, zoom.end]
		})

	await act(async () => root.render(<Harness visible />))
	const first = charts()
	expect(first).toHaveLength(2)
	for (const chart of first) chart.dispatchAction({ type: 'dataZoom', start: 25, end: 75 })
	await act(async () => container.querySelector('button')!.click())

	await act(async () => root.render(<Harness visible={false} />))
	expect(charts()).toEqual([])
	expect(first.map((chart) => chart.isDisposed())).toEqual([true, true])
	expect(container.querySelector('button')?.textContent).toBe('table')

	await act(async () => root.render(<Harness visible />))
	await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
	expect(charts()).toHaveLength(2)
	expect(zooms()).toEqual([
		[25, 75],
		[25, 75]
	])
	expect(container.querySelector('button')?.textContent).toBe('table')
	await act(async () => root.unmount())
})
