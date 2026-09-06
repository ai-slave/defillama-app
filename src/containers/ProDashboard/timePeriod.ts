import dayjs from 'dayjs'
import type { CustomTimePeriod, TimePeriod } from './dashboardTypes'

export type TimePeriodBounds = { start: number; end: number } | null

export function filterDataByTimePeriod(
	data: Array<[number, number]>,
	timePeriod: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	now?: dayjs.Dayjs
): Array<[number, number]> {
	if (data.length === 0) return data
	const bounds = getTimePeriodBounds(timePeriod, customPeriod, now)
	if (!bounds) return data

	let low = 0
	let high = data.length
	while (low < high) {
		const mid = (low + high) >>> 1
		const point = data[mid]
		if (!point) throw new Error(`Missing chart point at binary-search index ${mid}`)
		if (point[0] < bounds.start) low = mid + 1
		else high = mid
	}
	const startIndex = low

	low = startIndex
	high = data.length
	while (low < high) {
		const mid = (low + high) >>> 1
		const point = data[mid]
		if (!point) throw new Error(`Missing chart point at binary-search index ${mid}`)
		if (point[0] <= bounds.end) low = mid + 1
		else high = mid
	}

	if (startIndex === 0 && low === data.length) return data
	return data.slice(startIndex, low)
}

export function getTimePeriodBounds(
	timePeriod: TimePeriod,
	customPeriod?: CustomTimePeriod | null,
	now: dayjs.Dayjs = dayjs()
): TimePeriodBounds {
	if (timePeriod === 'all') return null
	if (timePeriod === 'custom' && customPeriod) {
		if (customPeriod.type === 'relative' && customPeriod.relativeDays) {
			return { start: now.subtract(customPeriod.relativeDays, 'day').unix(), end: Infinity }
		}
		if (customPeriod.type === 'absolute' && customPeriod.startDate != null && customPeriod.endDate != null) {
			return { start: customPeriod.startDate, end: customPeriod.endDate }
		}
		return null
	}

	let cutoffDate: dayjs.Dayjs

	switch (timePeriod) {
		case '30d':
			cutoffDate = now.subtract(30, 'day')
			break
		case '90d':
			cutoffDate = now.subtract(90, 'day')
			break
		case '365d':
			cutoffDate = now.subtract(365, 'day')
			break
		case 'ytd':
			cutoffDate = now.startOf('year')
			break
		case '3y':
			cutoffDate = now.subtract(3, 'year')
			break
		default:
			return null
	}

	return { start: cutoffDate.unix(), end: Infinity }
}
