import type { ParsedUrlQuery } from 'node:querystring'
import { useRouter } from 'next/router'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import { pushShallowQuery } from '~/utils/routerQuery'
import { DEFAULT_TIMEFRAME, TIMEFRAME_OPTIONS, type Timeframe } from './constants'

const DAYS: Record<Timeframe, number | null> = {
	all: null,
	'7d': 7,
	'30d': 30,
	'60d': 60
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

const TIMEFRAME_BADGES: Record<Timeframe, string> = {
	all: 'All Time',
	'7d': 'Last 7-day',
	'30d': 'Last 30-day',
	'60d': 'Last 60-day'
}

export function timeframeBadge(tf: Timeframe): string {
	return TIMEFRAME_BADGES[tf]
}

export function timeframePeriod(tf: Timeframe): string {
	return tf === 'all' ? 'All Time' : tf
}

export function readTimeframe(query: ParsedUrlQuery): Timeframe {
	return TIMEFRAME_OPTIONS.find((option) => option.value === query.period)?.value ?? DEFAULT_TIMEFRAME
}

/** One `period` in the URL drives every leaderboard; the section tabs carry it from page to page. */
export function useLeaderboardTimeframe() {
	const router = useRouter()
	const timeframe = readTimeframe(router.query)
	const setTimeframe = (value: Timeframe) =>
		void pushShallowQuery(router, { period: value === DEFAULT_TIMEFRAME ? undefined : value })
	const nowSec = useNowSeconds()
	return { timeframe, setTimeframe, range: timeframeToRange(timeframe, new Date(nowSec * 1000)) }
}

export { DEFAULT_TIMEFRAME }
