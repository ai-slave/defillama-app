// @vitest-environment happy-dom

import type { EChartsOption } from 'echarts'
import { BarChart, CandlestickChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { IMAGE_EXPORT_HEIGHT, renderClonedChartExport, stackGridRectsForExport } from '../chartPngExport'

echarts.use([CandlestickChart, BarChart, CanvasRenderer, GridComponent])

const JAN_1 = Date.UTC(2026, 0, 1)
const JAN_2 = Date.UTC(2026, 0, 2)

let source: echarts.ECharts
let sourceContainer: HTMLDivElement
let exportContainer: HTMLDivElement
let exportedGrids: Array<{ y: number; height: number }>

beforeEach(() => {
	installChartCanvas()
	sourceContainer = document.createElement('div')
	exportContainer = document.createElement('div')
	document.body.append(sourceContainer, exportContainer)
	source = echarts.init(sourceContainer, null, { renderer: 'canvas', width: 800, height: 400 })
	exportedGrids = []
	// Only image loading and canvas serialization are absent in happy-dom; ECharts renders the real export.
	vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
	vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
		this.width = 2560
		this.height = 1440
		queueMicrotask(() => this.dispatchEvent(new Event('load')))
	})
	vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
		const model = (echarts.getInstanceByDom(exportContainer) as any).getModel()
		model.eachComponent('grid', (grid: any) => {
			const { y, height } = grid.coordinateSystem.getRect()
			exportedGrids.push({ y, height })
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

test('a candlestick with a volume panel exports both panels, price above volume', async () => {
	// The CandlestickChart layout: a price grid over a fixed-height volume grid, each with its own axes.
	source.setOption<EChartsOption>({
		animation: false,
		grid: [
			{ left: 48, right: 16, top: 16, bottom: 120 },
			{ left: 48, right: 16, height: 60, bottom: 40 }
		],
		xAxis: [
			{ type: 'time', gridIndex: 0 },
			{ type: 'time', gridIndex: 1 }
		],
		yAxis: [
			{ type: 'value', gridIndex: 0, scale: true },
			{ type: 'value', gridIndex: 1 }
		],
		series: [
			{
				type: 'candlestick',
				xAxisIndex: 0,
				yAxisIndex: 0,
				data: [
					[JAN_1, 10, 12, 9, 13],
					[JAN_2, 12, 11, 10, 14]
				]
			},
			{
				type: 'bar',
				xAxisIndex: 1,
				yAxisIndex: 1,
				data: [
					[JAN_1, 500],
					[JAN_2, 700]
				]
			}
		]
	})

	await expect(renderClonedChartExport(exportContainer, source, false, 'Share price', undefined, false)).resolves.toBe(
		'data:image/png;base64,export'
	)

	expect(exportedGrids).toHaveLength(2)
	const [price, volume] = exportedGrids
	expect(price!.y + price!.height).toBeLessThanOrEqual(volume!.y)
	expect(volume!.y + volume!.height).toBeLessThanOrEqual(IMAGE_EXPORT_HEIGHT)
	// The live chart draws the price panel about four times the volume panel's height; the export keeps that.
	expect(price!.height / volume!.height).toBeGreaterThan(3)
})

test("stacked grids keep their drawn share of the height with the export's vertical gap, top to bottom as drawn", () => {
	// Live: price 16..280, volume 300..360, listed volume first. Export plot area: 100..700.
	const scale = (600 - 16) / (264 + 60)
	expect(
		stackGridRectsForExport(
			[
				{ y: 300, height: 60 },
				{ y: 16, height: 264 }
			],
			100,
			700
		)
	).toEqual([
		{ top: 100 + 264 * scale + 16, height: 60 * scale },
		{ top: 100, height: 264 * scale }
	])
})
