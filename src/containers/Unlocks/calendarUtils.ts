import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import { formatIsoDate } from '~/utils/dateFormat'
import type { DayInfo } from './calendarTypes'

dayjs.extend(isBetween)

export const generateCalendarDays = (date: Dayjs): Array<DayInfo> => {
	const startOfMonth = date.startOf('month')
	const endOfMonth = date.endOf('month')
	const startDay = startOfMonth.day()
	const daysInMonth = endOfMonth.date()

	const days: Array<DayInfo> = []

	const prevMonth = date.subtract(1, 'month')
	const prevMonthEnd = prevMonth.endOf('month').date()
	for (let i = startDay - 1; i >= 0; i--) {
		days.push({
			date: prevMonth.date(prevMonthEnd - i),
			isCurrentMonth: false
		})
	}

	for (let i = 1; i <= daysInMonth; i++) {
		days.push({
			date: date.date(i),
			isCurrentMonth: true
		})
	}

	const remainingDays = 42 - days.length
	const nextMonth = date.add(1, 'month')
	for (let i = 1; i <= remainingDays; i++) {
		days.push({
			date: nextMonth.date(i),
			isCurrentMonth: false
		})
	}

	return days
}

export const generateWeekDays = (date: Dayjs): Array<DayInfo> => {
	const startOfWeek = date.startOf('week')
	const days: Array<DayInfo> = []

	for (let i = 0; i < 7; i++) {
		const day = startOfWeek.add(i, 'day')
		const isCurrentMonth = day.isSame(date, 'month')
		days.push({
			date: day,
			isCurrentMonth
		})
	}
	return days
}

/**
 * The day the calendar opens on: the `date` query when it parses, else the UTC day of `nowSec`. Unlock days are
 * keyed by UTC date, and a local-zone "now" would open a different month on the server and in the visitor's
 * browser near a month boundary.
 */
export const calendarDateFromQuery = (dateParam: string | undefined, nowSec: number): Dayjs => {
	const parsed = dateParam ? dayjs(dateParam) : null
	// A local-midnight day for the UTC date, so the grid's calendar-day math stays in the zone it already uses.
	return parsed?.isValid() ? parsed : dayjs(formatIsoDate(nowSec, { input: 'seconds' }))
}
