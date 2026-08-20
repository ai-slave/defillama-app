import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { forgdCtaSecondaryButtonStyles } from '~/containers/MarketMakers/styles'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { resolveUtrGrade, utrGradeColor } from './gradeBands'
import { GradeBadge, ScoreBar } from './grades'

export function GradeFooter({
	score,
	grade,
	percentile,
	divider = true
}: {
	score: number | null
	grade?: string | null
	percentile?: number | null
	divider?: boolean
}) {
	const percentileLabel = percentile == null ? 'N/A' : `${percentile.toFixed(2)}%`
	const percentileWidth = percentile == null ? 0 : Math.max(0, Math.min(100, percentile))
	return (
		<div
			className={`flex items-start justify-between gap-2 px-4 py-2.5 lg:items-center ${divider ? 'border-t border-subtle' : ''}`}
		>
			<span className="flex flex-col gap-1.5 label-sm text-secondary lg:flex-row lg:items-center lg:gap-2">
				Grade
				<GradeBadge score={score} scale={10} grade={grade} />
			</span>
			<span className="flex flex-col gap-1.5 label-sm text-secondary lg:flex-row lg:items-center lg:gap-2">
				Score
				<span className="flex items-center gap-2">
					<ScoreBar score={score} scale={10} grade={grade} />
					<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
				</span>
			</span>
			<span className="flex flex-col gap-1.5 label-sm text-secondary lg:flex-row lg:items-center lg:gap-2">
				Percentile
				<span className="flex items-center gap-2">
					<span className="font-jetbrains text-primary tabular-nums">{percentileLabel}</span>
					<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
						<span className="block h-full rounded-full bg-(--text-primary)" style={{ width: `${percentileWidth}%` }} />
					</span>
				</span>
			</span>
		</div>
	)
}

export function ClaimProfileBanner() {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand p-4">
			<div className="flex gap-3">
				<Icon name="shield-check" height={24} width={24} className="mt-0.5 shrink-0 text-on-brand" />
				<div className="flex flex-col gap-1">
					<p className="label-lg text-on-brand">Claim this token profile</p>
					<p className="body-sm text-on-brand/70">
						Core team members can claim this profile to verify project information and update disclosures.
					</p>
					<BasicLink
						href="/universal-token-rating/claim"
						className={`${forgdCtaSecondaryButtonStyles} mt-2 w-fit lg:hidden`}
					>
						Claim Token Profile
					</BasicLink>
				</div>
			</div>
			<BasicLink href="/universal-token-rating/claim" className={`${forgdCtaSecondaryButtonStyles} max-lg:hidden`}>
				Claim Token Profile
			</BasicLink>
		</div>
	)
}

export function GradeFooterColumns({
	score,
	grade,
	percentile
}: {
	score: number | null
	grade?: string | null
	percentile?: number | null
}) {
	const percentileLabel = percentile == null ? 'N/A' : `${percentile.toFixed(2)}%`
	const percentileWidth = percentile == null ? 0 : Math.max(0, Math.min(100, percentile))
	return (
		<div className="flex items-start gap-x-2 border-t border-subtle px-4 py-2.5">
			<div className="flex flex-col gap-1.5">
				<span className="label-sm text-secondary">Grade</span>
				<GradeBadge score={score} scale={10} grade={grade} />
			</div>
			<div className="flex-[2]" />
			<div className="flex flex-col gap-1.5">
				<span className="label-sm text-secondary">Score</span>
				<span className="flex items-center gap-2">
					<ScoreBar score={score} scale={10} grade={grade} />
					<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
				</span>
			</div>
			<div className="flex-[1]" />
			<div className="flex flex-col gap-1.5">
				<span className="label-sm text-secondary">Percentile</span>
				<span className="flex items-center gap-2">
					<span className="font-jetbrains label-sm text-primary tabular-nums">{percentileLabel}</span>
					<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
						<span className="block h-full rounded-full bg-(--text-primary)" style={{ width: `${percentileWidth}%` }} />
					</span>
				</span>
			</div>
		</div>
	)
}

export function GradeFooterStacked({
	score,
	grade,
	percentile
}: {
	score: number | null
	grade?: string | null
	percentile?: number | null
}) {
	const percentileLabel = percentile == null ? 'N/A' : `${percentile.toFixed(2)}%`
	const percentileWidth = percentile == null ? 0 : Math.max(0, Math.min(100, percentile))
	return (
		<div className="flex flex-col border-t border-subtle px-4 py-1.5">
			<div className="flex min-h-6 items-center justify-between gap-2">
				<span className="label-sm text-secondary">Grade</span>
				<GradeBadge score={score} scale={10} grade={grade} />
			</div>
			<div className="flex min-h-6 items-center justify-between gap-2">
				<span className="label-sm text-secondary">Score</span>
				<span className="flex items-center gap-2">
					<ScoreBar score={score} scale={10} grade={grade} />
					<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
				</span>
			</div>
			<div className="flex min-h-6 items-center justify-between gap-2">
				<span className="label-sm text-secondary">Percentile</span>
				<span className="flex items-center gap-2">
					<span className="font-jetbrains label-sm text-primary tabular-nums">{percentileLabel}</span>
					<span className="h-2 w-10 shrink-0 overflow-hidden rounded-full bg-surface-elevated-1">
						<span className="block h-full rounded-full bg-(--text-primary)" style={{ width: `${percentileWidth}%` }} />
					</span>
				</span>
			</div>
		</div>
	)
}

export function CantFindTokenBanner() {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand p-4">
			<div className="flex items-center gap-4">
				<img
					src="/market-makers-docs/circle-portal.svg"
					alt=""
					aria-hidden
					className="size-12 shrink-0 brightness-0 invert"
				/>
				<div className="flex flex-col gap-1">
					<p className="label-lg text-on-brand">Can’t Find Your Token?</p>
					<p className="body-sm text-on-brand/70">
						Create an account on Forgd to register your token and submit a request to be added to the Universal Token
						Rating.
					</p>
					<BasicLink
						href="/universal-token-rating/join"
						className={`${forgdCtaSecondaryButtonStyles} mt-2 w-fit lg:hidden`}
					>
						Join Forgd
					</BasicLink>
				</div>
			</div>
			<BasicLink href="/universal-token-rating/join" className={`${forgdCtaSecondaryButtonStyles} max-lg:hidden`}>
				Join Forgd
			</BasicLink>
		</div>
	)
}

export function NoDataPlaceholder() {
	return (
		<div className="flex min-h-[260px] flex-col items-center justify-center gap-1 rounded-lg bg-surface-elevated-1 p-6 text-center">
			<Icon name="bar-chart-2" height={24} width={24} className="text-tertiary" />
			<p className="label-md text-secondary">NO DATA YET</p>
			<p className="body-sm text-tertiary">Data will appear here once available.</p>
		</div>
	)
}

export function CardDivider() {
	return <div className="-mx-4 border-t border-subtle" />
}

export function KvTable({ rows }: { rows: [ReactNode, ReactNode][] }) {
	return (
		<div className="flex flex-col rounded-lg border border-subtle">
			{rows.map(([label, value], index) => (
				<div
					key={typeof label === 'string' ? label : index}
					className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-2 last:border-b-0"
				>
					<span className="body-sm text-secondary">{label}</span>
					<span className="font-jetbrains body-sm text-primary tabular-nums">{value}</span>
				</div>
			))}
		</div>
	)
}

export function MetricCard({
	title,
	badge,
	score,
	grade,
	percentile,
	onOpen,
	children
}: {
	title: string
	badge?: ReactNode
	score: number | null
	grade?: string | null
	percentile?: number | null
	onOpen?: () => void
	children: ReactNode
}) {
	return (
		<Panel padding="none">
			<div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
				<span className="flex flex-wrap items-center gap-2">
					<h3 className="label-lg">{title}</h3>
					{badge}
				</span>
				{onOpen ? (
					<Button type="button" size="sm" square aria-label={`Open ${title} details`} onClick={onOpen}>
						<Icon name="arrow-right" height={14} width={14} />
					</Button>
				) : null}
			</div>
			<div className="flex flex-1 flex-col gap-3 p-4">{children}</div>
			<GradeFooter score={score} grade={grade} percentile={percentile} divider={false} />
		</Panel>
	)
}

export function TickScoreStrip({
	label,
	score,
	gradeLabel
}: {
	label: string
	score: number | null
	gradeLabel?: string | null
}) {
	const grade = gradeLabel !== undefined ? gradeLabel : resolveUtrGrade(score, 10)
	const color = utrGradeColor((grade as Parameters<typeof utrGradeColor>[0]) ?? null)
	return (
		<div className="flex flex-1 flex-col gap-1.5 px-4 py-3">
			<div className="flex items-center justify-between gap-2">
				<span className="label-md text-secondary">
					{label} <span className={color.text}>{grade ?? 'N/A'}</span>
				</span>
				<span className="font-jetbrains label-md tabular-nums">
					{score == null ? 'N/A' : score.toFixed(2)}
					<span className="text-tertiary"> /10</span>
				</span>
			</div>
			<span className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated-1">
				{score != null ? (
					<span
						className={`block h-full rounded-full ${color.solid}`}
						style={{ width: `${Math.min(100, score * 10)}%` }}
					/>
				) : null}
			</span>
		</div>
	)
}
