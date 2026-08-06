import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts/core'
import { mergeDeep } from '~/components/ECharts/shared/merge'

const CAPTURE_WIDTH = 1280
const CAPTURE_HEIGHT = 720
const CAPTURE_TIMEOUT = 1500

/**
 * Capture a mounted chart as a PNG data URI by re-rendering its current option
 * offscreen at a fixed size. Returns null when the chart is not on screen —
 * callers degrade to a text placeholder.
 */
export async function captureChartImage(chartId: string, isDark: boolean): Promise<string | null> {
	const wrapper = document.querySelector(`[data-chart-id="${chartId}"]`)
	const chartContainer = wrapper?.querySelector('div[_echarts_instance_]') as HTMLElement | null
	if (!chartContainer) return null
	const existingChart = echarts.getInstanceByDom(chartContainer)
	if (!existingChart) return null

	const tempContainer = document.createElement('div')
	tempContainer.style.cssText = `width:${CAPTURE_WIDTH}px;height:${CAPTURE_HEIGHT}px;position:absolute;left:-99999px;top:0;`
	document.body.appendChild(tempContainer)
	let tempChart: echarts.ECharts | null = null

	try {
		tempChart = echarts.init(tempContainer, null, { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT, renderer: 'canvas' })
		const captureChart = tempChart
		const currentOptions = existingChart.getOption() as EChartsOption
		currentOptions.animation = false

		// Larger axis/legend text keeps the fixed-size export legible when pasted into documents.
		if (currentOptions.xAxis) {
			const axes = Array.isArray(currentOptions.xAxis) ? currentOptions.xAxis : [currentOptions.xAxis]
			currentOptions.xAxis = axes.map((axis) => mergeDeep(axis, { axisLabel: { fontSize: 20 } }))
		}
		if (currentOptions.yAxis) {
			const axes = Array.isArray(currentOptions.yAxis) ? currentOptions.yAxis : [currentOptions.yAxis]
			currentOptions.yAxis = axes.map((axis) => mergeDeep(axis, { axisLabel: { fontSize: 20 } }))
		}
		if (currentOptions.legend) {
			currentOptions.legend = Array.isArray(currentOptions.legend)
				? currentOptions.legend.map((legend) => mergeDeep(legend, { textStyle: { fontSize: 18 } }))
				: mergeDeep(currentOptions.legend, { textStyle: { fontSize: 18 } })
		}

		// The watermark graphic is sized and anchored in absolute pixels for the
		// on-screen container (left: '45%', top: '130px'); re-anchor to the true
		// center and double it so it keeps its visual weight at the export size.
		if (currentOptions.graphic) {
			const groups = Array.isArray(currentOptions.graphic) ? currentOptions.graphic : [currentOptions.graphic]
			for (const group of groups) {
				const maybeElements = (group as { elements?: unknown }).elements
				const elements = Array.isArray(maybeElements) ? maybeElements : [group]
				for (const element of elements as Array<{
					type?: string
					left?: unknown
					top?: unknown
					right?: unknown
					bottom?: unknown
					x?: unknown
					y?: unknown
					style?: { width?: unknown; height?: unknown }
				}>) {
					if (element?.type !== 'image' || !element.style) continue
					if (typeof element.style.width === 'number') element.style.width *= 2
					if (typeof element.style.height === 'number') element.style.height *= 2
					// Without an explicit width ECharts lays the image out as zero-width, so
					// left:'center' anchors its left edge at canvas center. 389:133 is the
					// DefiLlama logo's native aspect ratio.
					if (typeof element.style.width !== 'number' && typeof element.style.height === 'number') {
						element.style.width = Math.round((389 / 133) * element.style.height)
					}
					element.left = 'center'
					element.top = 'middle'
					delete element.right
					delete element.bottom
					delete element.x
					delete element.y
				}
			}
		}

		await new Promise<void>((resolve, reject) => {
			let timeoutId: ReturnType<typeof setTimeout> | null = null
			const cleanup = () => {
				if (timeoutId) clearTimeout(timeoutId)
				captureChart.off('rendered', handler)
			}
			const handler = () => {
				cleanup()
				resolve()
			}
			timeoutId = setTimeout(() => {
				cleanup()
				resolve()
			}, CAPTURE_TIMEOUT)
			// Subscribe before setOption because a canvas render can complete synchronously.
			captureChart.on('rendered', handler)
			try {
				captureChart.setOption(currentOptions)
			} catch (error) {
				cleanup()
				reject(error)
			}
		})

		return captureChart.getDataURL({
			type: 'png',
			pixelRatio: 2,
			backgroundColor: isDark ? '#0b1214' : '#ffffff',
			excludeComponents: ['toolbox', 'dataZoom']
		})
	} catch {
		return null
	} finally {
		if (tempChart && !tempChart.isDisposed()) tempChart.dispose()
		tempContainer.remove()
	}
}
