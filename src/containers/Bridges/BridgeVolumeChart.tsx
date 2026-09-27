import type * as echarts from 'echarts/core'
import { lazy, type ReactNode, startTransition, Suspense, useDeferredValue, useMemo, useState } from 'react'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { DataFreshness } from '~/ui/DataFreshness'
import { TagGroup } from '~/ui/SegmentedControl'
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
	onReady?: (instance: echarts.ECharts | null) => void
	headerStart?: ReactNode
	headerEnd?: ReactNode
	/** A `ChartScopeNote` for the page to place under this chart's own toolbar. */
	scopeNote?: ReactNode
}

export function BridgeVolumeChart({
	data,
	height,
	onReady,
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
	const staleDataTimestamp = useMemo(() => getStaleBridgeVolumeTimestamp(data), [data])

	return (
		<>
			<ChartPanelToolbar className="justify-end">
				{headerStart}
				<ChartGroupingSelector
					value={timePeriod}
					setValue={setTimePeriod}
					options={DWM_GROUPING_OPTIONS_LOWERCASE}
					className={headerStart ? undefined : 'mr-auto'}
				/>
				<TagGroup
					variant="default"
					size="md"
					selectedValue={viewType}
					setValue={(newViewType) => startTransition(() => setViewType(newViewType))}
					values={BRIDGE_VOLUME_VIEW_TYPES}
				/>
				<TagGroup
					variant="default"
					size="md"
					selectedValue={metricType}
					setValue={(newMetricType) => startTransition(() => setMetricType(newMetricType))}
					values={BRIDGE_VOLUME_METRIC_TYPES}
				/>
				{headerEnd}
			</ChartPanelToolbar>
			{scopeNote}
			{staleDataTimestamp != null ? (
				<div className="px-4 pt-2">
					<DataFreshness timestamp={staleDataTimestamp} label="Bridge volume data last updated" />
				</div>
			) : null}

			<Suspense fallback={<div style={{ height: height ?? '360px' }} />}>
				<MultiSeriesChart
					dataset={deferredChartData.dataset}
					charts={deferredChartData.charts}
					{...(height !== undefined ? { height } : {})}
					hideDefaultLegend={false}
					groupBy={deferredChartData.groupBy}
					valueSymbol={deferredChartData.metricType === 'Volume' ? '$' : ''}
					{...(onReady !== undefined ? { onReady } : {})}
				/>
			</Suspense>
		</>
	)
}
