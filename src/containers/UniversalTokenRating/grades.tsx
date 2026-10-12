import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { UTR_PERCENT_OPTIONS } from './constants'
import { resolveUtrGradeOrLabel, utrGradeColor, type UtrScoreScale } from './gradeBands'
import type { UtrGradeScaleEntry } from './types'

function resolveGradeOrLabel(
	score: number | null,
	gradingScale: Array<UtrGradeScaleEntry> | null | undefined,
	label?: string | null
) {
	const grade = resolveUtrGradeOrLabel(score, gradingScale, label)
	return { grade, color: utrGradeColor(grade) }
}

// The badge and the two meters keep their width: the app lets every element shrink (src/tailwind.css), and a
// squeezed meter slides its bar over its own value or the help icon beside it. A row too narrow for them stacks.
const GRADE_BADGE_SIZE_CLASSES = {
	md: 'h-6 w-10 label-sm',
	lg: 'h-8 w-12 body-lg'
} as const

export function GradeBadge({
	score,
	gradingScale,
	grade: gradeLabel,
	size = 'md',
	className = ''
}: {
	score: number | null
	scale?: UtrScoreScale
	gradingScale?: Array<UtrGradeScaleEntry> | null
	grade?: string | null
	size?: keyof typeof GRADE_BADGE_SIZE_CLASSES
	className?: string
}) {
	const { grade, color } = resolveGradeOrLabel(score, gradingScale, gradeLabel)
	return (
		<span
			className={`inline-flex shrink-0 items-center justify-center rounded-sm ${GRADE_BADGE_SIZE_CLASSES[size]} ${grade ? `${color.solid} text-utr-grade-on-color` : 'bg-surface-elevated-1 text-tertiary'} ${className}`.trim()}
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
	gradingScale?: Array<UtrGradeScaleEntry> | null
	grade?: string | null
	className?: string
}) {
	const { grade, color } = resolveGradeOrLabel(score, gradingScale, gradeLabel)
	return (
		<span
			className={`inline-flex flex-col items-center justify-center rounded-sm px-2 py-1 ${color.tinted} ${color.text} ${className}`.trim()}
		>
			<span className="label-xs">Token Grade</span>
			<span className="title-lg">{grade ?? 'N/A'}</span>
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
	gradingScale?: Array<UtrGradeScaleEntry> | null
	grade?: string | null
	showValue?: boolean
	className?: string
}) {
	const { color } = resolveGradeOrLabel(score, gradingScale, gradeLabel)
	const pct = score == null ? 0 : Math.max(0, Math.min(100, (score / scale) * 100))
	return (
		<span className={`inline-flex shrink-0 items-center gap-2 ${className}`.trim()}>
			{showValue ? (
				<span className="min-w-[5ch] text-left whitespace-nowrap tabular-nums">
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

/** Percentile value and a 40px bar of the same share. */
export function PercentileBar({
	percentile,
	className = ''
}: {
	percentile: number | null | undefined
	className?: string
}) {
	const width = percentile == null ? 0 : Math.max(0, Math.min(100, percentile))
	return (
		<span className={`inline-flex shrink-0 items-center gap-2 ${className}`.trim()}>
			<span className="whitespace-nowrap tabular-nums">{formatPercent(percentile, UTR_PERCENT_OPTIONS) ?? 'N/A'}</span>
			<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
				<span className="block h-full rounded-full bg-(--text-primary)" style={{ width: `${width}%` }} />
			</span>
		</span>
	)
}
