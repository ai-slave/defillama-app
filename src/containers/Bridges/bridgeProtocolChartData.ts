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

export function buildBridgeProtocolAllChainsVolumePairs({
	isAllChains,
	volumeChartDataByChain
}: {
	isAllChains: boolean
	volumeChartDataByChain: BridgeVolumeChartPoint[] | null | undefined
}): Array<[number, number]> {
	const allChainsVolumePairs: Array<[number, number]> = []

	if (!isAllChains || !volumeChartDataByChain) return allChainsVolumePairs

	for (const point of volumeChartDataByChain) {
		allChainsVolumePairs.push([point.date, (point.Deposited + Math.abs(point.Withdrawn)) / 2])
	}

	return allChainsVolumePairs
}

export function buildBridgeProtocolAllChainsVolumeData({
	groupBy,
	allChainsVolumePairs
}: {
	groupBy: ChartTimeGrouping
	allChainsVolumePairs: Array<[number, number]>
}) {
	const groupedAllChainsVolumePairs: Array<[number, number]> = []
	const source: Array<{ timestamp: number; Volume: number }> = []

	if (groupBy === 'daily' || allChainsVolumePairs.length === 0) {
		for (const pair of allChainsVolumePairs) {
			groupedAllChainsVolumePairs.push(pair)
		}
	} else {
		const groupedValues = new Map<number, number>()
		for (const [date, value] of allChainsVolumePairs) {
			const key = getBucketTimestampSec(date, groupBy)
			groupedValues.set(key, (groupedValues.get(key) ?? 0) + value)
		}

		const groupedEntries = Array.from(groupedValues.entries()).sort((a, b) => a[0] - b[0])
		for (const pair of groupedEntries) {
			groupedAllChainsVolumePairs.push(pair)
		}
	}

	for (const [date, value] of groupedAllChainsVolumePairs) {
		source.push({ timestamp: date * 1e3, Volume: value })
	}

	return {
		groupedAllChainsVolumePairs,
		volumeDataset: {
			source,
			dimensions: ['timestamp', 'Volume']
		}
	}
}

export function getBridgeProtocolPrevDayVolumeValue({
	isAllChains,
	allChainsVolumePairs,
	totalDepositedUSD,
	totalWithdrawnUSD,
	dataTimestamp,
	currentTimeMs = Date.now()
}: {
	isAllChains: boolean
	allChainsVolumePairs: Array<[number, number]>
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
	const completedDay = getFreshTimeSeriesCurrentPoint(allChainsVolumePairs, (point) => point[0], {
		currentTimeMs,
		currentDayOffset: 1
	})
	return completedDay?.[1] ?? null
}

export function buildBridgeProtocolInflowsData({
	isAllChains,
	groupBy,
	volumeChartDataByChain
}: {
	isAllChains: boolean
	groupBy: ChartTimeGrouping
	volumeChartDataByChain: BridgeVolumeChartPoint[] | null | undefined
}) {
	const groupedInflowsData: BridgeVolumeChartPoint[] = []
	const source: Array<{ timestamp: number; Deposited: number; Withdrawn: number }> = []

	if (isAllChains || !volumeChartDataByChain || volumeChartDataByChain.length === 0) {
		return {
			groupedInflowsData,
			inflowsDataset: {
				source,
				dimensions: ['timestamp', 'Deposited', 'Withdrawn']
			}
		}
	}

	if (groupBy === 'daily') {
		for (const point of volumeChartDataByChain) {
			groupedInflowsData.push(point)
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

		const groupedEntries = Array.from(groupedValues.entries()).sort((a, b) => a[0] - b[0])
		for (const [date, values] of groupedEntries) {
			groupedInflowsData.push({ date, ...values })
		}
	}

	for (const { date, Deposited, Withdrawn } of groupedInflowsData) {
		source.push({
			timestamp: date * 1e3,
			Deposited,
			Withdrawn: -Withdrawn
		})
	}

	return {
		groupedInflowsData,
		inflowsDataset: {
			source,
			dimensions: ['timestamp', 'Deposited', 'Withdrawn']
		}
	}
}
