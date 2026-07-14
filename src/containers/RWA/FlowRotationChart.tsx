import type * as echarts from 'echarts/core'
import { useMemo } from 'react'
import MultiSeriesChart2 from '~/components/ECharts/MultiSeriesChart2'
import type { IRWAFlowOverviewSplitPoint } from './api.types'
import { buildRWAFlowRotationChart, getRWAFlowChartOptions, type RWAFlowGrouping } from './flows'

export function RWAFlowRotationChart({
	points,
	groupBy,
	onReady
}: {
	points: IRWAFlowOverviewSplitPoint[]
	groupBy: RWAFlowGrouping
	onReady?: (instance: echarts.ECharts | null) => void
}) {
	const chart = useMemo(() => buildRWAFlowRotationChart(points, groupBy), [points, groupBy])

	return (
		<MultiSeriesChart2
			dataset={chart.dataset}
			charts={chart.charts}
			groupBy={chart.groupBy}
			chartOptions={getRWAFlowChartOptions()}
			hideDefaultLegend={false}
			showTotalInTooltip
			onReady={onReady}
		/>
	)
}
