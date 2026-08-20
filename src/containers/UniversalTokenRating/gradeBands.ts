export type UtrGradeLabel = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC'

export type UtrGradeBand = {
	min: number
	label: UtrGradeLabel
}

// Bands come from the TVS docs grade tables; Forgd tunes them in their admin
// dashboard, so keep every cutoff in these two tables only.
export const UTR_AXIS_GRADE_BANDS: UtrGradeBand[] = [
	{ min: 9.5, label: 'AAA' },
	{ min: 9, label: 'AA' },
	{ min: 8.25, label: 'A' },
	{ min: 7.25, label: 'BBB' },
	{ min: 6.25, label: 'BB' },
	{ min: 5.25, label: 'B' },
	{ min: -Infinity, label: 'CCC' }
]

export const UTR_OVERALL_GRADE_BANDS: UtrGradeBand[] = [
	{ min: 82.5, label: 'AAA' },
	{ min: 75, label: 'AA' },
	{ min: 67.5, label: 'A' },
	{ min: 60, label: 'BBB' },
	{ min: 50, label: 'BB' },
	{ min: 40, label: 'B' },
	{ min: -Infinity, label: 'CCC' }
]

export type UtrGradeColor = {
	text: string
	solid: string
	tinted: string
	hex: string
}

export const UTR_GRADE_COLORS: Record<UtrGradeLabel | 'N/A', UtrGradeColor> = {
	AAA: { text: 'text-utr-grade-aaa', solid: 'bg-utr-grade-aaa', tinted: 'bg-utr-grade-aaa-tint', hex: '#11935f' },
	AA: { text: 'text-utr-grade-aa', solid: 'bg-utr-grade-aa', tinted: 'bg-utr-grade-aa-tint', hex: '#359b58' },
	A: { text: 'text-utr-grade-a', solid: 'bg-utr-grade-a', tinted: 'bg-utr-grade-a-tint', hex: '#58a351' },
	BBB: { text: 'text-utr-grade-bbb', solid: 'bg-utr-grade-bbb', tinted: 'bg-utr-grade-bbb-tint', hex: '#9fb242' },
	BB: { text: 'text-utr-grade-bb', solid: 'bg-utr-grade-bb', tinted: 'bg-utr-grade-bb-tint', hex: '#c0a03a' },
	B: { text: 'text-utr-grade-b', solid: 'bg-utr-grade-b', tinted: 'bg-utr-grade-b-tint', hex: '#b96d39' },
	CCC: { text: 'text-utr-grade-ccc', solid: 'bg-utr-grade-ccc', tinted: 'bg-utr-grade-ccc-tint', hex: '#b23a38' },
	'N/A': { text: 'text-tertiary', solid: 'bg-surface-elevated-1', tinted: 'bg-surface-elevated-1', hex: '' }
}

export type UtrScoreScale = 100 | 10

export function resolveUtrGrade(score: number | null | undefined, scale: UtrScoreScale = 100): UtrGradeLabel | null {
	if (score == null || Number.isNaN(score)) return null
	const bands = scale === 100 ? UTR_OVERALL_GRADE_BANDS : UTR_AXIS_GRADE_BANDS
	for (const band of bands) {
		if (score >= band.min) return band.label
	}
	return null
}

export function utrGradeColor(grade: UtrGradeLabel | null): UtrGradeColor {
	return UTR_GRADE_COLORS[grade ?? 'N/A']
}
