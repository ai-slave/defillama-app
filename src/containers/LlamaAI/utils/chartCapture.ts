import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts/core'
import { mergeDeep } from '~/components/ECharts/shared/merge'

export interface CapturedChart {
	chartId: string
	imageData: string
	title: string
}

const CAPTURE_WIDTH = 1280
const CAPTURE_HEIGHT = 720
const CAPTURE_TIMEOUT = 1500

export async function captureChartById(chartId: string, title: string, isDark: boolean): Promise<CapturedChart | null> {
	const wrapper = document.querySelector(`[data-chart-id="${chartId}"]`) as HTMLElement
	if (!wrapper) return null

	const chartContainer = wrapper.querySelector('div[_echarts_instance_]') as HTMLElement
	if (!chartContainer) return null

	const existingChart = echarts.getInstanceByDom(chartContainer)
	if (!existingChart) return null

	const tempContainer = document.createElement('div')
	// Batch DOM writes using cssText for single reflow
	tempContainer.style.cssText = `
		width: ${CAPTURE_WIDTH}px;
		height: ${CAPTURE_HEIGHT}px;
		position: absolute;
		left: -99999px;
		top: 0;
	`
	document.body.appendChild(tempContainer)
	let tempChart: echarts.ECharts | null = null

	try {
		tempChart = echarts.init(tempContainer, null, {
			width: CAPTURE_WIDTH,
			height: CAPTURE_HEIGHT,
			renderer: 'canvas'
		})
		const captureChart = tempChart

		// ECharts returns its uncomposed core option type; this app registers the full
		// option surface, so normalize once and keep the capture renderer strictly typed.
		const currentOptions = existingChart.getOption() as EChartsOption

		currentOptions.animation = false

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

		const dataURL = captureChart.getDataURL({
			type: 'png',
			pixelRatio: 2,
			backgroundColor: isDark ? '#0b1214' : '#ffffff',
			excludeComponents: ['toolbox', 'dataZoom']
		})

		return {
			chartId,
			imageData: dataURL,
			title
		}
	} catch (error) {
		console.error('Chart capture error:', error)
		return null
	} finally {
		if (tempChart && !tempChart.isDisposed()) tempChart.dispose()
		tempContainer.remove()
	}
}

export async function captureAllCharts(
	charts: Array<{ id: string; title: string }>,
	isDark: boolean
): Promise<CapturedChart[]> {
	const results: CapturedChart[] = []

	for (const chart of charts) {
		const captured = await captureChartById(chart.id, chart.title, isDark)
		if (captured) {
			results.push(captured)
		}
	}

	return results
}
