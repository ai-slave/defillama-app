import type { LineSeriesOption } from 'echarts'
import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { getDailyAverageLabel } from '~/components/ECharts/shared/timeSeries'
import { BAR_CHARTS, type ProtocolChartsLabels, yAxisByChart } from './constants'

const BAR_CHARTS_SET = new Set<ProtocolChartsLabels>(BAR_CHARTS)
const EMPTY_DATASET = { dimensions: ['timestamp'], source: [] }

const isProtocolChartLabel = (label: string): label is ProtocolChartsLabels => Object.hasOwn(yAxisByChart, label)

/** Grouped active addresses are a daily average, and their name says so in the legend, tooltip and CSV. */
export function getProtocolSeriesName(label: string, groupBy: ChartTimeGroupingWithCumulative) {
	return label === 'Active Addresses' && groupBy !== 'daily' ? getDailyAverageLabel(label) : label
}

export function buildProtocolChartPresentation({
	chartData,
	chartColors,
	groupBy,
	rangeHallmarks,
	isThemeDark,
	themeText
}: {
	chartData: Partial<Record<ProtocolChartsLabels, Array<[number, number | null]>>>
	chartColors: Partial<Record<ProtocolChartsLabels, string>>
	groupBy: ChartTimeGroupingWithCumulative
	rangeHallmarks: Array<[[number, number], string]> | null
	isThemeDark: boolean
	themeText: string
}) {
	const axisIndexByType = new Map<ProtocolChartsLabels, number>()
	const allYAxis: Array<[ProtocolChartsLabels, number | undefined]> = []
	const chartsInSeries = new Set<ProtocolChartsLabels>()
	const charts: Array<MultiSeriesChartSeriesConfig> = []
	const markArea: LineSeriesOption['markArea'] | undefined = rangeHallmarks?.length
		? {
				itemStyle: { color: isThemeDark ? 'rgba(15, 52, 105, 0.4)' : 'rgba(70, 130, 180, 0.3)' },
				label: { fontFamily: 'sans-serif', fontWeight: 600, color: themeText },
				data: rangeHallmarks.map(([[start, end], event]) => [{ name: event, xAxis: start }, { xAxis: end }])
			}
		: undefined

	for (const label of Object.keys(chartData)) {
		if (!isProtocolChartLabel(label)) continue
		const data = chartData[label]
		if (!data) continue
		const axisType = yAxisByChart[label]
		let yAxisIndex = axisIndexByType.get(axisType)
		if (yAxisIndex == null) {
			yAxisIndex = allYAxis.length
			axisIndexByType.set(axisType, yAxisIndex)
			allYAxis.push([axisType, yAxisIndex === 0 ? undefined : yAxisIndex])
		}
		chartsInSeries.add(label)
		const type = BAR_CHARTS_SET.has(label) && groupBy !== 'cumulative' ? 'bar' : 'line'
		const color = chartColors[label]
		charts.push({
			type,
			name: getProtocolSeriesName(label, groupBy),
			encode: { x: 0, y: 1 },
			data,
			...(color ? { color } : {}),
			yAxisIndex,
			...(type === 'bar' ? { large: data.length > 0 } : {}),
			...(charts.length === 0 && markArea ? { markArea } : {})
		})
	}

	return {
		dataset: EMPTY_DATASET,
		charts,
		allYAxis,
		chartsInSeries
	}
}
