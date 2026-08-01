import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import { formatLineChart } from '~/components/ECharts/shared/timeSeries'
import type { IProtocolValueChart, ProtocolTvlKey } from './api.types'
import { getGroupedTimestampSec } from './chartSeries.utils'

type ChartInterval = ChartTimeGroupingWithCumulative

export type ProtocolExtraTvlKey = Exclude<ProtocolTvlKey, 'tvl' | 'all'>
export const PROTOCOL_EXTRA_TVL_KEYS = [
	'staking',
	'borrowed',
	'pool2',
	'vesting'
] as const satisfies readonly ProtocolExtraTvlKey[]
type ProtocolExtraTvlSettings = Partial<Record<ProtocolExtraTvlKey, boolean>>

export const isProtocolExtraTvlKey = (value: string): value is ProtocolExtraTvlKey => {
	switch (value) {
		case 'staking':
		case 'borrowed':
		case 'pool2':
		case 'vesting':
			return true
		default:
			return false
	}
}

const MAX_TVL_TIMESTAMP_ALIGNMENT_DIFF_SEC = 24 * 60 * 60

interface ExtraTvlChartsResult {
	charts: Partial<Record<ProtocolExtraTvlKey, Record<string, number>>>
	latestTimestamps: Partial<Record<ProtocolExtraTvlKey, number>>
}

export function getProtocolExtraTvlChartFetchState({
	isRouterReady,
	currentTvlByChain,
	tvlSettings,
	needsCompositeTvlChart,
	isStakingTvlToggled,
	isBorrowedTvlToggled
}: {
	isRouterReady: boolean
	currentTvlByChain: Record<string, number> | null
	tvlSettings: ProtocolExtraTvlSettings
	needsCompositeTvlChart: boolean
	isStakingTvlToggled: boolean
	isBorrowedTvlToggled: boolean
}) {
	return {
		staking: !!(
			isRouterReady &&
			currentTvlByChain?.staking != null &&
			((needsCompositeTvlChart && tvlSettings.staking) || isStakingTvlToggled)
		),
		borrowed: !!(
			isRouterReady &&
			currentTvlByChain?.borrowed != null &&
			((needsCompositeTvlChart && tvlSettings.borrowed) || isBorrowedTvlToggled)
		),
		pool2: !!(isRouterReady && needsCompositeTvlChart && currentTvlByChain?.pool2 != null && tvlSettings.pool2),
		vesting: !!(isRouterReady && needsCompositeTvlChart && currentTvlByChain?.vesting != null && tvlSettings.vesting)
	}
}

const toUnixSeconds = (timestamp: number): number =>
	timestamp >= 1e12 ? Math.floor(timestamp / 1e3) : Math.floor(timestamp)

const getLatestTimestamp = (chart: IProtocolValueChart): number | null => {
	if (chart.length === 0) return null
	const lastPoint = chart[chart.length - 1]
	return lastPoint ? toUnixSeconds(lastPoint[0]) : null
}

export function buildExtraTvlCharts(
	chartByKey: Partial<Record<ProtocolExtraTvlKey, IProtocolValueChart | undefined>>
): ExtraTvlChartsResult {
	const charts: ExtraTvlChartsResult['charts'] = {}
	const latestTimestamps: ExtraTvlChartsResult['latestTimestamps'] = {}

	for (const key of PROTOCOL_EXTRA_TVL_KEYS) {
		const chart = chartByKey[key]
		if (!chart) continue

		const byDate: Record<string, number> = {}
		charts[key] = byDate
		if (chart.length === 0) continue

		let maxTimestamp: number | null = null
		for (const [timestamp, value] of chart) {
			const dateInSec = toUnixSeconds(timestamp)
			byDate[String(dateInSec)] = value
			if (maxTimestamp == null || dateInSec > maxTimestamp) maxTimestamp = dateInSec
		}

		if (maxTimestamp != null) latestTimestamps[key] = maxTimestamp
	}

	return { charts, latestTimestamps }
}

export function getSelectedProtocolExtraTvlKeys(
	tvlSettings: ProtocolExtraTvlSettings,
	currentTvlByChain: Record<string, number> | null
): ProtocolExtraTvlKey[] {
	const selected: ProtocolExtraTvlKey[] = []
	for (const key of PROTOCOL_EXTRA_TVL_KEYS) {
		if (tvlSettings[key] && currentTvlByChain?.[key] != null) selected.push(key)
	}
	return selected
}

export function buildTvlChart({
	tvlChartData,
	extraTvlCharts,
	selectedExtraTvls,
	groupBy,
	denominationPriceHistory
}: {
	tvlChartData: IProtocolValueChart
	extraTvlCharts: ExtraTvlChartsResult
	selectedExtraTvls: readonly ProtocolExtraTvlKey[]
	groupBy: ChartInterval
	denominationPriceHistory: Record<string, number> | null
}): Array<[number, number | null]> {
	if (selectedExtraTvls.length === 0) {
		return formatLineChart({ data: tvlChartData, groupBy, denominationPriceHistory })
	}

	const store: Record<string, { timestampSec: number; value: number | null; retainedTimestampSec: number }> = {}
	const latestMainTvlTimestamp = getLatestTimestamp(tvlChartData)
	let alignedLatestMainTimestamp = latestMainTvlTimestamp

	if (latestMainTvlTimestamp != null) {
		for (const extra of selectedExtraTvls) {
			const extraLatestTimestamp = extraTvlCharts.latestTimestamps[extra]
			if (
				extraLatestTimestamp != null &&
				Math.abs(extraLatestTimestamp - latestMainTvlTimestamp) <= MAX_TVL_TIMESTAMP_ALIGNMENT_DIFF_SEC &&
				(alignedLatestMainTimestamp == null || extraLatestTimestamp > alignedLatestMainTimestamp)
			) {
				alignedLatestMainTimestamp = extraLatestTimestamp
			}
		}
	}

	const shouldNormalizeMainTvlLatest =
		latestMainTvlTimestamp != null &&
		alignedLatestMainTimestamp != null &&
		alignedLatestMainTimestamp !== latestMainTvlTimestamp

	for (const [rawDate, value] of tvlChartData) {
		const dateInSec = toUnixSeconds(rawDate)
		const alignedDateInSec =
			shouldNormalizeMainTvlLatest && dateInSec === latestMainTvlTimestamp && alignedLatestMainTimestamp != null
				? alignedLatestMainTimestamp
				: dateInSec
		const dateKey = getGroupedTimestampSec(alignedDateInSec, groupBy)
		let extrasAtTimestamp = 0
		let hasMissingExtra = false
		for (const extra of selectedExtraTvls) {
			const extraChart = extraTvlCharts.charts[extra]
			if (extraChart === undefined) {
				hasMissingExtra = true
				break
			}
			const extraLatestTimestamp = extraTvlCharts.latestTimestamps[extra]
			if (extraLatestTimestamp === undefined) continue

			let extraValue = extraChart[String(dateInSec)]
			if (extraValue === undefined && alignedDateInSec !== dateInSec) {
				extraValue = extraChart[String(alignedDateInSec)]
			}

			// Align only near the latest timestamp so stale charts do not shift.
			if (extraValue === undefined && latestMainTvlTimestamp != null && dateInSec === latestMainTvlTimestamp) {
				if (Math.abs(latestMainTvlTimestamp - extraLatestTimestamp) <= MAX_TVL_TIMESTAMP_ALIGNMENT_DIFF_SEC) {
					extraValue = extraChart[String(extraLatestTimestamp)]
				}
			}
			if (extraValue === undefined) {
				hasMissingExtra = true
				break
			}
			extrasAtTimestamp += extraValue
		}
		store[String(dateKey)] = {
			timestampSec: dateKey,
			value: hasMissingExtra ? null : value + extrasAtTimestamp,
			retainedTimestampSec: alignedDateInSec
		}
	}

	const finalChart: Array<[number, number | null]> = []
	for (const dateKey in store) {
		const point = store[dateKey]
		if (point === undefined) continue
		const dateInMs = point.timestampSec * 1e3
		if (point.value === null) {
			finalChart.push([dateInMs, null])
			continue
		}
		const retainedTimestampSec = point.retainedTimestampSec
		const retainedTimestampMs = retainedTimestampSec * 1e3
		const denominationRate =
			denominationPriceHistory?.[String(retainedTimestampSec)] ??
			denominationPriceHistory?.[String(retainedTimestampMs)]
		const finalValue = denominationPriceHistory
			? denominationRate
				? point.value / denominationRate
				: null
			: point.value
		if (finalValue !== null) {
			finalChart.push([dateInMs, finalValue])
		}
	}

	return finalChart
}

export function buildUsdInflowsFromTvlChart(tvlChart: Array<[number, number | null]>): Array<[number, number]> {
	if (tvlChart.length < 2) return []

	const inflows: Array<[number, number]> = []
	let hasPrevious = false
	let previousValue: number | null = null
	for (const [timestamp, value] of tvlChart) {
		if (hasPrevious && value != null && previousValue != null) {
			inflows.push([Math.floor(timestamp / 1e3), value - previousValue])
		}
		hasPrevious = true
		previousValue = value
	}

	return inflows
}
