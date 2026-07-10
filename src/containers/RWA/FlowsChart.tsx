import type * as echarts from 'echarts/core'
import { useMemo } from 'react'
import MultiSeriesChart2 from '~/components/ECharts/MultiSeriesChart2'
import type { IRWAFlowAggregatePoint, IRWAFlowPoint } from './api.types'
import { buildRWAFlowChart, getRWAFlowChartOptions, type RWAFlowChartMode } from './flows'

export function RWAFlowsChart({
	points,
	mode,
	showMcapOverlay,
	mcapByTimestamp,
	onReady
}: {
	points: Array<IRWAFlowPoint | IRWAFlowAggregatePoint>
	mode: RWAFlowChartMode
	showMcapOverlay: boolean
	mcapByTimestamp?: ReadonlyMap<number, number | null>
	onReady?: (instance: echarts.ECharts | null) => void
}) {
	const chart = useMemo(
		() => buildRWAFlowChart({ points, mode, showMcapOverlay, mcapByTimestamp }),
		[points, mode, showMcapOverlay, mcapByTimestamp]
	)

	return (
		<MultiSeriesChart2
			dataset={chart.dataset}
			charts={chart.charts}
			groupBy={chart.groupBy}
			chartOptions={getRWAFlowChartOptions()}
			hideDefaultLegend={false}
			showTotalInTooltip={false}
			onReady={onReady}
		/>
	)
}
