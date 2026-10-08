import type { UtrGradeScaleEntry } from './types'

export type UtrGradeLabel = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC'

export type UtrGradeColor = {
	text: string
	solid: string
	tinted: string
	hex: string
}

export const UTR_GRADE_COLORS: Record<UtrGradeLabel | 'N/A', UtrGradeColor> = {
	AAA: { text: 'text-utr-grade-aaa-text', solid: 'bg-utr-grade-aaa', tinted: 'bg-utr-grade-aaa-tint', hex: '#11935f' },
	AA: { text: 'text-utr-grade-aa-text', solid: 'bg-utr-grade-aa', tinted: 'bg-utr-grade-aa-tint', hex: '#359b58' },
	A: { text: 'text-utr-grade-a-text', solid: 'bg-utr-grade-a', tinted: 'bg-utr-grade-a-tint', hex: '#58a351' },
	BBB: { text: 'text-utr-grade-bbb-text', solid: 'bg-utr-grade-bbb', tinted: 'bg-utr-grade-bbb-tint', hex: '#9fb242' },
	BB: { text: 'text-utr-grade-bb-text', solid: 'bg-utr-grade-bb', tinted: 'bg-utr-grade-bb-tint', hex: '#c0a03a' },
	B: { text: 'text-utr-grade-b-text', solid: 'bg-utr-grade-b', tinted: 'bg-utr-grade-b-tint', hex: '#b96d39' },
	CCC: { text: 'text-utr-grade-ccc-text', solid: 'bg-utr-grade-ccc', tinted: 'bg-utr-grade-ccc-tint', hex: '#b23a38' },
	'N/A': { text: 'text-tertiary', solid: 'bg-surface-elevated-1', tinted: 'bg-surface-elevated-1', hex: '' }
}

export type UtrScoreScale = 100 | 10

export function parseUtrGrade(value: string | null | undefined): UtrGradeLabel | null {
	return value && value in UTR_GRADE_COLORS && value !== 'N/A' ? (value as UtrGradeLabel) : null
}

export function resolveUtrGrade(
	score: number | null | undefined,
	scale: Array<UtrGradeScaleEntry> | null | undefined
): UtrGradeLabel | null {
	if (score == null || Number.isNaN(score) || !scale?.length) return null
	let fallback: UtrGradeLabel | null = null
	let resolved: { min: number; grade: UtrGradeLabel } | null = null
	for (const band of scale) {
		const grade = parseUtrGrade(band.grade)
		if (!grade) continue
		if (band.min === null) {
			fallback = grade
			continue
		}
		if (score >= band.min && (!resolved || band.min > resolved.min)) resolved = { min: band.min, grade }
	}
	return resolved?.grade ?? fallback
}

export function resolveUtrGradeOrLabel(
	score: number | null | undefined,
	scale: Array<UtrGradeScaleEntry> | null | undefined,
	explicitGrade?: string | null
): UtrGradeLabel | null {
	return explicitGrade == null ? resolveUtrGrade(score, scale) : parseUtrGrade(explicitGrade)
}

export function utrGradeColor(grade: UtrGradeLabel | null): UtrGradeColor {
	return UTR_GRADE_COLORS[grade ?? 'N/A']
}
