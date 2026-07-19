import {
	formatTooltipChartDate,
	getTooltipAxisValue,
	getTooltipRawYValue,
	TOOLTIP_OTHERS_ROW_STYLE
} from '../formatters'
import type { IMultiSeriesChart2Props } from '../types'
import { formatAxisLabel } from './multiYAxis'

type GroupBy = NonNullable<IMultiSeriesChart2Props['groupBy']>
type TooltipValueRow = readonly [marker: string, name: string, value: number, symbol: string, hasOverride: boolean]

const OTHERS_SERIES_NAME = 'Others'

function compareTooltipRows(a: TooltipValueRow, b: TooltipValueRow) {
	if (a[4] !== b[4]) return a[4] ? -1 : 1
	return b[2] - a[2]
}

function insertTopTooltipValue(rows: TooltipValueRow[], nextRow: TooltipValueRow, limit: number) {
	if (!Number.isFinite(limit) || limit <= 0) return

	let insertAt = rows.length
	for (let i = 0; i < rows.length; i++) {
		if (rows[i][2] < nextRow[2]) {
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

function renderTooltipRow(row: TooltipValueRow, separated = false) {
	const style = separated ? TOOLTIP_OTHERS_ROW_STYLE : 'list-style:none;'
	return `<li style="${style}">${row[0]} ${row[1]}: ${formatAxisLabel(row[2], row[3])}</li>`
}

export function createTooltipFormatter({
	groupBy,
	valueSymbol,
	seriesSymbols,
	tooltipTotalExcludedSeries,
	maxItems,
	showTotalInTooltip
}: {
	groupBy: GroupBy
	valueSymbol: string
	seriesSymbols?: Map<string, string>
	tooltipTotalExcludedSeries?: Set<string>
	maxItems?: number
	showTotalInTooltip?: boolean
}) {
	return (params: any) => {
		const items = Array.isArray(params) ? params : params ? [params] : []
		if (items.length === 0) return ''

		const axisValue = getTooltipAxisValue(items[0])
		const chartdate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''
		const cap = maxItems ?? 30
		const shouldCap = Number.isFinite(cap) && cap > 0
		let total = 0
		let regularCount = 0
		let standardCount = 0
		const vals: TooltipValueRow[] = []
		const topOverrideVals: TooltipValueRow[] = []
		const topStandardVals: TooltipValueRow[] = []
		let othersRow: TooltipValueRow | null = null

		for (const item of items) {
			const name = item?.seriesName
			if (!name) continue

			const rawValue = getTooltipRawYValue(item, name)
			const value =
				rawValue == null || rawValue === '-' ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (value == null || Number.isNaN(value)) continue

			const hasOverride = seriesSymbols?.has(name) ?? false
			const excludeFromTotal = hasOverride || (tooltipTotalExcludedSeries?.has(name) ?? false)
			const nextRow = [item.marker ?? '', name, value, seriesSymbols?.get(name) ?? valueSymbol, hasOverride] as const

			if (!excludeFromTotal) {
				total += value
				standardCount += 1
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

		const rowLimit = shouldCap ? Math.max(0, cap - (othersRow ? 1 : 0)) : 0
		const cappedVals = shouldCap
			? topOverrideVals.length >= rowLimit
				? topOverrideVals.slice(0, rowLimit)
				: [...topOverrideVals, ...topStandardVals.slice(0, Math.max(0, rowLimit - topOverrideVals.length))]
			: vals
		const remaining = shouldCap ? Math.max(0, regularCount - cappedVals.length) : 0
		const totalLine =
			showTotalInTooltip && standardCount > 0
				? `<li style="list-style:none;font-weight:600;">Total: ${formatAxisLabel(total, valueSymbol)}</li>`
				: ''
		let valueLines = ''
		for (const row of cappedVals) valueLines += renderTooltipRow(row)
		const remainingLine = remaining > 0 ? `<li style="list-style:none;opacity:0.7;">+${remaining} more</li>` : ''
		const othersLine = othersRow
			? renderTooltipRow(othersRow, totalLine.length > 0 || valueLines.length > 0 || remainingLine.length > 0)
			: ''

		return chartdate + totalLine + valueLines + remainingLine + othersLine
	}
}
