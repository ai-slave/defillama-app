import {
	formatTooltipChartDate,
	formatTooltipValue,
	getTooltipAxisValue,
	getTooltipRawYValue,
	TOOLTIP_OTHERS_ROW_STYLE,
	type TooltipGroupBy
} from '~/components/ECharts/formatters'
import type { DashboardGrouping } from '../types'

type ChartBuilderTooltipRow = {
	marker: string
	name: string
	value: number
}

export function dashboardGroupingToTooltipGroupBy(grouping?: DashboardGrouping): TooltipGroupBy {
	switch (grouping) {
		case 'week':
			return 'weekly'
		case 'month':
			return 'monthly'
		case 'quarter':
			return 'quarterly'
		case 'year':
			return 'yearly'
		default:
			return 'daily'
	}
}

function renderChartBuilderTooltipRow(
	row: ChartBuilderTooltipRow,
	valueSymbol: string,
	maxNameLength: number,
	separated = false
) {
	const name = row.name.length > maxNameLength ? `${row.name.substring(0, maxNameLength - 2)}..` : row.name
	return `<div style="${separated ? TOOLTIP_OTHERS_ROW_STYLE : ''}display:flex;align-items:center;font-size:11px;line-height:1.4;white-space:nowrap">${row.marker}<span style="margin-right:4px">${name}</span><span style="margin-left:auto;font-weight:500">${formatTooltipValue(row.value, valueSymbol)}</span></div>`
}

export function createChartBuilderTooltipFormatter({
	displayAs,
	groupBy = 'daily',
	useTwoColumns = false
}: {
	displayAs: 'timeSeries' | 'percentage'
	groupBy?: TooltipGroupBy
	useTwoColumns?: boolean
}) {
	const valueSymbol = displayAs === 'percentage' ? '%' : '$'

	return (params: any) => {
		const items = Array.isArray(params) ? params : params ? [params] : []
		if (items.length === 0) return ''

		const rawAxisValue = getTooltipAxisValue(items[0])
		const axisValue = rawAxisValue < 10_000_000_000 ? rawAxisValue * 1_000 : rawAxisValue
		const chartdate = Number.isFinite(axisValue) ? formatTooltipChartDate(axisValue, groupBy) : ''
		const rows: ChartBuilderTooltipRow[] = []
		let explicitOthers: ChartBuilderTooltipRow | null = null
		let total = 0

		for (const item of items) {
			const name = item?.seriesName
			if (!name) continue
			const rawValue = getTooltipRawYValue(item, name)
			const value =
				rawValue == null || rawValue === '-' ? null : typeof rawValue === 'number' ? rawValue : Number(rawValue)
			if (value == null || Number.isNaN(value)) continue

			const row = { marker: item?.marker ?? '', name, value }
			total += value
			if (name === 'Others') {
				explicitOthers = row
			} else {
				rows.push(row)
			}
		}

		rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
		const showTotal = rows.length + (explicitOthers ? 1 : 0) > 1
		const totalLine = showTotal
			? `<div style="font-size:11px;line-height:1.4;font-weight:600">Total&nbsp;&nbsp;${formatTooltipValue(total, valueSymbol)}</div>`
			: ''

		const renderInTwoColumns = useTwoColumns && rows.length > 10
		let content = ''
		if (renderInTwoColumns) {
			const midpoint = Math.ceil(rows.length / 2)
			const leftRows = rows.slice(0, midpoint)
			const rightRows = rows.slice(midpoint)
			const leftColumn = leftRows.map((row) => renderChartBuilderTooltipRow(row, valueSymbol, 15)).join('')
			const rightColumn = rightRows.map((row) => renderChartBuilderTooltipRow(row, valueSymbol, 15)).join('')
			content = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div>${leftColumn}</div><div>${rightColumn}</div></div>`
		} else {
			content = rows.map((row) => renderChartBuilderTooltipRow(row, valueSymbol, 20)).join('')
		}

		const othersLine = explicitOthers ? renderChartBuilderTooltipRow(explicitOthers, valueSymbol, 20, true) : ''

		return `<div style="max-width:${renderInTwoColumns ? '400px' : '300px'}"><div style="font-size:12px;margin-bottom:4px;font-weight:500">${chartdate}</div>${totalLine}${content}${othersLine}</div>`
	}
}
