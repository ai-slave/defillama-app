import type * as echarts from 'echarts/core'
import { useMemo } from 'react'
import MultiSeriesChart2 from '~/components/ECharts/MultiSeriesChart2'
import type { IRWAFlowAggregatePoint, IRWAFlowPoint } from './api.types'
import {
	buildRWAFlowChart,
	getRWAFlowChartOptions,
	getRWAFlowDefaultStartTimestamp,
	type RWAFlowChartSelection
} from './flows'

export function RWAFlowsChart({
	points,
	selection,
	defaultRangeDays,
	onReady
}: {
	points: Array<IRWAFlowPoint | IRWAFlowAggregatePoint>
	selection: RWAFlowChartSelection
	defaultRangeDays?: number
	onReady?: (instance: echarts.ECharts | null) => void
}) {
	const chart = useMemo(() => buildRWAFlowChart({ points, selection }), [points, selection])
	const hasSecondaryAxis = chart.charts.some((series) => series.yAxisIndex === 1)
	const chartOptions = getRWAFlowChartOptions({
		hasOverlayAxis: hasSecondaryAxis,
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
