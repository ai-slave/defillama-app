import { formatUsd, formatCompactNumber, formatNumber, formatPercent } from '~/utils/numberFormat'

export type TooltipGroupBy = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'cumulative'

/** Format a chart value with adaptive precision for axes and labels. */
export function formatChartValue(value: number, symbol: string) {
	if (!Number.isFinite(value)) return String(value)

	const abs = Math.abs(value)
	const applySymbol = (formatted: string) => {
		if (symbol === '$') return `${value < 0 ? '-' : ''}$${formatted.replace(/^-/, '')}`
		return symbol ? `${formatted} ${symbol}` : formatted
	}

	if (abs >= 1000) {
		if (symbol === '%') return formatPercent(value, { input: 'percent', compact: true })
		return applySymbol(formatCompactNumber(value))
	}

	const maximumFractionDigits = abs === 0 ? 0 : abs < 0.001 ? 6 : abs < 10 ? 5 : abs < 100 ? 4 : 2
	if (symbol === '%') return formatPercent(value, { input: 'percent', maximumFractionDigits })
	return applySymbol(
		formatNumber(value, {
			maximumFractionDigits
		})
	)
}

/** Format a numeric value for display in a tooltip. */
export function formatTooltipValue(value: number, symbol: string) {
	switch (symbol) {
		case '$':
			return formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
		case '%':
			return formatPercent(value, { input: 'percent' }).replace('%', ' %')
		default:
			return `${formatCompactNumber(value, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} ${symbol}`
	}
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Format a UTC timestamp for a chart tooltip at the requested temporal grouping. */
export function formatTooltipChartDate(value: number, groupBy: TooltipGroupBy, hideTime?: boolean) {
	const date = new Date(value)

	switch (groupBy) {
		case 'weekly':
			return getStartAndEndDayOfTheWeek(value)
		case 'monthly':
			return `${monthNames[date.getUTCMonth()]} 1 - ${lastDayOfMonth(value)}, ${date.getUTCFullYear()}`
		case 'quarterly':
			return getQuarterDateRange(value)
		case 'yearly':
			return `Jan 1 - Dec 31, ${date.getUTCFullYear()}`
		default:
			if (
				!hideTime &&
				(date.getUTCHours() !== 0 ||
					date.getUTCMinutes() !== 0 ||
					date.getUTCSeconds() !== 0 ||
					date.getUTCMilliseconds() !== 0)
			) {
				return date.toLocaleDateString(undefined, {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
					timeZone: 'UTC'
				})
			}
			return `${date.getUTCDate().toString().padStart(2, '0')} ${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`
	}
}

/** Format a UTC timestamp as the short date used by emphasis labels. */
export function formatChartEmphasisDate(value: number) {
	return new Date(value).toLocaleDateString(undefined, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		timeZone: 'UTC'
	})
}

function getStartAndEndDayOfTheWeek(value: number) {
	const current = new Date(value)
	const past = new Date(value - 6 * 24 * 60 * 60 * 1000)
	const currentMonth = monthNames[current.getUTCMonth()]
	const pastMonth = monthNames[past.getUTCMonth()]
	const currentYear = current.getUTCFullYear()
	const pastYear = past.getUTCFullYear()

	return `${past.getUTCDate().toString().padStart(2, '0')}${pastMonth !== currentMonth ? ` ${pastMonth}` : ''}${
		pastYear !== currentYear ? ` ${pastYear}` : ''
	} - ${current.getUTCDate().toString().padStart(2, '0')} ${currentMonth} ${currentYear}`
}

function lastDayOfMonth(value: number) {
	const date = new Date(value)
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

function getQuarterDateRange(value: number) {
	const date = new Date(value)
	const year = date.getUTCFullYear()
	const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3
	const quarterEndMonth = quarterStartMonth + 2
	const quarterEndDate = new Date(Date.UTC(year, quarterEndMonth + 1, 0)).getUTCDate()

	return `${monthNames[quarterStartMonth]} 1 - ${monthNames[quarterEndMonth]} ${quarterEndDate}, ${year}`
}
