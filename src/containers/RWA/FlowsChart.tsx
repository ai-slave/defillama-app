import type * as echarts from 'echarts/core'
import { useMemo, useRef } from 'react'
import type { ChartExportHandle } from '~/components/ChartExport/types'
import MultiSeriesChart from '~/components/ECharts/MultiSeriesChart'
import { useStableCallback } from '~/hooks/useStableCallback'
import { getRWAFlowChartOptions, getRWAFlowTimestampExtent, type RWAFlowChart, type RWAFlowVisibleRange } from './flows'

type DataZoomPayload = {
	start?: number
	end?: number
	startValue?: number
	endValue?: number
	batch?: Array<DataZoomPayload>
}

function getVisibleRangeFromZoom(
	source: RWAFlowChart['dataset']['source'],
	event: DataZoomPayload
): RWAFlowVisibleRange | null {
	const extent = getRWAFlowTimestampExtent(source)
	if (!extent) return null
	const zoom = event.batch?.[0] ?? event
	const span = extent.end - extent.start
	const start =
		typeof zoom.startValue === 'number' && Number.isFinite(zoom.startValue)
			? zoom.startValue
			: extent.start + (span * (zoom.start ?? 0)) / 100
	const end =
		typeof zoom.endValue === 'number' && Number.isFinite(zoom.endValue)
			? zoom.endValue
			: extent.start + (span * (zoom.end ?? 100)) / 100
	return { start: Math.max(extent.start, start), end: Math.min(extent.end, end) }
}

export function RWAFlowsChart({
	chart,
	defaultStartTimestamp,
	exportButtons,
	onVisibleRangeChange
}: {
	chart: RWAFlowChart
	defaultStartTimestamp?: number
	exportButtons: ChartExportHandle
	/** Reports the reader's zooms; the default range is the parent's to derive (`getRWAFlowVisibleRange`). */
	onVisibleRangeChange?: (range: RWAFlowVisibleRange | null) => void
}) {
	const hasSecondaryAxis = chart.charts.some((series) => series.yAxisIndex === 1)
	const chartOptions = useMemo(
		() =>
			getRWAFlowChartOptions({
				hasOverlayAxis: hasSecondaryAxis,
				...(defaultStartTimestamp !== undefined ? { defaultStartTimestamp } : {}),
				legendTooltips: true
			}),
		[defaultStartTimestamp, hasSecondaryAxis]
	)
	const chartInstanceRef = useRef<echarts.ECharts | null>(null)
	// ECharts calls these outside render; each reads the latest data and callbacks.
	// Keep visible-range tracking local to RWA flows instead of expanding the shared
	// MultiSeriesChart API. Other charts retain their existing lifecycle and zoom behavior.
	const handleDataZoom = useStableCallback((...args: Array<unknown>) => {
		// ECharts types custom event payloads as unknown; the datazoom event has this documented shape.
		onVisibleRangeChange?.(getVisibleRangeFromZoom(chart.dataset.source, args[0] as DataZoomPayload))
	})

	const handleReady = useStableCallback((instance: echarts.ECharts | null) => {
		const previousInstance = chartInstanceRef.current
		if (previousInstance && !previousInstance.isDisposed()) previousInstance.off('datazoom', handleDataZoom)
		chartInstanceRef.current = instance
		instance?.on('datazoom', handleDataZoom)
	})

	return (
		<MultiSeriesChart
			exportButtons={exportButtons}
			dataset={chart.dataset}
			charts={chart.charts}
			groupBy={chart.groupBy}
			chartOptions={chartOptions}
			showLegend
			showTotalInTooltip={false}
			onReady={handleReady}
		/>
	)
}
