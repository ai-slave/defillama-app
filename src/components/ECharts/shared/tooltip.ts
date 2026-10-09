import { escapeHtml } from './escapeHtml'
import { formatTooltipChartDate, formatTooltipValueHtml } from './formatters'

export const TOOLTIP_OTHERS_ROW_STYLE =
	'list-style:none;margin-top:6px;padding-top:6px;border-top:1px solid rgba(128,128,128,0.3);'
/** The stack band under the pointer leads the list, set off below as the Others row is set off above. */
export const TOOLTIP_POINTED_ROW_STYLE =
	'list-style:none;font-weight:600;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(128,128,128,0.3);'

export interface EChartsTooltipItem {
	axisValue?: unknown
	componentSubType?: string
	data?: unknown
	dataIndex?: number
	dimensionNames?: ReadonlyArray<string>
	encode?: { x?: ReadonlyArray<number | string>; y?: ReadonlyArray<number | string> }
	marker?: string
	name?: string
	seriesName?: string
	seriesIndex?: number
	value?: unknown
	/** Set by MultiSeriesChart on the stack band under the pointer; formatters list that series first. */
	pointed?: boolean
}

type TooltipRow = { marker: string; name: string; value: number }

function isEChartsTooltipItem(value: unknown): value is EChartsTooltipItem {
	return value !== null && typeof value === 'object'
}

/**
 * The series MultiSeriesChart flagged under the pointer, for a formatter to list first. Others is the remainder and
 * keeps its own row, so it is never the pointed series.
 */
export function getPointedSeriesName(items: ReadonlyArray<EChartsTooltipItem>): string | null {
	for (const item of items) {
		if (item.pointed && item.seriesName && item.seriesName !== 'Others') return item.seriesName
	}
	return null
}

export function normalizeTooltipItems(params: unknown): Array<EChartsTooltipItem> {
	if (Array.isArray(params)) return params.filter(isEChartsTooltipItem)
	return isEChartsTooltipItem(params) ? [params] : []
}

export function isTooltipDataRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function asTooltipDataRecord(value: unknown): Record<string, unknown> | null {
	return isTooltipDataRecord(value) ? value : null
}

/** Resolve an x-axis timestamp from the object-row and positional shapes emitted by ECharts. */
export function getTooltipAxisValue(first: EChartsTooltipItem | undefined): number {
	const data = asTooltipDataRecord(first?.data)
	if (data && Object.hasOwn(data, 'timestamp')) {
		const timestamp = Number(data.timestamp)
		if (Number.isFinite(timestamp)) return timestamp
	}

	const values = Array.isArray(first?.data) ? first.data : Array.isArray(first?.value) ? first.value : null
	if (values) {
		const encodedX = first?.encode?.x?.[0]
		const timestamp = Number(values[typeof encodedX === 'number' ? encodedX : 0])
		if (Number.isFinite(timestamp)) return timestamp
	}

	const value = asTooltipDataRecord(first?.value)
	if (value && Object.hasOwn(value, 'timestamp')) {
		const timestamp = Number(value.timestamp)
		if (Number.isFinite(timestamp)) return timestamp
	}

	if (typeof first?.axisValue === 'number') return first.axisValue
	if (first?.axisValue == null) return Number.NaN
	const numeric = Number(first.axisValue)
	if (Number.isFinite(numeric)) return numeric
	const parsed = Date.parse(String(first.axisValue))
	return Number.isFinite(parsed) ? parsed : Number.NaN
}

/** Read the raw y-value for a series from object-row or positional ECharts tooltip data. */
export function getTooltipRawYValue(item: EChartsTooltipItem | undefined, seriesName: string): unknown {
	const data = asTooltipDataRecord(item?.data)
	const encodedY = item?.encode?.y?.[0]
	const values = Array.isArray(item?.data) ? item.data : Array.isArray(item?.value) ? item.value : null
	if (values && typeof encodedY === 'number') return values[encodedY]

	const dimensionName = typeof encodedY === 'number' ? item?.dimensionNames?.[encodedY] : encodedY
	if (data && dimensionName != null && Object.hasOwn(data, dimensionName)) return data[dimensionName]
	if (data && Object.hasOwn(data, seriesName)) return data[seriesName]
	if (Array.isArray(item?.value)) return item.value[1]
	return item?.value
}

/** Signed-flow tooltip: net total first, losses before gains, and a separated remainder last. */
export function createSignedInflowsTooltipFormatter(valueSymbol: string, hideSeriesName = false) {
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		let output = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, 'daily') : ''
		const rows: Array<TooltipRow> = []
		let explicitOthers: TooltipRow | null = null
		let pointed: TooltipRow | null = null
		let total = 0
		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (rawValue === '-' || Number.isNaN(value)) continue
			const row = { marker: item.marker ?? '', name, value }
			total += value
			if (name === 'Others') {
				explicitOthers = row
			} else if (item.pointed) {
				// The stack band under the pointer leads, even past the ten rows.
				pointed = row
			} else if (rows.length < 10 || value < rows[rows.length - 1]!.value) {
				let insertAt = rows.length
				while (insertAt > 0 && rows[insertAt - 1]!.value > value) insertAt--
				rows.splice(insertAt, 0, row)
				if (rows.length > 10) rows.pop()
			}
		}

		output += `<li style="list-style:none;font-weight:600">Total Inflows&nbsp;&nbsp;${formatTooltipValueHtml(total, valueSymbol)}</li>`
		if (pointed) {
			output += `<li style="${TOOLTIP_POINTED_ROW_STYLE}">${pointed.marker}${hideSeriesName ? '' : escapeHtml(pointed.name)}&nbsp;&nbsp;${formatTooltipValueHtml(pointed.value, valueSymbol)}</li>`
		}
		let selectedSum = pointed?.value ?? 0
		for (const row of rows) {
			selectedSum += row.value
			if (row.value === 0) continue
			output += `<li style="list-style:none">${row.marker}${hideSeriesName ? '' : escapeHtml(row.name)}&nbsp;&nbsp;${formatTooltipValueHtml(row.value, valueSymbol)}</li>`
		}

		let others = total - selectedSum
		if (Math.abs(others) < 1e-8) others = 0
		if (others !== 0) {
			output += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${explicitOthers?.marker ?? ''}Others&nbsp;&nbsp;${formatTooltipValueHtml(others, valueSymbol)}</li>`
		}
		return output
	}
}
