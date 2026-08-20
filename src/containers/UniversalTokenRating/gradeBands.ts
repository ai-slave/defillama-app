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
	AAA: { text: 'text-[#11935f]', solid: 'bg-[#11935f]', tinted: 'bg-[rgba(17,147,95,0.1)]', hex: '#11935f' },
	AA: { text: 'text-[#359b58]', solid: 'bg-[#359b58]', tinted: 'bg-[rgba(53,155,88,0.1)]', hex: '#359b58' },
	A: { text: 'text-[#58a351]', solid: 'bg-[#58a351]', tinted: 'bg-[rgba(88,163,81,0.1)]', hex: '#58a351' },
	BBB: { text: 'text-[#9fb242]', solid: 'bg-[#9fb242]', tinted: 'bg-[rgba(159,178,66,0.1)]', hex: '#9fb242' },
	BB: { text: 'text-[#c0a03a]', solid: 'bg-[#c0a03a]', tinted: 'bg-[rgba(192,160,58,0.1)]', hex: '#c0a03a' },
	B: { text: 'text-[#b96d39]', solid: 'bg-[#b96d39]', tinted: 'bg-[rgba(185,109,57,0.1)]', hex: '#b96d39' },
	CCC: { text: 'text-[#b23a38]', solid: 'bg-[#b23a38]', tinted: 'bg-[rgba(178,58,56,0.1)]', hex: '#b23a38' },
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
