// @vitest-environment happy-dom

import * as echarts from 'echarts/core'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/test/chartCanvas'
import NetflowChart from '.'

const DATA = {
	day: [{ chain: 'ethereum', value: 10 }],
	week: [{ chain: 'ethereum', value: 20 }],
	month: [{ chain: 'arbitrum', value: -30 }]
}

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

function shownBars() {
	const instance = echarts.getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!
	const option = instance.getOption() as Record<string, any>
	return {
		chains: option.yAxis[0].data,
		outflow: option.series[0].data,
		inflow: option.series[1].data
	}
}

test('hands out a drawn chart, switches period on selection, and takes the chart back on unmount', async () => {
	const readyWith: Array<Array<string> | null> = []
	const onReady = (instance: echarts.ECharts | null) =>
		readyWith.push(instance ? (instance.getOption() as Record<string, any>).yAxis[0].data : null)
	await act(async () => root.render(<NetflowChart data={DATA} height={500} onReady={onReady} />))

	expect(readyWith).toEqual([['Arbitrum']])
	expect(shownBars()).toEqual({ chains: ['Arbitrum'], outflow: [-30], inflow: [0] })

	await act(async () => container.querySelector<HTMLInputElement>('input[value="day"]')!.click())

	expect(shownBars()).toEqual({ chains: ['Ethereum'], outflow: [0], inflow: [10] })

	await act(async () => root.unmount())
	expect(readyWith.at(-1)).toBeNull()
})
