import type { ChartTimeGrouping } from '~/components/ECharts/MultiSeriesChart/types'
import { getPeriodCsvCells, getPeriodCsvHeaders } from '~/components/ECharts/shared/csv'
import { getBucketTimestampSec } from '~/components/ECharts/shared/timeSeries'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import type { Chain, DashboardGrouping, Protocol } from './types'
import { generateConsistentChartColor } from './utils/colorManager'

type NumericChartTuple = readonly [timestamp: string | number, value: string | number]

export const convertToNumberFormat = (
	data: ReadonlyArray<NumericChartTuple>,
	convertToSeconds = false
): Array<[number, number]> => {
	const divisor = convertToSeconds ? 1000 : 1
	const points: Array<[number, number]> = []
	for (const [timestamp, value] of data) {
		points.push([
			(typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp) / divisor,
			typeof value === 'string' ? parseFloat(value) : value
		])
	}
	return points
}

export const normalizeHourlyToDaily = (
	data: Array<[number, number]>,
	aggregationType: 'last' | 'sum' = 'last'
): Array<[number, number]> => {
	if (!data || data.length === 0) return []
	if (data.length === 1) return data

	const intervalCount = Math.min(9, data.length - 1)
	let intervalTotal = 0
	let previousTimestamp: number | null = null
	let sampledIntervals = 0
	for (const [timestamp] of data) {
		if (previousTimestamp !== null) {
			intervalTotal += timestamp - previousTimestamp
			sampledIntervals++
			if (sampledIntervals === intervalCount) break
		}
		previousTimestamp = timestamp
	}
	const avgTimeDiff = intervalTotal / sampledIntervals

	const isHourlyData = avgTimeDiff < 24 * 60 * 60 && avgTimeDiff > 30 * 60

	if (!isHourlyData) {
		return data
	}

	const dailyData: Array<[number, number]> = []
	for (const [timestamp, value] of data) {
		const dayTimestamp = Math.floor(timestamp / 86_400) * 86_400
		const previous = dailyData[dailyData.length - 1]
		if (previous?.[0] === dayTimestamp) {
			previous[1] = aggregationType === 'sum' ? previous[1] + value : value
		} else {
			dailyData.push([dayTimestamp, value])
		}
	}
	return dailyData
}

/** A dashboard grouping in the shared chart vocabulary that buckets, tooltips and CSVs use. */
export const DASHBOARD_CHART_GROUPING: Record<DashboardGrouping, ChartTimeGrouping> = {
	day: 'daily',
	week: 'weekly',
	month: 'monthly',
	quarter: 'quarterly',
	year: 'yearly'
}

// Weeks are keyed by their last day and other periods by their first, like every shared chart bucket.
export const getGroupedTimestampSec = (timestampSec: number, grouping: DashboardGrouping): number =>
	grouping === 'day' ? timestampSec : getBucketTimestampSec(timestampSec, DASHBOARD_CHART_GROUPING[grouping])

/** CSV date columns for a dashboard grouping. Grouped rows get the start and end date of their period. */
export function getCsvPeriodHeaders(grouping: DashboardGrouping): Array<string> {
	return getPeriodCsvHeaders(DASHBOARD_CHART_GROUPING[grouping])
}

/** ISO date cells for one row keyed by `getGroupedTimestampSec`, matching `getCsvPeriodHeaders`. */
export function getCsvPeriodCells(groupedTimestampSec: number, grouping: DashboardGrouping): Array<string> {
	return getPeriodCsvCells(groupedTimestampSec * 1e3, DASHBOARD_CHART_GROUPING[grouping])
}

export const groupData = (
	data: Array<[number, number]> | undefined,
	grouping: DashboardGrouping = 'day'
): Array<[number, number]> => {
	if (!data || data.length === 0) return []

	if (grouping === 'day') {
		return data
	}

	const groupedData: Array<[number, number]> = []
	for (const [timestamp, value] of data) {
		const groupKey = getGroupedTimestampSec(timestamp, grouping)
		const lastGroup = groupedData[groupedData.length - 1]
		if (lastGroup?.[0] === groupKey) lastGroup[1] += value
		else groupedData.push([groupKey, value])
	}

	return groupedData
}

// Icon URL helper functions
export const getItemIconUrl = (
	itemType: 'chain' | 'protocol',
	itemInfo: Chain | Protocol | { id?: string; logo?: string } | null | undefined,
	itemIdentifier: string
): string => {
	if (itemType === 'chain') {
		return chainIconUrl(itemIdentifier)
	}
	if (itemInfo && 'logo' in itemInfo && itemInfo.logo) return itemInfo.logo
	const key = (itemInfo && 'id' in itemInfo ? itemInfo.id : itemIdentifier)?.toString()
	return tokenIconUrl(key)
}

export const generateChartColor = (itemName: string, fallbackColor: string): string => {
	const itemType = itemName?.includes('_') ? 'protocol' : 'chain'

	return generateConsistentChartColor(itemName, fallbackColor, itemType)
}
