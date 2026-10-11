import { LineChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { getChartTheme } from '~/components/ECharts/shared/chartTheme'

echarts.use([LineChart, GridComponent, SVGRenderer])

export function renderChartSvg(dataset: MultiSeriesChartDataset, width: number, height: number): string | null {
	if (dataset.source.length === 0) return null
	// The SVG renders on the server, where no CSS variable resolves, so the brand blue and the area fade come from the
	// chart theme's checked hex values, drawn as the dashboard's own single-series area chart draws them.
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
				lineStyle: { width: 2, color: theme.brand },
				areaStyle: {
					color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{ offset: 0, color: theme.brand },
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
