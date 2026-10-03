import { escapeHtml } from '../shared/escapeHtml'
import { formatTooltipValueHtml } from '../shared/formatters'
import { getTooltipRawYValue, normalizeTooltipItems } from '../shared/tooltip'

/** A single-series tooltip shows the bar's value; a grouped one lists every series at that category. */
export function formatHBarTooltip(params: unknown, grouped: boolean, valueSymbol: string): string {
	const items = normalizeTooltipItems(params)
	const first = items[0]
	if (!first) return ''
	const firstRawValue = getTooltipRawYValue(first, first.seriesName ?? '')
	const numericValue = typeof firstRawValue === 'number' ? firstRawValue : Number(firstRawValue ?? 0)
	const header = `<div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(first.name ?? '')}</div>`
	if (!grouped) return `${header}<div>${formatTooltipValueHtml(numericValue, valueSymbol)}</div>`
	let rows = ''
	for (const item of items) {
		const name = item.seriesName ?? ''
		const rawValue = getTooltipRawYValue(item, name)
		const value = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0)
		rows += `<div>${item.marker ?? ''}${escapeHtml(name)}: ${formatTooltipValueHtml(value, valueSymbol)}</div>`
	}
	return header + rows
}
