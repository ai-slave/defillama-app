import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import {
	BAR_CHARTS,
	type ChainChartLabels,
	chainOverviewChartColors,
	chainCharts,
	DISABLED_CUMULATIVE_CHARTS,
	yAxisByChart
} from './constants'
import type { ChainOverviewChartData } from './types'

const BAR_CHARTS_SET = new Set<ChainChartLabels>(BAR_CHARTS)
const DISABLED_CUMULATIVE_CHARTS_SET = new Set<ChainChartLabels>(DISABLED_CUMULATIVE_CHARTS)
const USD_CHARTS_SET = new Set<ChainChartLabels>(['Token Price', 'Token Mcap', 'Token Volume', 'Raises'])
const EMPTY_DATASET = { dimensions: ['timestamp'], source: [] }

function isChainChartLabel(value: string): value is ChainChartLabels {
	return Object.hasOwn(chainCharts, value)
}

export function buildChainChartPresentation(chartData: ChainOverviewChartData, isCumulative: boolean) {
	const axisIndexByType = new Map<ChainChartLabels, number>()
	const allYAxis: Array<[ChainChartLabels, number | undefined]> = []
	const chartsInSeries = new Set<ChainChartLabels>()
	const seriesValueSymbols = new Map<string, string>()
	const charts: Array<MultiSeriesChartSeriesConfig> = []

	for (const key in chartData) {
		if (!isChainChartLabel(key)) continue
		const label = key
		const axisType = yAxisByChart[label]
		let yAxisIndex = axisIndexByType.get(axisType)
		if (yAxisIndex == null) {
			yAxisIndex = allYAxis.length
			axisIndexByType.set(axisType, yAxisIndex)
			allYAxis.push([axisType, yAxisIndex === 0 ? undefined : yAxisIndex])
		}
		chartsInSeries.add(label)
		const data = chartData[label] ?? []
		const type =
			BAR_CHARTS_SET.has(label) && !isCumulative ? 'bar' : DISABLED_CUMULATIVE_CHARTS_SET.has(label) ? 'bar' : 'line'
		const seriesValueSymbol = USD_CHARTS_SET.has(label) ? '$' : undefined
		if (seriesValueSymbol !== undefined) seriesValueSymbols.set(label, seriesValueSymbol)
		charts.push({
			type,
			name: label,
			encode: { x: 0, y: 1 },
			data,
			color: chainOverviewChartColors[label],
			yAxisIndex,
			...(seriesValueSymbol !== undefined ? { valueSymbol: seriesValueSymbol } : {}),
			...(type === 'bar' ? { large: data.length > 0 } : {})
		})
	}

	return {
		dataset: EMPTY_DATASET,
		charts,
		allYAxis,
		chartsInSeries,
		seriesValueSymbols
	}
}
