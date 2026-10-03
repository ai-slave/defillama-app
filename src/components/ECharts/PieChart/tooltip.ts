import { formatPercent } from '~/utils/numberFormat'
import { escapeHtml } from '../shared/escapeHtml'
import { formatTooltipValueHtml } from '../shared/formatters'
import type { PieTooltipParams } from './types'

export function normalizePieTooltipParams(params: unknown): PieTooltipParams {
	const value = Array.isArray(params) ? params[0] : params
	return value !== null && typeof value === 'object' ? (value as PieTooltipParams) : {}
}

/** Slice names come from API data and LlamaAI results, so they are escaped like every other tooltip label. */
export function formatPieTooltip(p: PieTooltipParams, valueSymbol: string): string {
	const rawValue = typeof p.value === 'number' ? p.value : Number(p.value ?? 0)
	return `${p.marker ?? ''}${escapeHtml(p.name ?? '')}: <b>${formatTooltipValueHtml(rawValue, valueSymbol)}</b> (${formatPercent(p.percent ?? 0, { input: 'percent' })})`
}
