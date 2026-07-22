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

export type CompositeGrade = { label: string; colorClassName: string }

const GRADE_LETTER_COLORS: Record<string, string> = {
	A: 'text-success',
	B: 'text-success',
	C: 'text-warning',
	D: 'text-warning',
	F: 'text-error'
}

const GRADE_FALLBACK_STEPS: { min: number; label: string }[] = [
	{ min: 9, label: 'A+' },
	{ min: 8, label: 'A' },
	{ min: 7, label: 'B' },
	{ min: 6, label: 'C' },
	{ min: 5, label: 'D' }
]

function gradeFromLabel(label: string): CompositeGrade | null {
	const colorClassName = GRADE_LETTER_COLORS[label.charAt(0).toUpperCase()]
	return colorClassName ? { label, colorClassName } : null
}

function gradeFromComposite(value: number): CompositeGrade | null {
	for (const step of GRADE_FALLBACK_STEPS) {
		if (value >= step.min) return gradeFromLabel(step.label)
	}
	return gradeFromLabel('F')
}

export function resolveGrade(
	grade: string | null | undefined,
	composite: number | null | undefined
): CompositeGrade | null {
	if (grade) return gradeFromLabel(grade)
	if (composite == null) return null
	return gradeFromComposite(composite)
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
