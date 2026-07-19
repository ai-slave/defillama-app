/**
 * Chart formatting utilities.
 * These functions don't depend on echarts and can be safely imported
 * without pulling echarts into the bundle.
 */
import { formattedNum } from '~/utils'
export const TOOLTIP_OTHERS_ROW_STYLE =
	'list-style:none;margin-top:6px;padding-top:6px;border-top:1px solid rgba(128,128,128,0.3);'

export type TooltipGroupBy = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'cumulative'

type TooltipRow = { marker: string; name: string; value: number }

/** Preserve the legacy category-axis tooltip header while using object-row datasets. */
export function createCategoryTooltipFormatter(valueSymbol: string) {
	return (params: any) => {
		const items = Array.isArray(params) ? params : params ? [params] : []
		if (items.length === 0) return ''

		const category = items[0]?.axisValueLabel ?? items[0]?.axisValue ?? items[0]?.name
		let output = category == null ? '' : `<strong>${category}</strong><br/>`
		const rows: TooltipRow[] = []
		for (const item of items) {
			const name = item?.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (!value || Number.isNaN(value)) continue
			rows.push({ marker: item?.marker ?? '', name, value })
		}
		rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
		const othersIndex = rows.findIndex((row) => row.name === 'Others')
		const others = othersIndex >= 0 ? rows.splice(othersIndex, 1)[0] : null
		const limit = others ? 9 : 10
		for (let index = 0; index < rows.length && index < limit; index++) {
			const row = rows[index]
			output += `<li style="list-style:none">${row.marker}${row.name}&nbsp;&nbsp;${formatTooltipValue(row.value, valueSymbol)}</li>`
		}
		if (others) {
			output += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${others.marker}${others.name}&nbsp;&nbsp;${formatTooltipValue(others.value, valueSymbol)}</li>`
		}
		return output
	}
}

/** Type guard that narrows `value` to a plain object (excludes arrays and nulls). */
export function isTooltipDataRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Return a narrowed record without copying the dense row on every tooltip item. */
export function asTooltipDataRecord(value: unknown): Record<string, unknown> | null {
	if (!isTooltipDataRecord(value)) return null
	return value
}

/**
 * Extract the x-axis timestamp (in ms) from the first ECharts tooltip param.
 * Handles multiple data shapes: object-row datasets with a `timestamp` field,
 * `[ts, y]` value arrays, nested value objects, and raw `axisValue` strings/numbers.
 * @returns The resolved timestamp, or `NaN` if none could be determined.
 */
export function getTooltipAxisValue(first: any): number {
	const dataObj = asTooltipDataRecord(first?.data)
	if (dataObj && 'timestamp' in dataObj) {
		const ts = Number(dataObj.timestamp)
		if (Number.isFinite(ts)) return ts
	}

	const arrayValue = Array.isArray(first?.data) ? first.data : Array.isArray(first?.value) ? first.value : null
	if (arrayValue) {
		const xDimensionIndex = first?.encode?.x?.[0]
		const ts = Number(arrayValue[typeof xDimensionIndex === 'number' ? xDimensionIndex : 0])
		if (Number.isFinite(ts)) return ts
	}

	if (first?.value && typeof first.value === 'object' && 'timestamp' in first.value) {
		const ts = Number(first.value.timestamp)
		if (Number.isFinite(ts)) return ts
	}

	if (typeof first?.axisValue === 'number') return first.axisValue

	const axisValue = first?.axisValue
	if (axisValue == null) return Number.NaN
	const numeric = Number(axisValue)
	if (Number.isFinite(numeric)) return numeric
	const parsed = Date.parse(String(axisValue))
	return Number.isFinite(parsed) ? parsed : Number.NaN
}

/**
 * Extract the raw y-value for a named series from an ECharts tooltip item.
 * Tries encoded object/array dimensions first, then the display series name,
 * `[timestamp, value]`, and finally the bare `value` property.
 */
export function getTooltipRawYValue(item: any, seriesName: string): any {
	const dataObj = asTooltipDataRecord(item?.data)
	const yDimensionIndex = item?.encode?.y?.[0]
	const arrayValue = Array.isArray(item?.data) ? item.data : Array.isArray(item?.value) ? item.value : null
	if (arrayValue && typeof yDimensionIndex === 'number') return arrayValue[yDimensionIndex]

	const yDimensionName = yDimensionIndex != null ? item?.dimensionNames?.[yDimensionIndex] : undefined
	if (dataObj && yDimensionName != null && yDimensionName in dataObj) return dataObj[yDimensionName]

	// Object-row dataset without encode metadata.
	if (dataObj && seriesName in dataObj) return dataObj[seriesName]

	// Conventional two-column tuple fallback.
	if (Array.isArray(item?.value)) return item.value[1]

	// Final fallback: direct value.
	return item?.value
}

/** Compact formatter for charts whose only series label would repeat the chart title. */
export function createSingleSeriesTooltipFormatter(valueSymbol: string) {
	return (params: any) => {
		const items = Array.isArray(params) ? params : params ? [params] : []
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		const chartdate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, 'daily') : ''
		for (const item of items) {
			const name = item?.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (rawValue === '-' || !value || Number.isNaN(value)) continue
			return `${chartdate}<li style="list-style:none">${item?.marker ?? ''}&nbsp;&nbsp;${formatTooltipValue(value, valueSymbol)}</li>`
		}
		return chartdate
	}
}

/** Signed-flow tooltip: net total first, losses before gains, and a separated remainder last. */
export function createSignedInflowsTooltipFormatter(valueSymbol: string, hideSeriesName = false) {
	return (params: any) => {
		const items = Array.isArray(params) ? params : params ? [params] : []
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		let output = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, 'daily') : ''
		const rows: TooltipRow[] = []
		let explicitOthers: TooltipRow | null = null
		let total = 0
		for (const item of items) {
			const name = item?.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (rawValue === '-' || Number.isNaN(value)) continue
			const row = { marker: item?.marker ?? '', name, value }
			total += value
			if (name === 'Others') {
				explicitOthers = row
			} else if (rows.length < 10 || value < rows[rows.length - 1].value) {
				let insertAt = rows.length
				while (insertAt > 0 && rows[insertAt - 1].value > value) insertAt--
				rows.splice(insertAt, 0, row)
				if (rows.length > 10) rows.pop()
			}
		}

		output += `<li style="list-style:none;font-weight:600">Total Inflows&nbsp;&nbsp;${formatTooltipValue(total, valueSymbol)}</li>`

		let selectedSum = 0
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i]
			selectedSum += row.value
			if (row.value === 0) continue
			output += `<li style="list-style:none">${row.marker}${hideSeriesName ? '' : row.name}&nbsp;&nbsp;${formatTooltipValue(row.value, valueSymbol)}</li>`
		}

		let others = total - selectedSum
		if (Math.abs(others) < 1e-8) others = 0
		if (others !== 0) {
			output += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${explicitOthers?.marker ?? ''}Others&nbsp;&nbsp;${formatTooltipValue(others, valueSymbol)}</li>`
		}
		return output
	}
}

/**
 * Factory that returns an ECharts tooltip formatter optimised for inflow/outflow charts.
 * Only the top-N series (ranked by absolute value) are shown individually; the rest are
 * collapsed into a separated "Others" row at the bottom.
 *
 * @param groupBy - Date grouping used to format the header date.
 * @param valueSymbol - Unit symbol (`'$'`, `'%'`, etc.) passed to {@link formatTooltipValue}.
 * @param topN - Maximum number of individual series rows to display.
 * @param othersLabel - Label for the aggregated remainder row.
 * @param totalLabel - Label for the sum-total row.
 */
export function createInflowsTooltipFormatter({
	groupBy = 'daily',
	valueSymbol,
	topN = 10,
	othersLabel = 'Others',
	totalLabel = 'Total Inflows'
}: {
	groupBy?: TooltipGroupBy
	valueSymbol: string
	topN?: number
	othersLabel?: string
	totalLabel?: string
}) {
	return (params: any) => {
		const items = Array.isArray(params) ? params : params ? [params] : []
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		const chartdate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''

		// Keep top-N by absolute value, stored ASC by abs (trim from front; render reversed).
		const topAbs: TooltipRow[] = []

		let total = 0
		let regularCount = 0
		let explicitOthers: TooltipRow | null = null

		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			const name = item?.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value =
				rawValue == null || rawValue === '-' ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (value == null || Number.isNaN(value) || value === 0) continue

			total += value
			if (name === othersLabel) {
				explicitOthers = { marker: item?.marker ?? '', name, value }
				continue
			}
			regularCount++

			if (topN <= 0) continue

			const absValue = Math.abs(value)
			const minAbs = topAbs.length > 0 ? Math.abs(topAbs[0].value) : 0
			if (topAbs.length < topN || absValue > minAbs) {
				const row: TooltipRow = { marker: item?.marker ?? '', name, value }
				// Insert sorted by abs(value) ASC
				topAbs.push(row)
				let j = topAbs.length - 1
				while (j > 0 && Math.abs(topAbs[j - 1].value) > Math.abs(topAbs[j].value)) {
					const tmp = topAbs[j - 1]
					topAbs[j - 1] = topAbs[j]
					topAbs[j] = tmp
					j--
				}
				if (topAbs.length > topN) topAbs.shift()
			}
		}

		// For a true single-series chart, "Others" and "Total" would repeat the same value.
		if (regularCount === 0 && !explicitOthers) return chartdate
		if (regularCount === 1 && !explicitOthers && topAbs.length === 1) {
			const curr = topAbs[0]
			return (
				chartdate +
				`<li style="list-style:none">${curr.marker}${curr.name}&nbsp;&nbsp;${formatTooltipValue(curr.value, valueSymbol)}</li>`
			)
		}

		let selectedSum = 0
		for (const row of topAbs) selectedSum += row.value

		let others = total - selectedSum
		// Guard against floating-point epsilons creating a stray "Others" row.
		const EPSILON = 1e-8
		if (Math.abs(others) < EPSILON) others = 0

		let vals = `<li style="list-style:none;font-weight:600">${totalLabel}&nbsp;&nbsp;${formatTooltipValue(total, valueSymbol)}</li>`

		// topAbs is ASC by abs; render it DESC by abs.
		for (let i = topAbs.length - 1; i >= 0; i--) {
			const curr = topAbs[i]
			vals += `<li style="list-style:none">${curr.marker}${curr.name}&nbsp;&nbsp;${formatTooltipValue(curr.value, valueSymbol)}</li>`
		}

		if (others !== 0) {
			vals += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${explicitOthers?.marker ?? ''}${othersLabel}&nbsp;&nbsp;${formatTooltipValue(others, valueSymbol)}</li>`
		}

		return chartdate + vals
	}
}

/**
 * Factory that returns an ECharts tooltip formatter showing all non-zero series
 * sorted by absolute value (descending) with a bolded total row at the top.
 *
 * @param groupBy - Date grouping used to format the header date.
 * @param valueSymbol - Unit symbol (`'$'`, `'%'`, etc.) passed to {@link formatTooltipValue}.
 * @param totalLabel - Label for the sum-total row.
 */
export function createAggregateTooltipFormatter({
	groupBy = 'daily',
	valueSymbol,
	totalLabel = 'Total'
}: {
	groupBy?: TooltipGroupBy
	valueSymbol: string
	totalLabel?: string
}) {
	return (params: any) => {
		const items = Array.isArray(params) ? params : params ? [params] : []
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		const chartdate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''

		const parsed = items
			.map((item: any) => {
				const name = item?.seriesName
				if (!name) return null
				const rawValue = getTooltipRawYValue(item, name)
				const value =
					rawValue == null || rawValue === '-' ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
				if (value == null || Number.isNaN(value) || value === 0) return null
				return { marker: item?.marker ?? '', name, value }
			})
			.filter(Boolean) as Array<{ marker: string; name: string; value: number }>

		parsed.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
		const total = parsed.reduce((acc, curr) => acc + curr.value, 0)
		const othersIndex = parsed.findIndex((row) => row.name === 'Others')
		const others = othersIndex >= 0 ? parsed.splice(othersIndex, 1)[0] : null

		const vals = parsed.reduce(
			(prev, curr) =>
				prev +
				`<li style="list-style:none">${curr.marker}${curr.name}&nbsp;&nbsp;${formatTooltipValue(curr.value, valueSymbol)}</li>`,
			''
		)
		const totalLine = `<li style="list-style:none;font-weight:600">${totalLabel}&nbsp;&nbsp;${formatTooltipValue(total, valueSymbol)}</li>`

		const othersLine = others
			? `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${others.marker}${others.name}&nbsp;&nbsp;${formatTooltipValue(others.value, valueSymbol)}</li>`
			: ''

		return chartdate + totalLine + vals + othersLine
	}
}

/**
 * Format chart values using LlamaAI's adaptive precision rules.
 * Large values switch to compact notation, while smaller values gain precision
 * as their magnitude decreases so axis labels and tooltips stay readable.
 */
export const formatChartValue = (value: number, symbol: string) => {
	if (value == null || !Number.isFinite(value)) return String(value ?? '')

	const abs = Math.abs(value)

	const applySymbol = (formatted: string) => {
		if (symbol === '$') return `${value < 0 ? '-' : ''}$${formatted.replace(/^-/, '')}`
		if (symbol === '%') return `${formatted}%`
		return symbol ? `${formatted} ${symbol}` : formatted
	}

	if (abs >= 1000) {
		return applySymbol(
			value.toLocaleString('en-US', {
				notation: 'compact',
				compactDisplay: 'short',
				maximumFractionDigits: 2
			})
		)
	}

	let maxDecimals: number
	if (abs === 0) maxDecimals = 0
	else if (abs < 0.001) maxDecimals = 6
	else if (abs < 10) maxDecimals = 5
	else if (abs < 100) maxDecimals = 4
	else maxDecimals = 2

	return applySymbol(
		value.toLocaleString('en-US', {
			maximumFractionDigits: maxDecimals,
			minimumFractionDigits: 0
		})
	)
}

/**
 * Format a numeric value for display in a tooltip, applying the appropriate unit.
 * `'$'` uses abbreviated currency formatting, `'%'` rounds to two decimals,
 * and any other symbol is appended after a formatted number.
 */
export const formatTooltipValue = (value: number, symbol: string) => {
	switch (symbol) {
		case '$':
			return formattedNum(value, true)
		case '%':
			return `${Math.round(value * 100) / 100} %`
		default:
			return `${formattedNum(value)} ${symbol}`
	}
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Format a timestamp (in ms) as a human-readable date string for chart tooltips.
 * The output format varies by `groupBy`:
 * - `'weekly'`    → `"DD MMM - DD MMM YYYY"` (Mon–Sun range)
 * - `'monthly'`   → `"MMM 1 - lastDay, YYYY"`
 * - `'quarterly'` → `"MMM 1 - MMM lastDay, YYYY"`
 * - `'yearly'`    → `"Jan 1 - Dec 31, YYYY"`
 * - `'daily'` / `'cumulative'` → `"DD MMM YYYY"` (with time if intraday and `hideTime` is false)
 *
 * @param value - Timestamp in milliseconds.
 * @param groupBy - Temporal grouping that determines the date format.
 * @param hideTime - When true, suppresses the time portion for intraday daily timestamps.
 */
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
		default: {
			// daily , cumulative
			if (date.getUTCHours() !== 0 && !hideTime) {
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
}

/**
 * Format a timestamp (in ms) as a short locale date string (`MM/DD/YYYY` in most locales)
 * for use in chart emphasis/highlight labels.
 */
export function formatChartEmphasisDate(value: number) {
	const date = new Date(value)
	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		timeZone: 'UTC'
	})
}

/**
 * Format a 7-day range string from a week-ending timestamp.
 * Cross-month and cross-year boundaries are handled by conditionally including
 * the month/year on the start date only when they differ from the end date.
 * @param value - Timestamp (ms) of the last day (Sunday) of the week.
 */
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

/** @returns The last calendar day (1–31) of the month containing the given timestamp. */
function lastDayOfMonth(dateString: number) {
	const date = new Date(dateString)

	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

/**
 * Format a fiscal-quarter date range string (e.g. `"Jan 1 - Mar 31, 2024"`)
 * from a timestamp falling anywhere within that quarter.
 */
function getQuarterDateRange(value: number) {
	const date = new Date(value)
	const month = date.getUTCMonth()
	const year = date.getUTCFullYear()
	const quarterStartMonth = Math.floor(month / 3) * 3
	const quarterEndMonth = quarterStartMonth + 2

	const quarterEndDate = new Date(Date.UTC(year, quarterEndMonth + 1, 0)).getUTCDate()

	return `${monthNames[quarterStartMonth]} 1 - ${monthNames[quarterEndMonth]} ${quarterEndDate}, ${year}`
}
