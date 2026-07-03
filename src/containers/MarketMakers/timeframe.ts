import { useCallback } from 'react'
import { getStorageItem, setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { DEFAULT_TIMEFRAME, TIMEFRAMES, type Timeframe } from './constants'

const DAYS: Record<Timeframe, number | null> = {
	'All Time': null,
	'Prev. 7d': 7,
	'Prev. 30d': 30,
	'Prev. 60d': 60
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10)
}

export type TimeRange = { start_date?: string; end_date?: string }

export function timeframeToRange(tf: Timeframe, today: Date): TimeRange {
	const days = DAYS[tf]
	if (days == null) return {}
	const start = new Date(today)
	start.setUTCDate(start.getUTCDate() - days)
	return { start_date: isoDate(start), end_date: isoDate(today) }
}

export function isDefaultRange(range: TimeRange): boolean {
	const def = timeframeToRange(DEFAULT_TIMEFRAME, new Date())
	return range.start_date === def.start_date && range.end_date === def.end_date
}

const TIMEFRAME_BADGES: Record<Timeframe, string> = {
	'All Time': 'All Time',
	'Prev. 7d': 'Last 7-day',
	'Prev. 30d': 'Last 30-day',
	'Prev. 60d': 'Last 60-day'
}

export function timeframeBadge(tf: Timeframe): string {
	return TIMEFRAME_BADGES[tf]
}

const TIMEFRAME_PERIODS: Record<Timeframe, string> = {
	'All Time': 'All Time',
	'Prev. 7d': '7D',
	'Prev. 30d': '30D',
	'Prev. 60d': '60D'
}

export function timeframePeriod(tf: Timeframe): string {
	return TIMEFRAME_PERIODS[tf]
}

const APPLY_TO_ALL_KEY = 'mm-timeframe-apply-all'
const GLOBAL_TIMEFRAME_KEY = 'mm-timeframe-global'
const boardKey = (boardId: string) => `mm-timeframe-${boardId}`

const VALID_TIMEFRAMES = new Set<string>(TIMEFRAMES)

function coerce(value: string | null | undefined): Timeframe {
	return value != null && VALID_TIMEFRAMES.has(value) ? (value as Timeframe) : DEFAULT_TIMEFRAME
}

export function useLeaderboardTimeframe(boardId: string) {
	const applyToAll = useStorageItem(APPLY_TO_ALL_KEY, 'false') === 'true'
	const key = applyToAll ? GLOBAL_TIMEFRAME_KEY : boardKey(boardId)
	const timeframe = coerce(useStorageItem(key, DEFAULT_TIMEFRAME))

	const setTimeframe = useCallback(
		(value: Timeframe) => {
			setStorageItem(key, value)
		},
		[key]
	)

	const setApplyToAll = useCallback(
		(value: boolean) => {
			if (value) setStorageItem(GLOBAL_TIMEFRAME_KEY, coerce(getStorageItem(key)))
			setStorageItem(APPLY_TO_ALL_KEY, value ? 'true' : 'false')
		},
		[key]
	)

	return { timeframe, setTimeframe, applyToAll, setApplyToAll, range: timeframeToRange(timeframe, new Date()) }
}

export { DEFAULT_TIMEFRAME }
