import type { ChartTimeGrouping } from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import { CHART_DOWN, CHART_UP, chartColor } from '~/constants/colors'
import { getFreshTimeSeriesCurrentPoint, toUnixMsTimestamp } from '~/utils/timeSeries'
import type { BridgeVolumePoint } from './api.types'

export const BRIDGE_VOLUME_VIEW_TYPES = ['Split', 'Combined'] as const
export type BridgeVolumeViewType = (typeof BRIDGE_VOLUME_VIEW_TYPES)[number]

export const BRIDGE_VOLUME_METRIC_TYPES = ['Volume', 'Transactions'] as const
export type BridgeVolumeMetricType = (typeof BRIDGE_VOLUME_METRIC_TYPES)[number]

export function getStaleBridgeVolumeTimestamp(
	data: Array<BridgeVolumePoint> | null | undefined,
	nowSec: number
): number | null {
	const currentTimeMs = nowSec * 1e3
	const hasCurrentOrCompletedDay =
		getFreshTimeSeriesCurrentPoint(data, (point) => point.date, { currentTimeMs }) != null ||
		getFreshTimeSeriesCurrentPoint(data, (point) => point.date, { currentTimeMs, currentDayOffset: 1 }) != null
	if (hasCurrentOrCompletedDay || !data?.length) return null

	let latestTimestampMs = -Infinity
	for (const point of data) {
		const timestampMs = toUnixMsTimestamp(point.date)
		if (timestampMs > latestTimestampMs) latestTimestampMs = timestampMs
	}
	return latestTimestampMs / 1e3
}

export const BRIDGE_VOLUME_SPLIT_CHARTS = [
	{
		type: 'bar' as const,
		name: 'Deposits',
		encode: { x: 0, y: 1 },
		color: CHART_UP,
		stack: 'metric',
		large: false
	},
	{
		type: 'bar' as const,
		name: 'Withdrawals',
		encode: { x: 0, y: 2 },
		color: CHART_DOWN,
		stack: 'metric',
		large: false
	}
]

export const BRIDGE_VOLUME_COMBINED_CHARTS = [
	{ type: 'bar' as const, name: 'Total', encode: { x: 0, y: 1 }, color: chartColor(0) }
]

function getBridgeMetricValues(item: BridgeVolumePoint, metricType: BridgeVolumeMetricType) {
	return {
		deposits: metricType === 'Volume' ? item.depositUSD : item.depositTxs,
		withdrawals: metricType === 'Volume' ? item.withdrawUSD : item.withdrawTxs
	}
}

function addKnownBridgeMetric(left: number | null, right: number | null): number | null {
	return left == null || right == null ? null : left + right
}

function pushBridgeVolumeDatasetRow({
	source,
	timestamp,
	deposits,
	withdrawals,
	viewType,
	metricType
}: {
	source: Array<Array<number | null>>
	timestamp: number
	deposits: number | null
	withdrawals: number | null
	viewType: BridgeVolumeViewType
	metricType: BridgeVolumeMetricType
}) {
	source.push(
		viewType === 'Split'
			? [timestamp, deposits, withdrawals == null ? null : -withdrawals]
			: [
					timestamp,
					deposits == null || withdrawals == null
						? null
						: metricType === 'Volume'
							? (deposits + withdrawals) / 2
							: deposits + withdrawals
				]
	)
}

export function buildBridgeVolumeChartData({
	data,
	timePeriod,
	metricType,
	viewType
}: {
	data: Array<BridgeVolumePoint> | null | undefined
	timePeriod: ChartTimeGrouping
	metricType: BridgeVolumeMetricType
	viewType: BridgeVolumeViewType
}) {
	const isSplit = viewType === 'Split'
	const dimensions = isSplit ? ['timestamp', 'Deposits', 'Withdrawals'] : ['timestamp', 'Total']
	const source: Array<Array<number | null>> = []

	if (!data?.length) {
		return {
			metricType,
			dataset: { source, dimensions },
			charts: isSplit ? BRIDGE_VOLUME_SPLIT_CHARTS : BRIDGE_VOLUME_COMBINED_CHARTS
		}
	}

	if (timePeriod === 'daily') {
		for (const item of data) {
			const { deposits, withdrawals } = getBridgeMetricValues(item, metricType)
			pushBridgeVolumeDatasetRow({
				source,
				timestamp: item.date * 1e3,
				deposits,
				withdrawals,
				viewType,
				metricType
			})
		}

		return {
			metricType,
			dataset: { source, dimensions },
			charts: isSplit ? BRIDGE_VOLUME_SPLIT_CHARTS : BRIDGE_VOLUME_COMBINED_CHARTS
		}
	}

	const groupedData = new Map<
		number,
		{
			deposits: number | null
			withdrawals: number | null
		}
	>()

	for (const item of data) {
		const key = getBucketTimestampSec(item.date, timePeriod)
		const { deposits, withdrawals } = getBridgeMetricValues(item, metricType)
		const existing = groupedData.get(key)
		if (existing) {
			existing.deposits = addKnownBridgeMetric(existing.deposits, deposits)
			existing.withdrawals = addKnownBridgeMetric(existing.withdrawals, withdrawals)
		} else {
			groupedData.set(key, { deposits, withdrawals })
		}
	}

	for (const [date, values] of groupedData) {
		pushBridgeVolumeDatasetRow({
			source,
			timestamp: date * 1e3,
			deposits: values.deposits,
			withdrawals: values.withdrawals,
			viewType,
			metricType
		})
	}

	return {
		metricType,
		dataset: { source, dimensions },
		charts: isSplit ? BRIDGE_VOLUME_SPLIT_CHARTS : BRIDGE_VOLUME_COMBINED_CHARTS
	}
}
