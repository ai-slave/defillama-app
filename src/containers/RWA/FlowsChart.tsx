import type * as echarts from 'echarts/core'
import { useMemo } from 'react'
import MultiSeriesChart2 from '~/components/ECharts/MultiSeriesChart2'
import type { IRWAFlowAggregatePoint, IRWAFlowPoint } from './api.types'
import {
	buildRWAFlowChart,
	getRWAFlowChartOptions,
	getRWAFlowDefaultStartTimestamp,
	type RWAFlowChartMode
} from './flows'

export function RWAFlowsChart({
	points,
	mode,
	showMcapOverlay,
	mcapByTimestamp,
	defaultRangeDays,
	onReady
}: {
	points: Array<IRWAFlowPoint | IRWAFlowAggregatePoint>
	mode: RWAFlowChartMode
	showMcapOverlay: boolean
	mcapByTimestamp?: ReadonlyMap<number, number | null>
	defaultRangeDays?: number
	onReady?: (instance: echarts.ECharts | null) => void
}) {
	const chart = useMemo(
		() => buildRWAFlowChart({ points, mode, showMcapOverlay, mcapByTimestamp }),
		[points, mode, showMcapOverlay, mcapByTimestamp]
	)
	const hasSecondaryAxis = chart.charts.some((series) => series.yAxisIndex === 1)
	const chartOptions = getRWAFlowChartOptions({
		showMcapOverlay: hasSecondaryAxis,
		defaultStartTimestamp: getRWAFlowDefaultStartTimestamp(points, defaultRangeDays),
		legendTooltips: true
	})

	return (
		<MultiSeriesChart2
			dataset={chart.dataset}
			charts={chart.charts}
			groupBy={chart.groupBy}
			chartOptions={chartOptions}
			hideDefaultLegend={false}
			showTotalInTooltip={false}
			onReady={onReady}
		/>
	)
}
