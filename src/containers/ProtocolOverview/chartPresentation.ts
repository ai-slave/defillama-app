import type { LineSeriesOption } from 'echarts'
import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { BAR_CHARTS, type ProtocolChartsLabels, yAxisByChart } from './constants'

const BAR_CHARTS_SET = new Set<ProtocolChartsLabels>(BAR_CHARTS)
const EMPTY_DATASET = { dimensions: ['timestamp'], source: [] }

export function buildProtocolChartPresentation({
	chartData,
	chartColors,
	isCumulative,
	rangeHallmarks,
	isThemeDark,
	themeText
}: {
	chartData: Partial<Record<ProtocolChartsLabels, Array<[number, number | null]>>>
	chartColors: Record<string, string>
	isCumulative: boolean
	rangeHallmarks: Array<[[number, number], string]> | null
	isThemeDark: boolean
	themeText: string
}) {
	const labels = Object.keys(chartData) as ProtocolChartsLabels[]
	const axisIndexByType = new Map<ProtocolChartsLabels, number>()
	const allYAxis: Array<[ProtocolChartsLabels, number | undefined]> = []
	const chartsInSeries = new Set<ProtocolChartsLabels>()
	const charts = new Array<MultiSeriesChartSeriesConfig>(labels.length)
	const markArea: LineSeriesOption['markArea'] | undefined = rangeHallmarks?.length
		? {
				itemStyle: { color: isThemeDark ? 'rgba(15, 52, 105, 0.4)' : 'rgba(70, 130, 180, 0.3)' },
				label: { fontFamily: 'sans-serif', fontWeight: 600, color: themeText },
				data: rangeHallmarks.map(([[start, end], event]) => [{ name: event, xAxis: start }, { xAxis: end }])
			}
		: undefined

	for (let index = 0; index < labels.length; index++) {
		const label = labels[index]
		const axisType = yAxisByChart[label]
		let yAxisIndex = axisIndexByType.get(axisType)
		if (yAxisIndex == null) {
			yAxisIndex = allYAxis.length
			axisIndexByType.set(axisType, yAxisIndex)
			allYAxis.push([axisType, yAxisIndex === 0 ? undefined : yAxisIndex])
		}
		chartsInSeries.add(label)
		const data = chartData[label] ?? []
		const type = BAR_CHARTS_SET.has(label) && !isCumulative ? 'bar' : 'line'
		charts[index] = {
			type,
			name: label,
			encode: { x: 0, y: 1 },
			data,
			color: chartColors[label],
			yAxisIndex,
			...(type === 'bar' ? { large: data.length > 0 } : {}),
			...(index === 0 && markArea ? { markArea } : {})
		}
	}

	return {
		dataset: EMPTY_DATASET,
		charts,
		allYAxis,
		chartsInSeries
	}
}
