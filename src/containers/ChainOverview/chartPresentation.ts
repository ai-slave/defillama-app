import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import {
	BAR_CHARTS,
	type ChainChartLabels,
	chainOverviewChartColors,
	DISABLED_CUMULATIVE_CHARTS,
	yAxisByChart
} from './constants'
import type { ChainOverviewChartData } from './types'

const BAR_CHARTS_SET = new Set<ChainChartLabels>(BAR_CHARTS)
const DISABLED_CUMULATIVE_CHARTS_SET = new Set<ChainChartLabels>(DISABLED_CUMULATIVE_CHARTS)
const EMPTY_DATASET = { dimensions: ['timestamp'], source: [] }

export function buildChainChartPresentation(chartData: ChainOverviewChartData, isCumulative: boolean) {
	const labels = Object.keys(chartData) as ChainChartLabels[]
	const axisIndexByType = new Map<ChainChartLabels, number>()
	const allYAxis: Array<[ChainChartLabels, number | undefined]> = []
	const chartsInSeries = new Set<ChainChartLabels>()
	const charts = new Array<MultiSeriesChartSeriesConfig>(labels.length)

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
		const type =
			BAR_CHARTS_SET.has(label) && !isCumulative ? 'bar' : DISABLED_CUMULATIVE_CHARTS_SET.has(label) ? 'bar' : 'line'
		charts[index] = {
			type,
			name: label,
			encode: { x: 0, y: 1 },
			data,
			color: chainOverviewChartColors[label],
			yAxisIndex,
			...(type === 'bar' ? { large: data.length > 0 } : {})
		}
	}

	return {
		dataset: EMPTY_DATASET,
		charts,
		allYAxis,
		chartsInSeries
	}
}
