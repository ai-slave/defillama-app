import { formatCompactNumber, formatUsd, formatNumber, formatPercent } from '~/utils/numberFormat'
import { GRADE_BANDS } from './gradeBands'

export type MetricFormatKind = 'usd' | 'percent' | 'spread' | 'score' | 'decimal'

export function formatComposite(value: number | null | undefined): string {
	if (value == null) return 'N/A'
	if (value < 5) return '<5.00'
	return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export type CompositeGrade = { label: string; colorClassName: string }

export function resolveGrade(composite: number | null | undefined): CompositeGrade | null {
	if (composite == null) return null
	const band = GRADE_BANDS.find((step) => composite >= step.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1]
	return { label: band.label, colorClassName: band.colorClassName }
}

export function roundPercentile(value: number | null | undefined): number | null {
	if (value == null) return null
	return Math.round(value)
}

export function formatMetricValue(value: number | null | undefined, kind: MetricFormatKind): string {
	if (value == null) return 'N/A'
	switch (kind) {
		case 'usd':
			return formatUsd(value, { compact: true }) ?? 'N/A'
		case 'percent':
		case 'spread':
			return formatPercent(value, { input: 'percent' })
		case 'score':
			return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
		case 'decimal':
			return formatCompactNumber(value) ?? 'N/A'
	}
}

export function formatMarketPct(value: number | null | undefined): string {
	if (value == null) return 'N/A'
	return `${formatPercent(value, { input: 'percent' })} of Market`
}
