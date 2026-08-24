import { formatNumber } from '~/utils/numberFormat'
import { resolveUtrGradeOrLabel, utrGradeColor, type UtrScoreScale } from './gradeBands'
import type { UtrGradeScaleEntry } from './types'

function resolveGradeOrLabel(
	score: number | null,
	gradingScale: UtrGradeScaleEntry[] | null | undefined,
	label?: string | null
) {
	const grade = resolveUtrGradeOrLabel(score, gradingScale, label)
	return { grade, color: utrGradeColor(grade) }
}

export function GradeBadge({
	score,
	gradingScale,
	grade: gradeLabel,
	className = ''
}: {
	score: number | null
	scale?: UtrScoreScale
	gradingScale?: UtrGradeScaleEntry[] | null
	grade?: string | null
	className?: string
}) {
	const { grade, color } = resolveGradeOrLabel(score, gradingScale, gradeLabel)
	return (
		<span
			className={`inline-flex h-6 w-10 items-center justify-center rounded-sm label-sm ${grade ? `${color.solid} text-utr-grade-on-color` : 'bg-surface-elevated-1 text-tertiary'} ${className}`.trim()}
		>
			{grade ?? 'N/A'}
		</span>
	)
}

export function GradeChip({
	score,
	gradingScale,
	grade: gradeLabel,
	className = ''
}: {
	score: number | null
	scale?: UtrScoreScale
	gradingScale?: UtrGradeScaleEntry[] | null
	grade?: string | null
	className?: string
}) {
	const { grade, color } = resolveGradeOrLabel(score, gradingScale, gradeLabel)
	return (
		<span
			className={`inline-flex flex-col items-center justify-center rounded-sm px-2 py-1 ${color.tinted} ${color.text} ${className}`.trim()}
		>
			<span className="label-xs">Token Grade</span>
			<span className="text-base leading-none font-semibold">{grade ?? 'N/A'}</span>
		</span>
	)
}

export function ScoreBar({
	score,
	scale = 100,
	gradingScale,
	grade: gradeLabel,
	showValue = true,
	className = ''
}: {
	score: number | null
	scale?: UtrScoreScale
	gradingScale?: UtrGradeScaleEntry[] | null
	grade?: string | null
	showValue?: boolean
	className?: string
}) {
	const { color } = resolveGradeOrLabel(score, gradingScale, gradeLabel)
	const pct = score == null ? 0 : Math.max(0, Math.min(100, (score / scale) * 100))
	return (
		<span className={`inline-flex items-center gap-2 ${className}`.trim()}>
			{showValue ? (
				<span className="min-w-[5ch] text-left font-jetbrains tabular-nums">
					{score == null
						? 'N/A'
						: formatNumber(score, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}
				</span>
			) : null}
			<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
				{score != null ? (
					<span className={`block h-full rounded-full ${color.solid}`} style={{ width: `${pct}%` }} />
				) : null}
			</span>
		</span>
	)
}
