import { escapeHtml } from '../shared/escapeHtml'
import { formatTooltipChartDate, formatTooltipValueHtml, type TooltipGroupBy } from '../shared/formatters'
import {
	type EChartsTooltipItem,
	getTooltipAxisValue,
	getTooltipRawYValue,
	normalizeTooltipItems,
	TOOLTIP_OTHERS_ROW_STYLE,
	TOOLTIP_POINTED_ROW_STYLE
} from '../shared/tooltip'
import { formatAxisLabel } from './multiYAxis'
import type { IMultiSeriesChartProps } from './types'

type GroupBy = NonNullable<IMultiSeriesChartProps['groupBy']>
type TooltipValueRow = readonly [marker: string, name: string, value: number, symbol: string, hasOverride: boolean]

const OTHERS_SERIES_NAME = 'Others'
const TOOLTIP_ROW_STYLE = 'list-style:none;'

type LegacyTooltipRow = { marker: string; name: string; value: number }

// Formatters lead with the stack band under the pointer (`item.pointed`); an Others band keeps its own row.
function renderPointedLegacyRow(row: LegacyTooltipRow, valueSymbol: string) {
	return `<li style="${TOOLTIP_POINTED_ROW_STYLE}">${row.marker}${escapeHtml(row.name)}&nbsp;&nbsp;${formatTooltipValueHtml(row.value, valueSymbol)}</li>`
}

/** Category-axis formatter used by this renderer's object-row datasets. */
export function createCategoryTooltipFormatter(valueSymbol: string) {
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''

		const first = items[0]!
		const category = first.axisValue ?? first.name
		let output = category == null ? '' : `<strong>${escapeHtml(String(category))}</strong><br/>`
		const rows: Array<LegacyTooltipRow> = []
		let pointed: LegacyTooltipRow | null = null
		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (!value || Number.isNaN(value)) continue
			const row = { marker: item.marker ?? '', name, value }
			if (item.pointed && name !== OTHERS_SERIES_NAME) pointed = row
			else rows.push(row)
		}
		rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
		const othersIndex = rows.findIndex((row) => row.name === OTHERS_SERIES_NAME)
		const others = othersIndex >= 0 ? rows.splice(othersIndex, 1)[0] : null
		const limit = (others ? 9 : 10) - (pointed ? 1 : 0)
		if (pointed) output += renderPointedLegacyRow(pointed, valueSymbol)
		for (let index = 0; index < rows.length && index < limit; index++) {
			const row = rows[index]!
			output += `<li style="list-style:none">${row.marker}${escapeHtml(row.name)}&nbsp;&nbsp;${formatTooltipValueHtml(row.value, valueSymbol)}</li>`
		}
		if (others) {
			output += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${others.marker}${escapeHtml(others.name)}&nbsp;&nbsp;${formatTooltipValueHtml(others.value, valueSymbol)}</li>`
		}
		return output
	}
}

/**
 * Preserve the old tuple-series tooltip for dense, high-cardinality breakdowns:
 * omit zero rows, show the largest values, and reconcile the hidden tail as `Others`.
 */
export function createCappedRemainderTooltipFormatter({
	groupBy = 'daily',
	valueSymbol,
	maxItems = 10,
	explicitRemainderLabel = OTHERS_SERIES_NAME
}: {
	groupBy?: TooltipGroupBy
	valueSymbol: string
	maxItems?: number
	/** Set to null when series names are user-defined and `Others` is not reserved. */
	explicitRemainderLabel?: string | null
}) {
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		let output = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''
		const rows: Array<LegacyTooltipRow> = []
		let explicitOthers: LegacyTooltipRow | null = null
		let pointed: LegacyTooltipRow | null = null

		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = rawValue === '-' ? Number.NaN : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (!Number.isFinite(value) || value === 0) continue
			const row = { marker: item.marker ?? '', name, value }
			if (explicitRemainderLabel !== null && name === explicitRemainderLabel) explicitOthers = row
			else if (item.pointed) pointed = row
			else rows.push(row)
		}

		rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
		const rowLimit = maxItems - (pointed ? 1 : 0)
		const hasRemainder = explicitOthers != null || rows.length > rowLimit
		const visibleLimit = hasRemainder ? Math.max(0, rowLimit - 1) : rowLimit
		if (pointed) output += renderPointedLegacyRow(pointed, valueSymbol)
		for (let index = 0; index < rows.length && index < visibleLimit; index++) {
			const row = rows[index]!
			output += `<li style="list-style:none">${row.marker}${escapeHtml(row.name)}&nbsp;&nbsp;${formatTooltipValueHtml(row.value, valueSymbol)}</li>`
		}

		if (hasRemainder) {
			let remainder = explicitOthers?.value ?? 0
			for (let index = visibleLimit; index < rows.length; index++) remainder += rows[index]!.value
			output += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${explicitOthers?.marker ?? rows[visibleLimit]?.marker ?? ''}${OTHERS_SERIES_NAME}&nbsp;&nbsp;${formatTooltipValueHtml(remainder, valueSymbol)}</li>`
		}

		return output
	}
}

/** Compact formatter for charts whose only series label would repeat the chart title. */
export function createSingleSeriesTooltipFormatter(valueSymbol: string, groupBy: TooltipGroupBy = 'daily') {
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		const chartdate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''
		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (rawValue === '-' || !value || Number.isNaN(value)) continue
			return `${chartdate}<li style="list-style:none">${item.marker ?? ''}&nbsp;&nbsp;${formatTooltipValueHtml(value, valueSymbol)}</li>`
		}
		return chartdate
	}
}

/** Top-N inflow formatter used by MultiSeriesChart callers with large breakdowns. */
export function createInflowsTooltipFormatter({
	groupBy = 'daily',
	valueSymbol,
	topN = 10,
	othersLabel = OTHERS_SERIES_NAME,
	totalLabel = 'Total Inflows'
}: {
	groupBy?: TooltipGroupBy
	valueSymbol: string
	topN?: number
	othersLabel?: string
	totalLabel?: string
}) {
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		const chartdate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''
		const topValues: Array<LegacyTooltipRow> = []
		let total = 0
		let regularCount = 0
		let explicitOthers: LegacyTooltipRow | null = null
		let pointed: LegacyTooltipRow | null = null

		for (const item of items) {
			const name = item.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value =
				rawValue == null || rawValue === '-' ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (value == null || Number.isNaN(value) || value === 0) continue

			total += value
			if (name === othersLabel) {
				explicitOthers = { marker: item.marker ?? '', name, value }
				continue
			}
			regularCount++
			if (item.pointed) {
				pointed = { marker: item.marker ?? '', name, value }
				continue
			}
			if (topN <= 0) continue

			const absoluteValue = Math.abs(value)
			if (topValues.length < topN || absoluteValue > Math.abs(topValues[0]!.value)) {
				topValues.push({ marker: item.marker ?? '', name, value })
				let index = topValues.length - 1
				while (index > 0 && Math.abs(topValues[index - 1]!.value) > Math.abs(topValues[index]!.value)) {
					const previous = topValues[index - 1]!
					topValues[index - 1] = topValues[index]!
					topValues[index] = previous
					index--
				}
				if (topValues.length > topN) topValues.shift()
			}
		}

		if (regularCount === 0 && !explicitOthers) return chartdate
		const single = pointed ?? topValues[0]
		if (regularCount === 1 && !explicitOthers && single) {
			const row = single
			return `${chartdate}<li style="list-style:none">${row.marker}${escapeHtml(row.name)}&nbsp;&nbsp;${formatTooltipValueHtml(row.value, valueSymbol)}</li>`
		}

		let selectedSum = pointed?.value ?? 0
		for (const row of topValues) selectedSum += row.value
		let others = total - selectedSum
		if (Math.abs(others) < 1e-8) others = 0

		let output = chartdate
		output += `<li style="list-style:none;font-weight:600">${escapeHtml(totalLabel)}&nbsp;&nbsp;${formatTooltipValueHtml(total, valueSymbol)}</li>`
		if (pointed) output += renderPointedLegacyRow(pointed, valueSymbol)
		for (let index = topValues.length - 1; index >= 0; index--) {
			const row = topValues[index]!
			output += `<li style="list-style:none">${row.marker}${escapeHtml(row.name)}&nbsp;&nbsp;${formatTooltipValueHtml(row.value, valueSymbol)}</li>`
		}
		if (others !== 0) {
			output += `<li style="${TOOLTIP_OTHERS_ROW_STYLE}">${explicitOthers?.marker ?? ''}${escapeHtml(othersLabel)}&nbsp;&nbsp;${formatTooltipValueHtml(others, valueSymbol)}</li>`
		}
		return output
	}
}

function compareTooltipRows(a: TooltipValueRow, b: TooltipValueRow) {
	if (a[4] !== b[4]) return a[4] ? -1 : 1
	return b[2] - a[2]
}

function insertTopTooltipValue(rows: Array<TooltipValueRow>, nextRow: TooltipValueRow, limit: number) {
	if (!Number.isFinite(limit) || limit <= 0) return

	let insertAt = rows.length
	for (let i = 0; i < rows.length; i++) {
		if (rows[i]![2] < nextRow[2]) {
			insertAt = i
			break
		}
	}

	if (insertAt === rows.length) {
		if (rows.length < limit) rows.push(nextRow)
		return
	}

	rows.splice(insertAt, 0, nextRow)
	if (rows.length > limit) rows.pop()
}

function renderTooltipRow(row: TooltipValueRow, style: string) {
	return `<li style="${style}">${row[0]} ${escapeHtml(row[1])}: ${escapeHtml(formatAxisLabel(row[2], row[3]))}</li>`
}

/** The stacked series whose band holds `pointerValue` on the y-axis: positive values stack up from zero and negative
   values down, each in series order, as ECharts draws them. */
export function findPointedStackSeries(
	items: ReadonlyArray<EChartsTooltipItem>,
	stackedSeries: ReadonlySet<string>,
	pointerValue: number
): string | null {
	const above = pointerValue >= 0
	let edge = 0
	for (const item of items) {
		const name = item.seriesName
		if (!name || !stackedSeries.has(name)) continue
		const value = Number(getTooltipRawYValue(item, name))
		// Zero, null and '-' draw no band; NaN is falsy too.
		if (!value || value > 0 !== above) continue
		edge += value
		if (above ? pointerValue < edge : pointerValue > edge) return name
	}
	return null
}

// A line further than this from the pointer is not the one being pointed at.
const NEAREST_LINE_PX = 12

/** The line whose value at the hovered date is nearest the pointer, in pixels so lines on different axes compare. */
export function findNearestLineSeries(
	items: ReadonlyArray<EChartsTooltipItem>,
	lineAxes: ReadonlyMap<string, number>,
	toPixel: (yAxisIndex: number, value: number) => number,
	pointerY: number
): string | null {
	let nearest: string | null = null
	let nearestDistance = NEAREST_LINE_PX
	for (const item of items) {
		const name = item.seriesName
		const yAxisIndex = name == null ? undefined : lineAxes.get(name)
		if (yAxisIndex === undefined) continue
		const raw = getTooltipRawYValue(item, name!)
		// Null and '-' cells draw no point here.
		if (raw == null || raw === '-') continue
		const distance = Math.abs(toPixel(yAxisIndex, Number(raw)) - pointerY)
		if (distance < nearestDistance) {
			nearest = name!
			nearestDistance = distance
		}
	}
	return nearest
}

export function createTooltipFormatter({
	groupBy,
	valueSymbol,
	seriesSymbols,
	tooltipTotalExcludedSeries,
	maxItems,
	showTotalInTooltip,
	requireCompleteTooltipTotal
}: {
	groupBy: GroupBy
	valueSymbol: string
	seriesSymbols?: Map<string, string> | undefined
	tooltipTotalExcludedSeries?: Set<string> | undefined
	maxItems?: number | undefined
	showTotalInTooltip?: boolean | undefined
	requireCompleteTooltipTotal?: boolean | undefined
}) {
	return (params: unknown) => {
		const items = normalizeTooltipItems(params)
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		const chartdate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''
		const cap = maxItems ?? 30
		const shouldCap = Number.isFinite(cap) && cap > 0
		let total = 0
		let regularCount = 0
		let standardCount = 0
		let hasUnavailableStandardValue = false
		const vals: Array<TooltipValueRow> = []
		const topOverrideVals: Array<TooltipValueRow> = []
		const topStandardVals: Array<TooltipValueRow> = []
		let othersRow: TooltipValueRow | null = null
		let pointedRow: TooltipValueRow | null = null

		for (const item of items) {
			const name = item?.seriesName
			if (!name) continue

			const hasOverride = seriesSymbols?.has(name) ?? false
			const excludeFromTotal = hasOverride || (tooltipTotalExcludedSeries?.has(name) ?? false)
			const rawValue = getTooltipRawYValue(item, name)
			const value =
				rawValue == null || rawValue === '-' ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (value == null || Number.isNaN(value)) {
				if (requireCompleteTooltipTotal && !excludeFromTotal) hasUnavailableStandardValue = true
				continue
			}

			const nextRow = [item.marker ?? '', name, value, seriesSymbols?.get(name) ?? valueSymbol, hasOverride] as const

			if (!excludeFromTotal) {
				total += value
				standardCount += 1
			}

			// The band under the pointer leads, even when its value would fall in "+N more".
			if (item.pointed && name !== OTHERS_SERIES_NAME) {
				pointedRow = nextRow
				continue
			}

			if (name === OTHERS_SERIES_NAME) {
				othersRow = nextRow
				continue
			}

			regularCount += 1
			if (!shouldCap) {
				vals.push(nextRow)
				continue
			}

			insertTopTooltipValue(hasOverride ? topOverrideVals : topStandardVals, nextRow, cap)
		}

		if (!shouldCap) vals.sort(compareTooltipRows)

		const rowLimit = shouldCap ? Math.max(0, cap - (othersRow ? 1 : 0) - (pointedRow ? 1 : 0)) : 0
		const cappedVals = shouldCap
			? topOverrideVals.length >= rowLimit
				? topOverrideVals.slice(0, rowLimit)
				: [...topOverrideVals, ...topStandardVals.slice(0, Math.max(0, rowLimit - topOverrideVals.length))]
			: vals
		const remaining = shouldCap ? Math.max(0, regularCount - cappedVals.length) : 0
		const totalLine =
			showTotalInTooltip && standardCount > 0 && !hasUnavailableStandardValue
				? `<li style="list-style:none;font-weight:600;">Total: ${formatAxisLabel(total, valueSymbol)}</li>`
				: ''
		let valueLines = ''
		for (const row of cappedVals) valueLines += renderTooltipRow(row, TOOLTIP_ROW_STYLE)
		const remainingLine = remaining > 0 ? `<li style="list-style:none;opacity:0.7;">+${remaining} more</li>` : ''
		const othersLine = othersRow
			? renderTooltipRow(
					othersRow,
					totalLine.length > 0 || pointedRow || valueLines.length > 0 || remainingLine.length > 0
						? TOOLTIP_OTHERS_ROW_STYLE
						: TOOLTIP_ROW_STYLE
				)
			: ''
		const pointedLine = pointedRow
			? renderTooltipRow(
					pointedRow,
					valueLines.length > 0 || remainingLine.length > 0 || othersLine.length > 0
						? TOOLTIP_POINTED_ROW_STYLE
						: TOOLTIP_ROW_STYLE
				)
			: ''

		return chartdate + totalLine + pointedLine + valueLines + remainingLine + othersLine
	}
}
