const DISPLAY_LOCALE = 'en-US'

export type TimestampInput = 'seconds' | 'milliseconds'

type NumericDateOptions = { input: TimestampInput }
type DateTimeOptions = { timeZone: 'UTC' } | { timeZone: 'local'; timeZoneName?: 'short' }
type NumericDateTimeOptions = NumericDateOptions & DateTimeOptions
type RelativeTimeOptions = { now?: Date }
type NumericRelativeTimeOptions = NumericDateOptions & RelativeTimeOptions
type DateValue = string | number | Date | null | undefined
type NonNumericDateValue = string | Date | null | undefined
type NumericDateValue = number | null | undefined

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const OFFSET_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/i

const UTC_DATE_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
})

const UTC_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	year: 'numeric',
	month: 'short',
	timeZone: 'UTC'
})

const LOCAL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit'
})

const LOCAL_DATE_TIME_WITH_ZONE_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	timeZoneName: 'short'
})

const UTC_DATE_TIME_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
	timeZone: 'UTC'
})

function fromNumericTimestamp(value: number, input: TimestampInput) {
	return new Date(input === 'seconds' ? value * 1000 : value)
}

function validDate(date: Date) {
	return Number.isNaN(date.getTime()) ? null : date
}

function isLeapYear(year: number) {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function isValidInstant(value: string) {
	const match = OFFSET_INSTANT.exec(value)
	if (!match) return false
	const [
		,
		yearText = '',
		monthText = '',
		dayText = '',
		hourText = '',
		minuteText = '',
		secondText = '0',
		,
		offset = ''
	] = match
	const year = Number(yearText)
	const month = Number(monthText)
	const day = Number(dayText)
	const hour = Number(hourText)
	const minute = Number(minuteText)
	const second = Number(secondText)
	const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

	const daysInSelectedMonth = daysInMonth[month - 1]
	if (month < 1 || month > 12 || daysInSelectedMonth === undefined || day < 1 || day > daysInSelectedMonth) return false
	if (hour > 23 || minute > 59 || second > 59) return false
	if (offset !== 'Z' && offset !== 'z') {
		const offsetHour = Number(offset.slice(1, 3))
		const offsetMinute = Number(offset.slice(4, 6))
		if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false
	}
	return true
}

function parseDate(value: DateValue, input?: TimestampInput) {
	if (value == null) return null
	if (value instanceof Date) return validDate(value)
	if (typeof value === 'number') {
		if (input !== 'seconds' && input !== 'milliseconds') return null
		return validDate(fromNumericTimestamp(value, input))
	}
	if (DATE_ONLY.test(value)) {
		const date = validDate(new Date(`${value}T00:00:00.000Z`))
		return date?.toISOString().startsWith(value) ? date : null
	}
	if (!isValidInstant(value)) return null
	return validDate(new Date(value))
}

function parseInstant(value: DateValue, input?: TimestampInput) {
	if (typeof value === 'string' && !isValidInstant(value)) return null
	return parseDate(value, input)
}

/** Parses a canonical calendar date or offset-bearing instant without applying display formatting. */
export function parseDateTimestamp(value: NonNumericDateValue): number | null
export function parseDateTimestamp(value: NumericDateValue, options: NumericDateOptions): number | null
export function parseDateTimestamp(value: DateValue, options?: NumericDateOptions) {
	return parseDate(value, options?.input)?.getTime() ?? null
}

/** Formats a calendar fact in UTC so its displayed day cannot shift with the viewer's timezone. */
export function formatDate(value: NonNumericDateValue): string | null
export function formatDate(value: NumericDateValue, options: NumericDateOptions): string | null
export function formatDate(value: DateValue, options?: NumericDateOptions) {
	const date = parseDate(value, options?.input)
	return date ? UTC_DATE_FORMATTER.format(date) : null
}

/** Formats an exact instant, retaining its time. Local output must be rendered through a hydration-safe client path. */
export function formatDateTime(value: NonNumericDateValue, options: DateTimeOptions): string | null
export function formatDateTime(value: NumericDateValue, options: NumericDateTimeOptions): string | null
export function formatDateTime(value: DateValue, options?: DateTimeOptions | NumericDateTimeOptions) {
	if (options?.timeZone !== 'UTC' && options?.timeZone !== 'local') return null
	const date = parseInstant(value, 'input' in options ? options.input : undefined)
	if (!date) return null
	return options.timeZone === 'UTC'
		? `${UTC_DATE_TIME_FORMATTER.format(date)} UTC`
		: options.timeZoneName === 'short'
			? LOCAL_DATE_TIME_WITH_ZONE_FORMATTER.format(date)
			: LOCAL_DATE_TIME_FORMATTER.format(date)
}

/** Formats the UTC calendar month containing a date. */
export function formatMonthYear(value: NonNumericDateValue): string | null
export function formatMonthYear(value: NumericDateValue, options: NumericDateOptions): string | null
export function formatMonthYear(value: DateValue, options?: NumericDateOptions) {
	const date = parseDate(value, options?.input)
	return date ? UTC_MONTH_YEAR_FORMATTER.format(date) : null
}

/** Formats freshness as compact relative text. Exact instants should remain available to the user separately. */
export function formatRelativeTime(value: NonNumericDateValue, options?: RelativeTimeOptions): string | null
export function formatRelativeTime(value: NumericDateValue, options: NumericRelativeTimeOptions): string | null
export function formatRelativeTime(value: DateValue, options?: RelativeTimeOptions | NumericRelativeTimeOptions) {
	const date = parseInstant(value, options && 'input' in options ? options.input : undefined)
	if (!date) return null

	const now = options?.now?.getTime() ?? Date.now()
	if (!Number.isFinite(now)) return null
	const diffMs = date.getTime() - now
	const absoluteMs = Math.abs(diffMs)
	if (absoluteMs < 5000) return 'just now'
	if (absoluteMs >= 604_800_000) return UTC_DATE_FORMATTER.format(date)

	const units =
		absoluteMs < 60_000
			? ([1000, 's'] as const)
			: absoluteMs < 3_600_000
				? ([60_000, 'm'] as const)
				: absoluteMs < 86_400_000
					? ([3_600_000, 'h'] as const)
					: ([86_400_000, 'd'] as const)
	const amount = Math.floor(absoluteMs / units[0])
	return diffMs < 0 ? `${amount}${units[1]} ago` : `in ${amount}${units[1]}`
}

/** Formats a UTC machine date for CSV, URL, form, and serialization contracts. */
export function formatIsoDate(value: NonNumericDateValue): string | null
export function formatIsoDate(value: NumericDateValue, options: NumericDateOptions): string | null
export function formatIsoDate(value: DateValue, options?: NumericDateOptions) {
	const date = parseDate(value, options?.input)
	return date ? date.toISOString().slice(0, 10) : null
}
