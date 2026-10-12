import { lazy, type ReactNode, startTransition, Suspense, useDeferredValue, useMemo, useState } from 'react'
import type { ChartExportHandle } from '~/components/ChartExport/types'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { DataFreshness } from '~/ui/DataFreshness'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import type { BridgeVolumePoint } from './api.types'
import {
	BRIDGE_VOLUME_METRIC_TYPES,
	BRIDGE_VOLUME_VIEW_TYPES,
	buildBridgeVolumeChartData,
	getStaleBridgeVolumeTimestamp,
	type BridgeVolumeMetricType,
	type BridgeVolumeViewType
} from './bridgeVolumeData'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

interface BridgeVolumeChartProps {
	data: Array<BridgeVolumePoint> | null | undefined
	height?: string
	exportButtons: ChartExportHandle
	headerStart?: ReactNode
	headerEnd?: ReactNode
	/** A `ScopeNote` for the page to place under this chart's own toolbar. */
	scopeNote?: ReactNode
}

export function BridgeVolumeChart({
	data,
	height,
	exportButtons,
	headerStart,
	headerEnd,
	scopeNote
}: BridgeVolumeChartProps) {
	const [timePeriod, setTimePeriod] = useState<LowercaseDwmGrouping>('weekly')
	const [metricType, setMetricType] = useState<BridgeVolumeMetricType>('Volume')
	const [viewType, setViewType] = useState<BridgeVolumeViewType>('Split')

	const volumeChartData = useMemo(() => {
		// Deferred together with the rows, so labels never pair old rows with a new grouping.
		return { ...buildBridgeVolumeChartData({ data, timePeriod, metricType, viewType }), groupBy: timePeriod }
	}, [data, metricType, timePeriod, viewType])
	const deferredChartData = useDeferredValue(volumeChartData)
	const nowSec = useNowSeconds()
	const staleDataTimestamp = useMemo(() => getStaleBridgeVolumeTimestamp(data, nowSec), [data, nowSec])

	return (
		<>
			<ChartPanelToolbar>
				{headerStart}
				<ChartGroupingSelector
					value={timePeriod}
					setValue={setTimePeriod}
					options={DWM_GROUPING_OPTIONS_LOWERCASE}
					className={headerStart ? undefined : 'mr-auto'}
				/>
				<SegmentedControl
					variant="default"
					size="md"
					value={viewType}
					onValueChange={(newViewType) => startTransition(() => setViewType(newViewType))}
					options={BRIDGE_VOLUME_VIEW_TYPES.map((value) => ({ value, label: value }))}
					label="Chart view"
				/>
				<SegmentedControl
					variant="default"
					size="md"
					value={metricType}
					onValueChange={(newMetricType) => startTransition(() => setMetricType(newMetricType))}
					options={BRIDGE_VOLUME_METRIC_TYPES.map((value) => ({ value, label: value }))}
					label="Metric"
				/>
				{headerEnd}
			</ChartPanelToolbar>
			{scopeNote}
			{staleDataTimestamp != null ? (
				<div className="px-4 pt-2">
					<DataFreshness timestamp={staleDataTimestamp} label="Bridge volume data last updated" />
				</div>
			) : null}

			<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading chart" style={{ minHeight: height }} />}>
				<MultiSeriesChart
					exportButtons={exportButtons}
					dataset={deferredChartData.dataset}
					charts={deferredChartData.charts}
					{...(height !== undefined ? { height } : {})}
					showLegend
					groupBy={deferredChartData.groupBy}
					valueSymbol={deferredChartData.metricType === 'Volume' ? '$' : ''}
				/>
			</Suspense>
		</>
	)
}
