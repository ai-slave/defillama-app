import * as echarts from 'echarts/core'
import { IMAGE_EXPORT_HEIGHT, renderClonedChartExport } from '~/components/ChartExport/chartPngExport'
import { IMAGE_EXPORT_WIDTH } from '~/components/ChartExport/chartPngExportLayout'

/**
 * Capture a mounted chart as a PNG data URI through the shared PNG export.
 * Returns null when the chart is not on screen or the export fails —
 * callers degrade to a text placeholder.
 */
export async function captureChartImage(chartId: string, isDark: boolean): Promise<string | null> {
	const wrapper = document.querySelector(`[data-chart-id="${chartId}"]`)
	const chartContainer = wrapper?.querySelector('div[_echarts_instance_]') as HTMLElement | null
	if (!chartContainer) return null
	const existingChart = echarts.getInstanceByDom(chartContainer)
	if (!existingChart) return null

	const tempContainer = document.createElement('div')
	tempContainer.style.cssText = `width:${IMAGE_EXPORT_WIDTH}px;height:${IMAGE_EXPORT_HEIGHT}px;position:absolute;left:-99999px;top:0;`
	document.body.appendChild(tempContainer)

	try {
		return await renderClonedChartExport(tempContainer, existingChart, isDark, undefined, undefined, undefined)
	} catch {
		return null
	} finally {
		tempContainer.remove()
	}
}
