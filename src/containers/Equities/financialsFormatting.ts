import { formatCompactNumber, formatPercent, formatUsd } from '~/utils/numberFormat'

const NON_MONETARY_SHARE_LABELS = new Set(['Weighted Average Shares Basic', 'Weighted Average Shares Diluted'])

export function isEquitiesShareCountLabel(label: string): boolean {
	return NON_MONETARY_SHARE_LABELS.has(label) || /shares? outstanding/i.test(label)
}

export function formatEquitiesCompactValue(value: unknown, symbol?: string): string | null {
	if (typeof value !== 'number' && typeof value !== 'string') return null
	if (symbol === '$') return formatUsd(value, { compact: true })
	if (symbol === '%') return formatPercent(value, { input: 'percent', compact: true })
	const formatted = formatCompactNumber(value)
	if (!formatted) return null
	return symbol ? `${formatted} ${symbol}` : formatted
}

export function formatEquitiesStatementCellValue(label: string, value: number | null): string {
	return value == null
		? '-'
		: isEquitiesShareCountLabel(label)
			? (formatEquitiesCompactValue(value) ?? '0')
			: (formatEquitiesCompactValue(value, '$') ?? '$0')
}
