import { abbreviateNumber } from '~/utils'

export type MetricFormatKind = 'usd' | 'percent' | 'spread' | 'score' | 'decimal'

function pct2(value: number): string {
	return `${Number(value.toFixed(2))}%`
}

export function formatComposite(value: number | null | undefined): string {
	if (value == null) return 'N/A'
	if (value < 5) return '<5.00'
	return value.toFixed(2)
}

export function roundPercentile(value: number | null | undefined): number | null {
	if (value == null) return null
	return Math.round(value)
}

export function normalizeUptime(value: number | null | undefined): number | null {
	if (value == null) return null
	return value <= 1 ? value * 100 : value
}

export function formatMetricValue(value: number | null | undefined, kind: MetricFormatKind): string {
	if (value == null) return 'N/A'
	switch (kind) {
		case 'usd':
			return abbreviateNumber(value, 2, '$') ?? 'N/A'
		case 'percent':
		case 'spread':
			return pct2(value)
		case 'score':
			return value.toFixed(2)
		case 'decimal':
			return abbreviateNumber(value, 2) ?? 'N/A'
	}
}

export function formatMarketPct(value: number | null | undefined): string {
	if (value == null) return 'N/A'
	return `${pct2(value)} of Market`
}
