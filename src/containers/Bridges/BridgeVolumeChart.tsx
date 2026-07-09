import { lazy, type ReactNode, startTransition, Suspense, useDeferredValue, useMemo, useState } from 'react'
import {
	ChartGroupingSelector,
	DWM_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmGrouping
} from '~/components/ECharts/ChartGroupingSelector'
import { TagGroup } from '~/components/TagGroup'
import { ChartPanelToolbar } from '~/ui/Toolbar'
import {
	BRIDGE_VOLUME_METRIC_TYPES,
	BRIDGE_VOLUME_VIEW_TYPES,
	buildBridgeVolumeChartData,
	type BridgeVolumeInputPoint,
	type BridgeVolumeMetricType,
	type BridgeVolumeViewType
} from './bridgeVolumeData'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

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

			<Suspense fallback={<div style={{ height: height ?? '360px' }} />}>
				{/* TODO: Add a subtle stale-state indicator if we revisit deferred transitions UX. */}
				<MultiSeriesChart2
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
