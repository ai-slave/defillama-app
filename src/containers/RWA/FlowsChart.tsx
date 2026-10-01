import type * as echarts from 'echarts/core'
import { useEffect, useMemo, useRef } from 'react'
import MultiSeriesChart from '~/components/ECharts/MultiSeriesChart'
import { useStableCallback } from '~/hooks/useStableCallback'
import { getRWAFlowChartOptions, type RWAFlowChart, type RWAFlowVisibleRange } from './flows'

type DataZoomPayload = {
	start?: number
	end?: number
	startValue?: number
	endValue?: number
	batch?: Array<DataZoomPayload>
}

function getTimestampExtent(source: RWAFlowChart['dataset']['source']): RWAFlowVisibleRange | null {
	const firstRow = source[0]
	const lastRow = source[source.length - 1]
	return firstRow && lastRow ? { start: firstRow[0], end: lastRow[0] } : null
}

function getVisibleRangeFromZoom(
	source: RWAFlowChart['dataset']['source'],
	event: DataZoomPayload
): RWAFlowVisibleRange | null {
	const extent = getTimestampExtent(source)
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
	containerClassName,
	onReady,
	onVisibleRangeChange
}: {
	chart: RWAFlowChart
	defaultStartTimestamp?: number
	/** Lets the chart fill a flex panel instead of its fixed height. */
	containerClassName?: string
	onReady?: (instance: echarts.ECharts | null) => void
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
	// ECharts and the range effect below call these outside render; each reads the latest data and callbacks.
	const reportVisibleRange = useStableCallback((range: RWAFlowVisibleRange | null) => onVisibleRangeChange?.(range))

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
		onReady?.(instance)
	})

	useEffect(() => {
		const extent = getTimestampExtent(chart.dataset.source)
		reportVisibleRange(
			extent
				? {
						start: Math.max(extent.start, defaultStartTimestamp ?? extent.start),
						end: extent.end
					}
				: null
		)
	}, [chart.dataset.source, defaultStartTimestamp, reportVisibleRange])

	return (
		<MultiSeriesChart
			dataset={chart.dataset}
			charts={chart.charts}
			groupBy={chart.groupBy}
			chartOptions={chartOptions}
			hideDefaultLegend={false}
			showTotalInTooltip={false}
			{...(containerClassName ? { containerClassName } : {})}
			onReady={handleReady}
		/>
	)
}
