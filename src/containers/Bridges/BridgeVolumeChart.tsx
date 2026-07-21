import { lazy, type ReactNode, startTransition, Suspense, useDeferredValue, useMemo, useState } from 'react'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { DataFreshness } from '~/ui/DataFreshness'
import { TagGroup } from '~/ui/SegmentedControl'
import {
	BRIDGE_VOLUME_METRIC_TYPES,
	BRIDGE_VOLUME_VIEW_TYPES,
	buildBridgeVolumeChartData,
	getStaleBridgeVolumeTimestamp,
	type BridgeVolumeInputPoint,
	type BridgeVolumeMetricType,
	type BridgeVolumeViewType
} from './bridgeVolumeData'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

interface BridgeVolumeChartProps {
	data: BridgeVolumeInputPoint[] | null | undefined
	height?: string
	onReady?: (instance: any | null) => void
	headerStart?: ReactNode
	headerEnd?: ReactNode
}

export function BridgeVolumeChart({ data, height, onReady, headerStart, headerEnd }: BridgeVolumeChartProps) {
	const [timePeriod, setTimePeriod] = useState<LowercaseDwmGrouping>('weekly')
	const [metricType, setMetricType] = useState<BridgeVolumeMetricType>('Volume')
	const [viewType, setViewType] = useState<BridgeVolumeViewType>('Split')

	const volumeChartData = useMemo(() => {
		return buildBridgeVolumeChartData({ data, timePeriod, metricType, viewType })
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
			{staleDataTimestamp != null ? (
				<div className="px-4 pt-2">
					<DataFreshness timestamp={staleDataTimestamp} label="Bridge volume data last updated" />
				</div>
			) : null}

			<Suspense fallback={<div style={{ height: height ?? '360px' }} />}>
				<MultiSeriesChart
					dataset={deferredChartData.dataset}
					charts={deferredChartData.charts}
					height={height}
					hideDefaultLegend={false}
					groupBy={timePeriod}
					valueSymbol={deferredChartData.metricType === 'Volume' ? '$' : ''}
					onReady={onReady}
				/>
			</Suspense>
		</>
	)
}
