import type { ChartTimeGrouping } from '~/components/ECharts/types'
import { getBucketTimestampSec } from '~/components/ECharts/utils'
import { chainIconUrl, tokenIconUrl } from '~/utils/icons'
import type { Chain, DashboardGrouping, Protocol } from './types'
import { generateConsistentChartColor } from './utils/colorManager'

type NumericChartTuple = readonly [timestamp: string | number, value: string | number]

export const convertToNumberFormat = (
	data: readonly NumericChartTuple[],
	convertToSeconds: boolean = false
): [number, number][] => {
	const divisor = convertToSeconds ? 1000 : 1
	const points = new Array<[number, number]>(data.length)
	for (let index = 0; index < data.length; index++) {
		const [timestamp, value] = data[index]
		points[index] = [
			(typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp) / divisor,
			typeof value === 'string' ? parseFloat(value) : value
		]
	}
	return points
}

export const normalizeHourlyToDaily = (
	data: [number, number][],
	aggregationType: 'last' | 'sum' = 'last'
): [number, number][] => {
	if (!data || data.length === 0) return []
	if (data.length === 1) return data

	const intervalCount = Math.min(9, data.length - 1)
	let intervalTotal = 0
	for (let i = 1; i <= intervalCount; i++) intervalTotal += data[i][0] - data[i - 1][0]
	const avgTimeDiff = intervalTotal / intervalCount

	const isHourlyData = avgTimeDiff < 24 * 60 * 60 && avgTimeDiff > 30 * 60

	if (!isHourlyData) {
		return data
	}

	const dailyData: [number, number][] = []
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

const GROUPING_TO_CHART_GROUP_BY: Record<Exclude<DashboardGrouping, 'day'>, Exclude<ChartTimeGrouping, 'daily'>> = {
	week: 'weekly',
	month: 'monthly',
	quarter: 'quarterly',
	year: 'yearly'
}

export const getGroupedTimestampSec = (timestampSec: number, grouping: DashboardGrouping): number => {
	if (grouping === 'day') return timestampSec

	const groupedTimestampSec = getBucketTimestampSec(timestampSec, GROUPING_TO_CHART_GROUP_BY[grouping])
	const groupKeyDate = new Date(groupedTimestampSec * 1000)

	if (grouping === 'week') {
		groupKeyDate.setUTCDate(groupKeyDate.getUTCDate() - 6)
	}

	groupKeyDate.setUTCHours(0, 0, 0, 0)
	return Math.floor(groupKeyDate.getTime() / 1000)
}

export const groupData = (
	data: [number, number][] | undefined,
	grouping: DashboardGrouping = 'day'
): [number, number][] => {
	if (!data || data.length === 0) return []

	if (grouping === 'day') {
		return data
	}

	const groupedData: [number, number][] = []
	for (const [timestamp, value] of data) {
		const groupKey = getGroupedTimestampSec(timestamp, grouping)
		const lastGroup = groupedData[groupedData.length - 1]
		if (lastGroup?.[0] === groupKey) lastGroup[1] += value
		else groupedData.push([groupKey, value])
	}

	return groupedData
}

/** Convert ascending flow points to running totals without re-sorting or coercing the typed input. */
export const convertToCumulative = (data: [number, number][] | undefined): [number, number][] => {
	if (!data || data.length === 0) return []

	const result = new Array<[number, number]>(data.length)
	let cumulative = 0
	for (let i = 0; i < data.length; i++) {
		const [timestamp, value] = data[i]
		cumulative += value
		result[i] = [timestamp, cumulative]
	}
	return result
}

// Icon URL helper functions
export const getItemIconUrl = (
	itemType: 'chain' | 'protocol',
	itemInfo: Chain | Protocol | { id?: string; logo?: string } | null | undefined,
	itemIdentifier: string
): string => {
	if (itemType === 'chain') {
		return chainIconUrl(itemIdentifier)
	} else {
		if (itemInfo && 'logo' in itemInfo && itemInfo.logo) return itemInfo.logo
		const key = (itemInfo && 'id' in itemInfo ? itemInfo.id : itemIdentifier)?.toString()
		return tokenIconUrl(key)
	}
}

export const generateChartColor = (itemName: string, fallbackColor: string): string => {
	const itemType = itemName?.includes('_') ? 'protocol' : 'chain'

	return generateConsistentChartColor(itemName, fallbackColor, itemType)
}
