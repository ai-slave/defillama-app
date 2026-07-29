import type { ChartTimeGrouping } from '~/components/ECharts/MultiSeriesChart/types'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import { getFreshTimeSeriesCurrentPoint, getTimeSeriesPeriodPair } from '~/utils/timeSeries'
import type { BridgeVolumeChartPoint } from './types'

function getBridgeProtocolVolume(point: BridgeVolumeChartPoint): number | null {
	return point.Deposited == null || point.Withdrawn == null ? null : (point.Deposited + Math.abs(point.Withdrawn)) / 2
}

function addKnownBridgeProtocolLeg(left: number | null, right: number | null): number | null {
	return left == null || right == null ? null : left + right
}

export function getBridgeProtocolCompletedDayVolumes(
	volumeChartDataByChain: BridgeVolumeChartPoint[] | null | undefined,
	currentTimeMs: number = Date.now()
): { current: BridgeVolumeChartPoint; previous: BridgeVolumeChartPoint } | null {
	return getTimeSeriesPeriodPair(volumeChartDataByChain, 1, (point) => point.date, {
		currentTimeMs,
		currentDayOffset: 1
	})
}

export function buildBridgeProtocolAllChainsVolumeData({
	active,
	groupBy,
	volumeChartDataByChain
}: {
	active: boolean
	groupBy: ChartTimeGrouping
	volumeChartDataByChain: BridgeVolumeChartPoint[] | null | undefined
}) {
	const source: Array<[number, number | null]> = []

	if (!active || !volumeChartDataByChain) {
		return { source, dimensions: ['timestamp', 'Volume'] }
	}

	if (groupBy === 'daily') {
		for (const point of volumeChartDataByChain) {
			source.push([point.date * 1e3, getBridgeProtocolVolume(point)])
		}
	} else {
		const groupedValues = new Map<number, number | null>()
		for (const point of volumeChartDataByChain) {
			const key = getBucketTimestampSec(point.date, groupBy)
			const value = getBridgeProtocolVolume(point)
			const existing = groupedValues.get(key)
			groupedValues.set(key, existing === undefined ? value : addKnownBridgeProtocolLeg(existing, value))
		}

		for (const [date, value] of groupedValues) {
			source.push([date * 1e3, value])
		}
	}

	return { source, dimensions: ['timestamp', 'Volume'] }
}

export function getBridgeProtocolPrevDayVolumeValue({
	isAllChains,
	volumeChartDataByChain,
	totalDepositedUSD,
	totalWithdrawnUSD,
	dataTimestamp,
	currentTimeMs = Date.now()
}: {
	isAllChains: boolean
	volumeChartDataByChain: BridgeVolumeChartPoint[] | null | undefined
	totalDepositedUSD: number | null | undefined
	totalWithdrawnUSD: number | null | undefined
	dataTimestamp?: number
	currentTimeMs?: number
}) {
	if (!isAllChains) return null
	const hasFreshRollingStats =
		dataTimestamp != null &&
		getFreshTimeSeriesCurrentPoint([{ date: dataTimestamp }], (point) => point.date, { currentTimeMs }) != null
	if (hasFreshRollingStats) {
		return totalDepositedUSD == null || totalWithdrawnUSD == null ? null : (totalDepositedUSD + totalWithdrawnUSD) / 2
	}
	const completedDay = getFreshTimeSeriesCurrentPoint(volumeChartDataByChain, (point) => point.date, {
		currentTimeMs,
		currentDayOffset: 1
	})
	return completedDay ? getBridgeProtocolVolume(completedDay) : null
}

export function buildBridgeProtocolInflowsData({
	active,
	groupBy,
	volumeChartDataByChain
}: {
	active: boolean
	groupBy: ChartTimeGrouping
	volumeChartDataByChain: BridgeVolumeChartPoint[] | null | undefined
}) {
	const source: Array<[number, number | null, number | null]> = []

	if (!active || !volumeChartDataByChain || volumeChartDataByChain.length === 0) {
		return { source, dimensions: ['timestamp', 'Deposited', 'Withdrawn'] }
	}

	if (groupBy === 'daily') {
		for (const point of volumeChartDataByChain) {
			source.push([point.date * 1e3, point.Deposited, point.Withdrawn])
		}
	} else {
		const groupedValues = new Map<number, { Deposited: number | null; Withdrawn: number | null }>()
		for (const point of volumeChartDataByChain) {
			const key = getBucketTimestampSec(point.date, groupBy)
			const existing = groupedValues.get(key)
			if (existing) {
				existing.Deposited = addKnownBridgeProtocolLeg(existing.Deposited, point.Deposited)
				existing.Withdrawn = addKnownBridgeProtocolLeg(existing.Withdrawn, point.Withdrawn)
			} else {
				groupedValues.set(key, {
					Deposited: point.Deposited,
					Withdrawn: point.Withdrawn
				})
			}
		}

		for (const [date, values] of groupedValues) {
			source.push([date * 1e3, values.Deposited, values.Withdrawn])
		}
	}

	return { source, dimensions: ['timestamp', 'Deposited', 'Withdrawn'] }
}
