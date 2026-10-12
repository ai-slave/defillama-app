// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import CandlestickChart from '..'
import type { CandlestickPoint } from '../types'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	installChartCanvas()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.restoreAllMocks()
})

async function drawnPanels(data: Array<CandlestickPoint>) {
	await act(async () => root.render(<CandlestickChart exportButtons={{ omit: 'renderer test' }} data={data} />))
	const instance = echarts.getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!
	const option = instance.getOption() as { grid: Array<unknown>; series: Array<{ type: string }> }
	return { grids: option.grid.length, series: option.series.map((series) => series.type) }
}

test('candles without volume draw only the price panel', async () => {
	expect(await drawnPanels([[Date.UTC(2026, 8, 1), 10, 11, 9, 12]])).toEqual({ grids: 1, series: ['candlestick'] })
})

test('candles with volume draw the volume panel under the price', async () => {
	expect(await drawnPanels([[Date.UTC(2026, 8, 1), 10, 11, 9, 12, 100]])).toEqual({
		grids: 2,
		series: ['candlestick', 'bar']
	})
})
