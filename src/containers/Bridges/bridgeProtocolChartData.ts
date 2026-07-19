import type { ChartTimeGrouping } from '~/components/ECharts/types'
import { getBucketTimestampSec } from '~/components/ECharts/utils'
import { getFreshTimeSeriesCurrentPoint, getTimeSeriesPeriodPair } from '~/utils/timeSeries'
import type { BridgeVolumeChartPoint } from './types'

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
	const source: Array<{ timestamp: number; Volume: number }> = []

	if (!active || !volumeChartDataByChain) {
		return { source, dimensions: ['timestamp', 'Volume'] }
	}

	if (groupBy === 'daily') {
		for (const point of volumeChartDataByChain) {
			source.push({
				timestamp: point.date * 1e3,
				Volume: (point.Deposited + Math.abs(point.Withdrawn)) / 2
			})
		}
	} else {
		const groupedValues = new Map<number, number>()
		for (const point of volumeChartDataByChain) {
			const key = getBucketTimestampSec(point.date, groupBy)
			const value = (point.Deposited + Math.abs(point.Withdrawn)) / 2
			groupedValues.set(key, (groupedValues.get(key) ?? 0) + value)
		}

		for (const [date, value] of groupedValues) {
			source.push({ timestamp: date * 1e3, Volume: value })
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
	totalDepositedUSD: number | undefined
	totalWithdrawnUSD: number | undefined
	dataTimestamp?: number
	currentTimeMs?: number
}) {
	if (!isAllChains) return null
	// Current-day bridge stats expose these totals independently; preserve the historical zero-side fallback.
	const hasFreshRollingStats =
		dataTimestamp != null &&
		getFreshTimeSeriesCurrentPoint([{ date: dataTimestamp }], (point) => point.date, { currentTimeMs }) != null
	if (hasFreshRollingStats && (totalDepositedUSD != null || totalWithdrawnUSD != null)) {
		return ((totalDepositedUSD ?? 0) + (totalWithdrawnUSD ?? 0)) / 2
	}
	const completedDay = getFreshTimeSeriesCurrentPoint(volumeChartDataByChain, (point) => point.date, {
		currentTimeMs,
		currentDayOffset: 1
	})
	return completedDay ? (completedDay.Deposited + Math.abs(completedDay.Withdrawn)) / 2 : null
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
	const source: Array<{ timestamp: number; Deposited: number; Withdrawn: number }> = []

	if (!active || !volumeChartDataByChain || volumeChartDataByChain.length === 0) {
		return { source, dimensions: ['timestamp', 'Deposited', 'Withdrawn'] }
	}

	if (groupBy === 'daily') {
		for (const point of volumeChartDataByChain) {
			source.push({
				timestamp: point.date * 1e3,
				Deposited: point.Deposited,
				Withdrawn: point.Withdrawn
			})
		}
	} else {
		const groupedValues = new Map<number, { Deposited: number; Withdrawn: number }>()
		for (const point of volumeChartDataByChain) {
			const key = getBucketTimestampSec(point.date, groupBy)
			const existing = groupedValues.get(key)
			if (existing) {
				existing.Deposited += point.Deposited
				existing.Withdrawn += point.Withdrawn
			} else {
				groupedValues.set(key, {
					Deposited: point.Deposited,
					Withdrawn: point.Withdrawn
				})
			}
		}

		for (const [date, values] of groupedValues) {
			source.push({
				timestamp: date * 1e3,
				Deposited: values.Deposited,
				Withdrawn: values.Withdrawn
			})
		}
	}

	return { source, dimensions: ['timestamp', 'Deposited', 'Withdrawn'] }
}
