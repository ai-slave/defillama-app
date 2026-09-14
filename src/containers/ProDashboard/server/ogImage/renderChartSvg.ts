import { LineChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { getChartTheme } from '~/components/ECharts/shared/chartTheme'

echarts.use([LineChart, GridComponent, SVGRenderer])

const OG_CHART_LINE_COLOR = '#326abd'
const OG_CHART_AREA_COLOR = 'rgba(50, 106, 189, 0.35)'

export function renderChartSvg(dataset: MultiSeriesChartDataset, width: number, height: number): string | null {
	if (dataset.source.length === 0) return null
	const theme = getChartTheme(true)
	const chart = echarts.init(null, null, {
		renderer: 'svg',
		ssr: true,
		width,
		height
	})
	chart.setOption({
		animation: false,
		backgroundColor: 'transparent',
		grid: { left: 2, right: 2, top: 6, bottom: 2, containLabel: false },
		xAxis: { type: 'time', show: false, boundaryGap: false },
		yAxis: { type: 'value', show: false, scale: true },
		series: [
			{
				type: 'line',
				data: dataset.source,
				showSymbol: false,
				smooth: false,
				lineStyle: { width: 2, color: OG_CHART_LINE_COLOR },
				areaStyle: {
					color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{ offset: 0, color: OG_CHART_AREA_COLOR },
						{ offset: 1, color: theme.areaGradientTo }
					])
				}
			}
		]
	})
	const svg = chart.renderToSVGString()
	chart.dispose()
	return svg
}

export function toSvgDataUri(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

export function renderChartSvgDataUri(dataset: MultiSeriesChartDataset, width: number, height: number): string | null {
	const svg = renderChartSvg(dataset, width, height)
	return svg === null ? null : toSvgDataUri(svg)
}
