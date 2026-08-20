import { resolveUtrGrade, UTR_GRADE_COLORS, utrGradeColor, type UtrGradeLabel, type UtrScoreScale } from './gradeBands'

function resolveGradeOrLabel(score: number | null, scale: UtrScoreScale, label?: string | null) {
	if (label !== undefined) {
		const grade = label && label in UTR_GRADE_COLORS && label !== 'N/A' ? (label as UtrGradeLabel) : null
		return { grade, color: UTR_GRADE_COLORS[grade ?? 'N/A'] }
	}
	const grade = resolveUtrGrade(score, scale)
	return { grade, color: utrGradeColor(grade) }
}

export function GradeBadge({
	score,
	scale = 100,
	grade: gradeLabel,
	className = ''
}: {
	score: number | null
	scale?: UtrScoreScale
	grade?: string | null
	className?: string
}) {
	const { grade, color } = resolveGradeOrLabel(score, scale, gradeLabel)
	return (
		<span
			className={`inline-flex h-6 w-10 items-center justify-center rounded label-sm ${grade ? `${color.solid} text-white` : 'bg-surface-elevated-1 text-tertiary'} ${className}`.trim()}
		>
			{grade ?? 'N/A'}
		</span>
	)
}

export function GradeChip({
	score,
	scale = 100,
	grade: gradeLabel,
	className = ''
}: {
	score: number | null
	scale?: UtrScoreScale
	grade?: string | null
	className?: string
}) {
	const { grade, color } = resolveGradeOrLabel(score, scale, gradeLabel)
	return (
		<span
			className={`inline-flex flex-col items-center justify-center rounded px-2 py-1 ${color.tinted} ${color.text} ${className}`.trim()}
		>
			<span className="text-[11px] leading-normal">Token Grade</span>
			<span className="text-base leading-none font-semibold">{grade ?? 'N/A'}</span>
		</span>
	)
}

export function ScoreBar({
	score,
	scale = 100,
	grade: gradeLabel,
	showValue = true,
	className = ''
}: {
	score: number | null
	scale?: UtrScoreScale
	grade?: string | null
	showValue?: boolean
	className?: string
}) {
	const { color } = resolveGradeOrLabel(score, scale, gradeLabel)
	const pct = score == null ? 0 : Math.max(0, Math.min(100, (score / scale) * 100))
	return (
		<span className={`inline-flex items-center gap-2 ${className}`.trim()}>
			{showValue ? (
				<span className="min-w-[5ch] text-left font-jetbrains tabular-nums">
					{score == null ? 'N/A' : score.toFixed(2)}
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
