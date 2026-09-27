// @vitest-environment happy-dom

import type { EChartsOption } from 'echarts'
import { TreemapChart } from 'echarts/charts'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { getTreemapTextColor, TreemapLabelContrast } from '../labelContrast'

test.each([
	[[255, 235, 59], '#000'],
	[[20, 35, 120], '#fff'],
	[[0, 0, 0], '#fff'],
	[[255, 255, 255], '#000'],
	[[117, 117, 117], '#fff'],
	[[118, 118, 118], '#000']
] as const)('chooses the higher contrast text for RGB %s', (background, expected) => {
	expect(getTreemapTextColor([...background])).toBe(expected)
})

echarts.use([TreemapChart, CanvasRenderer, TreemapLabelContrast])
let chart: echarts.ECharts
let container: HTMLDivElement
beforeEach(() => {
	installChartCanvas()
	container = document.createElement('div')
	document.body.append(container)
	chart = echarts.init(container, null, { renderer: 'canvas', width: 800, height: 400 })
})
afterEach(() => {
	chart.dispose()
	container.remove()
	vi.restoreAllMocks()
})

function paintedText() {
	chart.getZr().flush()
	return chart
		.getZr()
		.storage.getDisplayList(true)
		.filter((element) => element.type === 'tspan' && element.shouldBePainted(800, 400, false, false))
		.map((element) => {
			const { text, fill, stroke } = element.style as { text: string; fill: string; stroke: string | null }
			return { text, fill, stroke }
		})
}

test('keeps live labels contrasting after hover, zoom, resize and a palette update', () => {
	chart.setOption<EChartsOption>({
		series: [
			{
				type: 'treemap',
				animation: false,
				breadcrumb: { show: false },
				label: { color: '#fff' },
				data: [{ id: 'tile', name: 'Protocol', value: 100, itemStyle: { color: '#ffeb3b' } }]
			}
		]
	})
	expect(paintedText()).toEqual([{ text: 'Protocol', fill: '#000', stroke: null }])
	chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: 1 })
	expect(paintedText()).toEqual([{ text: 'Protocol', fill: '#000', stroke: null }])
	chart.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex: 1 })
	chart.dispatchAction({ type: 'treemapRootToNode', targetNodeId: 'tile' })
	chart.resize({ width: 600, height: 300 })
	expect(paintedText()).toEqual([{ text: 'Protocol', fill: '#000', stroke: null }])
	chart.setOption<EChartsOption>({
		series: [{ data: [{ id: 'tile', name: 'Protocol', value: 100, itemStyle: { color: '#142378' } }] }]
	})
	expect(paintedText()).toEqual([{ text: 'Protocol', fill: '#fff', stroke: null }])
})

test.each([
	['#fff', '#000'],
	['#000', '#fff']
])('accounts for transparent tiles over a %s canvas', (backgroundColor, expected) => {
	chart.setOption<EChartsOption>({
		backgroundColor,
		series: [
			{
				type: 'treemap',
				animation: false,
				breadcrumb: { show: false },
				itemStyle: { borderWidth: 0, borderColor: 'transparent' },
				data: [{ name: 'Protocol', value: 100, itemStyle: { color: 'rgba(0,0,0,0.3)' } }]
			}
		]
	})
	expect(paintedText()).toEqual([{ text: 'Protocol', fill: expected, stroke: null }])
})
