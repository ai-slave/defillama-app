// @vitest-environment happy-dom

import type { EChartsOption } from 'echarts'
import { TreemapChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { renderClonedChartExport } from '../chartPngExport'

echarts.use([TreemapChart, CanvasRenderer, GridComponent, LabelLayout])

let source: echarts.ECharts
let sourceContainer: HTMLDivElement
let exportContainer: HTMLDivElement
let exportedText: Array<string>
let exportedStyles: Record<string, { fill: string; stroke: string | null; opacity: number }>

beforeEach(() => {
	installChartCanvas()
	// Freeze the first animation frame so an export cannot pass by waiting for label fade-in.
	vi.spyOn(Date, 'now').mockReturnValue(1000)
	sourceContainer = document.createElement('div')
	exportContainer = document.createElement('div')
	document.body.append(sourceContainer, exportContainer)
	source = echarts.init(sourceContainer, null, { renderer: 'canvas', width: 800, height: 400 })
	exportedText = []
	exportedStyles = {}
	// Only image loading and canvas serialization are absent in happy-dom; ECharts renders the real export.
	vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
	vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
		this.width = 2560
		this.height = 1440
		queueMicrotask(() => this.dispatchEvent(new Event('load')))
	})
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
		const chart = echarts.getInstanceByDom(exportContainer)!
		exportedText = chart
			.getZr()
			.storage.getDisplayList(true)
			.filter((element) => element.type === 'tspan' && element.shouldBePainted(1280, 720, false, false))
			.map((element) => {
				const { text, fill, stroke, opacity } = element.style as {
					text: string
					fill: string
					stroke: string
					lineWidth: number
					opacity: number
				}
				exportedStyles[text] = { fill, stroke, opacity }
				return String(text)
			})
		return 'data:image/png;base64,export'
	})
})

afterEach(() => {
	source.dispose()
	sourceContainer.remove()
	exportContainer.remove()
	vi.restoreAllMocks()
})

async function exportLabels() {
	await renderClonedChartExport(exportContainer, source, true, undefined, undefined, false, 'treemapNormalized')
	return exportedText.sort()
}

test('exports each protocol name and value exactly once', async () => {
	source.setOption<EChartsOption>({
		animation: false,
		series: [
			{
				type: 'treemap',
				animation: false,
				breadcrumb: { show: false },
				data: [
					{ name: 'Alpha', value: 600 },
					{ name: 'Beta', value: 400 }
				]
			}
		]
	})
	expect(await exportLabels()).toEqual(['$400 (40.0%)', '$600 (60.0%)', 'Alpha', 'Beta'])
}, 2000)

test('keeps nested labels visible despite hidden level and item labels', async () => {
	source.setOption<EChartsOption>({
		animation: false,
		series: [
			{
				type: 'treemap',
				animation: false,
				name: 'All',
				breadcrumb: { show: false },
				upperLabel: { show: true, height: 24 },
				levels: [{ label: { show: false } }, { label: { show: false } }, { label: { show: false } }],
				data: [
					{
						id: 'group',
						name: 'Group',
						value: 600,
						children: [
							{ name: 'Alpha', value: 400, label: { show: false } },
							{ name: 'Beta', value: 200 }
						]
					},
					{ name: 'Outside', value: 400 }
				]
			}
		]
	})
	expect(await exportLabels()).toEqual([
		'$200 (20.0%)',
		'$400 (40.0%)',
		'$400 (40.0%)',
		'All',
		'Alpha',
		'Beta',
		'Group',
		'Outside'
	])
}, 2000)

test('exports visible labels immediately when the live treemap animates', async () => {
	source.setOption<EChartsOption>({
		series: [
			{
				type: 'treemap',
				animation: true,
				breadcrumb: { show: false },
				data: [{ name: 'Animated protocol', value: 100 }]
			}
		]
	})
	expect(await exportLabels()).toEqual(['$100 (100.0%)', 'Animated protocol'])
}, 2000)

test('keeps the selected protocol label visible in a zoomed export', async () => {
	source.setOption<EChartsOption>({
		animation: false,
		series: [
			{
				type: 'treemap',
				animation: false,
				breadcrumb: { show: false },
				upperLabel: { show: false },
				data: [
					{ id: 'alpha', name: 'Alpha', value: 600 },
					{ name: 'Beta', value: 400 }
				]
			}
		]
	})
	source.dispatchAction({ type: 'treemapRootToNode', targetNodeId: 'alpha' })
	expect(await exportLabels()).toEqual(['$600 (60.0%)', 'Alpha'])
}, 2000)

test('exports solid contrasting text on both bright and dark tiles', async () => {
	source.setOption<EChartsOption>({
		series: [
			{
				type: 'treemap',
				animation: false,
				breadcrumb: { show: false },
				label: { rich: { name: { color: '#000' }, value: { color: 'rgba(255,255,255,0.8)' } } },
				data: [
					{ name: 'Bright', value: 600, itemStyle: { color: '#ffeb3b' } },
					{ name: 'Dark', value: 400, itemStyle: { color: '#142378' } }
				]
			}
		]
	})
	expect(await exportLabels()).toEqual(['$400 (40.0%)', '$600 (60.0%)', 'Bright', 'Dark'])
	expect(exportedStyles).toEqual({
		Bright: { fill: '#000', stroke: null, opacity: 1 },
		'$600 (60.0%)': { fill: '#000', stroke: null, opacity: 1 },
		Dark: { fill: '#fff', stroke: null, opacity: 1 },
		'$400 (40.0%)': { fill: '#fff', stroke: null, opacity: 1 }
	})
}, 2000)

test('uses header backgrounds for nested labels and tile backgrounds for leaves', async () => {
	source.setOption<EChartsOption>({
		series: [
			{
				type: 'treemap',
				animation: false,
				breadcrumb: { show: false },
				name: 'Root',
				upperLabel: { show: true, height: 24, backgroundColor: 'rgba(255,255,255,0.95)', color: '#000' },
				levels: [{}, { upperLabel: { color: '#333', textBorderWidth: 0 } }],
				itemStyle: { borderColor: '#000', borderWidth: 2 },
				data: [
					{
						name: 'Parent',
						value: 100,
						children: [
							{
								name: 'Child',
								value: 100,
								label: { color: '#000', textBorderWidth: 0 },
								itemStyle: { color: '#142378' }
							}
						]
					}
				]
			}
		]
	})
	await exportLabels()
	expect(exportedStyles).toEqual({
		Root: { fill: '#000', stroke: null, opacity: 1 },
		Parent: { fill: '#000', stroke: null, opacity: 1 },
		Child: { fill: '#fff', stroke: null, opacity: 1 },
		'$100 (100.0%)': { fill: '#fff', stroke: null, opacity: 1 }
	})
}, 2000)
