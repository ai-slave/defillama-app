import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { forgdCtaSecondaryButtonStyles } from '~/containers/MarketMakers/styles'
import { Button } from '~/ui/Button'
import { ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber } from '~/utils/numberFormat'
import { resolveUtrGradeOrLabel, utrGradeColor } from './gradeBands'
import { GradeBadge, PercentileBar, ScoreBar } from './grades'
import type { UtrGradeScaleEntry } from './types'

// One row needs 451px of card width at its widest values ("10.00", "100.00%"), so it starts at 28.5rem (456px); a
// narrower card keeps each label above its value. The card decides, not the screen: at 1024px two cards share a row
// beside the sidebar and each is too narrow for one line.
const INLINE_GROUP =
	'flex flex-col gap-1.5 label-sm text-secondary @min-[28.5rem]:flex-row @min-[28.5rem]:items-center @min-[28.5rem]:gap-2'

export function GradeFooter({
	score,
	grade,
	gradingScale,
	percentile,
	divider = true
}: {
	score: number | null
	grade?: string | null
	gradingScale?: Array<UtrGradeScaleEntry> | null
	percentile?: number | null
	divider?: boolean
}) {
	return (
		<div className={`@container ${divider ? 'border-t border-subtle' : ''}`}>
			<div className="flex items-start justify-between gap-2 px-4 py-2.5 @min-[28.5rem]:items-center">
				<span className={INLINE_GROUP}>
					Grade
					<GradeBadge score={score} scale={10} grade={grade ?? undefined} gradingScale={gradingScale} />
				</span>
				<span className={INLINE_GROUP}>
					Score
					<span className="flex items-center gap-2">
						<ScoreBar score={score} scale={10} grade={grade ?? undefined} gradingScale={gradingScale} />
						<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
					</span>
				</span>
				<span className={INLINE_GROUP}>
					Percentile
					<PercentileBar percentile={percentile} className="text-primary" />
				</span>
			</div>
		</div>
	)
}

export function ClaimProfileBanner({ asset }: { asset?: string | null }) {
	const href = asset
		? `/universal-token-rating/claim?token=${encodeURIComponent(asset)}`
		: '/universal-token-rating/claim'
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand p-4">
			<div className="flex items-start gap-3">
				<span className="flex h-lh shrink-0 items-center label-lg">
					<Icon name="shield-check" className="size-6 text-on-brand" />
				</span>
				<div className="flex flex-col gap-1">
					<p className="label-lg text-on-brand">Claim this token profile</p>
					<p className="body-sm text-on-brand">
						Core team members can claim this profile to verify project information and update disclosures.
					</p>
					<BasicLink href={href} className={`${forgdCtaSecondaryButtonStyles} mt-2 w-fit lg:hidden`}>
						Claim Token Profile
					</BasicLink>
				</div>
			</div>
			<BasicLink href={href} className={`${forgdCtaSecondaryButtonStyles} max-lg:hidden`}>
				Claim Token Profile
			</BasicLink>
		</div>
	)
}

export function UtrDisclaimer() {
	return (
		<p className="body-sm text-tertiary">
			UTR scores evaluate disclosure quality and token market structure. The score is informational and should not be
			interpreted as an assessment of expected returns or as an investment recommendation.
		</p>
	)
}

// Columns need 303px of card width at their widest values, so they start at 19rem (304px); a narrower card falls back
// to one label-and-value row per figure.
const COLUMN =
	'flex min-h-6 items-center justify-between gap-2 @min-[19rem]:flex-col @min-[19rem]:items-start @min-[19rem]:justify-start @min-[19rem]:gap-1.5'

export function GradeFooterColumns({
	score,
	grade,
	gradingScale,
	percentile
}: {
	score: number | null
	grade?: string | null
	gradingScale?: Array<UtrGradeScaleEntry> | null
	percentile?: number | null
}) {
	return (
		<div className="@container border-t border-subtle">
			<div className="flex flex-col px-4 py-1.5 @min-[19rem]:flex-row @min-[19rem]:items-start @min-[19rem]:gap-x-2 @min-[19rem]:py-2.5">
				<div className={COLUMN}>
					<span className="label-sm text-secondary">Grade</span>
					<GradeBadge score={score} scale={10} grade={grade ?? undefined} gradingScale={gradingScale} />
				</div>
				<div className="hidden flex-[2] @min-[19rem]:block" />
				<div className={COLUMN}>
					<span className="label-sm text-secondary">Score</span>
					<span className="flex items-center gap-2">
						<ScoreBar score={score} scale={10} grade={grade ?? undefined} gradingScale={gradingScale} />
						<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
					</span>
				</div>
				<div className="hidden flex-[1] @min-[19rem]:block" />
				<div className={COLUMN}>
					<span className="label-sm text-secondary">Percentile</span>
					<PercentileBar percentile={percentile} className="mono-sm text-primary" />
				</div>
			</div>
		</div>
	)
}

// A card too narrow for a label and its value side by side wraps the value under the label, still right-aligned.
const STACKED_ROW = 'flex min-h-6 flex-wrap items-center justify-between gap-x-2'

export function GradeFooterStacked({
	score,
	grade,
	gradingScale,
	percentile
}: {
	score: number | null
	grade?: string | null
	gradingScale?: Array<UtrGradeScaleEntry> | null
	percentile?: number | null
}) {
	return (
		<div className="flex flex-col border-t border-subtle px-4 py-1.5">
			<div className={STACKED_ROW}>
				<span className="label-sm text-secondary">Grade</span>
				<GradeBadge
					score={score}
					scale={10}
					grade={grade ?? undefined}
					gradingScale={gradingScale}
					className="ml-auto"
				/>
			</div>
			<div className={STACKED_ROW}>
				<span className="label-sm text-secondary">Score</span>
				<span className="ml-auto flex items-center gap-2">
					<ScoreBar score={score} scale={10} grade={grade ?? undefined} gradingScale={gradingScale} />
					<QuestionHelper text="Scored on the standardized 0–10 scale against the published rubric." />
				</span>
			</div>
			<div className={STACKED_ROW}>
				<span className="label-sm text-secondary">Percentile</span>
				<PercentileBar percentile={percentile} className="ml-auto mono-sm text-primary" />
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
					<p className="body-sm text-on-brand">
						Submit your project information to apply for inclusion in the Universal Token Rating.
					</p>
					<BasicLink
						href="/universal-token-rating/join"
						className={`${forgdCtaSecondaryButtonStyles} mt-2 w-fit lg:hidden`}
					>
						Apply for UTR
					</BasicLink>
				</div>
			</div>
			<BasicLink href="/universal-token-rating/join" className={`${forgdCtaSecondaryButtonStyles} max-lg:hidden`}>
				Apply for UTR
			</BasicLink>
		</div>
	)
}

export function CardDivider() {
	return <div className="-mx-4 border-t border-subtle" />
}

/** A score card chart's caption, as the title of its chart toolbar, with that chart's export buttons. A card with two
    charts gives each its own caption, so each chart's buttons sit with it. */
export function ChartCaption({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
	return (
		<ChartPanelToolbar leading={<p className="label-sm text-secondary">{children}</p>}>{actions}</ChartPanelToolbar>
	)
}

export function KvTable({ rows }: { rows: Array<[ReactNode, ReactNode]> }) {
	return (
		<div className="flex flex-col rounded-lg border border-subtle">
			{rows.map(([label, value], index) => (
				<div
					key={typeof label === 'string' ? label : index}
					className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-2 last:border-b-0"
				>
					<span className="body-sm text-secondary">{label}</span>
					<span className="mono-sm text-primary tabular-nums">{value}</span>
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
	gradingScale,
	percentile,
	onOpen,
	chart,
	children
}: {
	title: string
	badge?: ReactNode
	score: number | null
	grade?: string | null
	gradingScale?: Array<UtrGradeScaleEntry> | null
	percentile?: number | null
	onOpen?: () => void
	/** The card's ChartCaption and ChartPanelBody, flush under the header. The body takes a stretched row's extra
	    height, so paired cards line up their figures and footers. */
	chart?: ReactNode
	children: ReactNode
}) {
	return (
		<Panel>
			<div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
				<span className="flex flex-wrap items-center gap-2">
					<h3 className="label-lg">{title}</h3>
					{badge}
				</span>
				{onOpen ? (
					<Tooltip
						content={`Open ${title} details`}
						render={<Button type="button" size="sm" square aria-label={`Open ${title} details`} onClick={onOpen} />}
					>
						<Icon name="arrow-right" className="size-4" />
					</Tooltip>
				) : null}
			</div>
			{chart}
			<div className={`flex flex-col gap-3 p-4 ${chart ? 'border-t border-subtle' : 'flex-1'}`}>{children}</div>
			<GradeFooter score={score} grade={grade} gradingScale={gradingScale} percentile={percentile} divider={false} />
		</Panel>
	)
}

export function TickScoreStrip({
	label,
	score,
	gradeLabel,
	gradingScale
}: {
	label: string
	score: number | null
	gradeLabel?: string | null
	gradingScale?: Array<UtrGradeScaleEntry> | null
}) {
	const grade = resolveUtrGradeOrLabel(score, gradingScale, gradeLabel ?? undefined)
	const color = utrGradeColor(grade)
	return (
		<div className="flex flex-1 flex-col gap-1.5 px-4 py-3">
			<div className="flex items-center justify-between gap-2">
				<span className="label-md text-secondary">
					{label} <span className={color.text}>{grade ?? 'N/A'}</span>
				</span>
				<span className="shrink-0 mono-md whitespace-nowrap tabular-nums">
					{score == null
						? 'N/A'
						: formatNumber(score, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}
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
