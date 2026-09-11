import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { RelativeTime } from '~/ui/RelativeTime'
import { formatNumber, formatPercent, formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { withdrawableFraction } from '../data/exit'
import type { VerifiedBlock } from '../data/types'
import { exitCoverageLine, exitHeadline, exitShareLine } from '../domain/exitPresentation'
import { isVerifiedCurrent } from '../domain/verifiedFreshness'
import { SealGlyph } from '../Tables/Measured'
import { useSubscribeProModal } from '../useSubscribeProModal'
import { YIELD_PERCENT_OPTIONS } from './format'
import { HOW_WE_VERIFY_ID, type VerifiedWindowRow } from './VerifiedApyPanel'

export interface VerifiedSnapshotModel {
	// The hero figure. Null when the reading is not current — see `isVerifiedCurrent` — so the
	// reported rate takes the hero slot and this pool cannot show a days-old number as today's.
	baseApy: number | null
	// The last reading when it was too old to be the hero; shown a tier down, dated.
	lastVerifiedApy: number | null
	current: boolean
	exitHeadline: string
	exitDetail: string
	// The amount that could leave right now, from the verified exit measurement.
	withdrawableUsd: number | null
	// 0..1 share of measured deposits that can exit now. Null on an uncapped queue, which is a
	// different claim from zero: there is no instant lane to measure.
	withdrawableFraction: number | null
	// Persistent discount against the reported rate. Signed: only a positive value is a fee the
	// holder pays, and exactly one pool currently shows one.
	feeBps: number | null
}

// Keep the section and evidence drawer on one interpretation of the API. Null stays null: the
// headline never fills a missing measurement from the reported feed.
export function buildVerifiedSnapshot(
	verified: VerifiedBlock,
	windows: Array<VerifiedWindowRow>,
	now: number = Date.now()
): VerifiedSnapshotModel {
	const daily = windows.find((row) => row.label === '24h') ?? null
	const reading = daily?.verified ?? verified.apy.avg_1d
	const current = isVerifiedCurrent(verified.apy_as_of, now)
	const baseApy = current ? reading : null
	// The dollar figure gets its own row on an instant lane, so the detail carries the share instead.
	const withdrawable = verified.exit?.status === 'instant' && verified.exit_liquidity?.usd != null
	return {
		baseApy,
		lastVerifiedApy: current ? null : reading,
		current,
		// Shared wording with the earn table; an absent exit block means nothing was probed.
		exitHeadline: exitHeadline(verified) ?? '—',
		exitDetail: withdrawable ? exitShareLine(verified) : (exitCoverageLine(verified) ?? 'Exit not measured'),
		withdrawableUsd: verified.exit_liquidity?.usd ?? null,
		withdrawableFraction: withdrawableFraction(verified),
		feeBps: verified.exit?.fee_bps ?? null
	}
}

const VALUE_CLS = 'ml-auto mono-md-bold'
const SUB_VALUE_CLS = 'ml-auto mono-md'
/* Prose belongs in the body face. Passed explicitly because a `body-*` utility sets size and
   weight only, so a span nested in a mono value would still inherit JetBrains Mono. */
const NOTE_VALUE_CLS = 'ml-auto max-w-[65%] body-sm text-secondary text-right'

/* No dividers inside the section: the next block's top border closes it. MetricRow has no
   borderless variant, hence the structural `border-none`. */
function Metric({
	label,
	tooltip,
	value,
	valueClassName = VALUE_CLS,
	sub = null
}: {
	label: string
	tooltip: string
	value: ReactNode
	/** Set to the prose class when the row carries a sentence rather than a figure. */
	valueClassName?: string
	/** Supporting line under the figure. Omitted when the API has nothing to add. */
	sub?: ReactNode
}) {
	return (
		<div className="py-0.5">
			<MetricRow
				label={label}
				tooltip={tooltip}
				value={value}
				valueClassName={valueClassName}
				className="border-none"
			/>
			{sub}
		</div>
	)
}

export interface MeasuredApyPart {
	key: string
	label: string
	/** Where the figure comes from, in its own column so the legs line up, as in the table's card. */
	provenance?: string
	value: string
	strong: boolean
}

/** The measured supply composition: the table cell's split, on the pool page. */
export interface MeasuredComposition {
	total: number
	parts: Array<MeasuredApyPart>
}

/* An inset well inside the summary card, not a second card: a low tint of the product's positive
   hue plus grain, no border or shadow of its own. Rows reuse MetricRow so the label/value rhythm
   matches the pool's own stats directly above, and everything interactive stays quiet: the
   evidence trigger is a ghost control, since a branded button would put blue inside a green well. */
export function VerifiedSection({
	verified,
	snapshot,
	composition = null
}: {
	verified: VerifiedBlock
	snapshot: VerifiedSnapshotModel
	composition?: MeasuredComposition | null
}) {
	const hiddenFee = snapshot.feeBps != null && snapshot.feeBps > 0 ? snapshot.feeBps : null
	// Only a real dollar figure earns the row. On a queue the ETA above already said it.
	const withdrawable = snapshot.withdrawableUsd != null && verified.exit?.status === 'instant'

	return (
		<section className="flex flex-col gap-2 border-t border-subtle pt-2.5">
			<div className="flex items-center justify-between gap-3">
				<h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
					<SealGlyph size={15} className={snapshot.current ? 'text-verified' : 'text-tertiary'} />
					Verified APY
					{/* Freshness is always on show: quiet when current, amber and named when the reading is old. */}
					{verified.apy_as_of ? (
						<RelativeTime
							value={verified.apy_as_of}
							prefix={snapshot.current ? undefined : 'Last measured'}
							className={`body-sm font-normal ${snapshot.current ? 'text-tertiary' : 'text-warning'}`}
						/>
					) : null}
				</h3>
				{/* A jump to the receipts further down the page. A link, not a control: solid underline,
				    since the dotted one is the section's tooltip affordance. */}
				<a
					href={`#${HOW_WE_VERIFY_ID}`}
					className="body-sm text-secondary underline underline-offset-2 hover:text-primary focus-visible:text-primary"
				>
					How we verify
				</a>
			</div>

			{/* Mid widths follow the reported stats below: two columns so a label and its figure stay within
			    reading distance, back to one when the card is the narrow rail beside the charts. */}
			<div className="grid grid-cols-1 items-start gap-x-6 @min-[40rem]:grid-cols-2 @min-[90rem]:grid-cols-1">
				<MeasuredMetric
					label="APY"
					value={
						composition
							? formatPercent(composition.total, YIELD_PERCENT_OPTIONS)
							: snapshot.baseApy != null
								? formatPercent(snapshot.baseApy, YIELD_PERCENT_OPTIONS)
								: snapshot.lastVerifiedApy != null
									? formatPercent(snapshot.lastVerifiedApy, YIELD_PERCENT_OPTIONS)
									: '—'
					}
					parts={composition?.parts}
					stale={!snapshot.current}
					asOf={verified.apy_as_of}
					note={verified.apy_note}
				/>
				<Metric
					label="Exit"
					tooltip="What happened when the withdrawal was actually executed on-chain, at that day's block."
					value={snapshot.exitHeadline}
					sub={
						hiddenFee == null ? (
							<SubMetricRow
								label="Detail"
								value={snapshot.exitDetail}
								valueClassName={NOTE_VALUE_CLS}
								className="border-none"
							/>
						) : (
							<SubMetricRow
								label="Exit fee"
								value={`${formatNumber(hiddenFee, { maximumFractionDigits: 2 })} bps`}
								valueClassName={`${SUB_VALUE_CLS} text-(--yield-warning-text)`}
								className="border-none"
							/>
						)
					}
				/>
				{withdrawable ? (
					<Metric
						label="Withdrawable now"
						tooltip="The most that could leave immediately, measured on-chain rather than quoted."
						value={formatUsd(snapshot.withdrawableUsd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '—'}
					/>
				) : null}
			</div>
		</section>
	)
}

/**
 * A measured value with its own freshness on hover. Per figure, not per section: the APY and exit
 * stamps run a median 10h apart, so one shared timestamp would be wrong for one of them.
 */
function MeasuredMetric({
	label,
	value,
	asOf,
	note,
	parts,
	stale = false
}: {
	label: string
	value: string
	asOf: string | null
	note?: string | null
	parts?: Array<MeasuredApyPart> | undefined
	/** The figure is the last reading, not a current one: drawn a tier down and dated as old. */
	stale?: boolean
}) {
	const content =
		asOf || note ? (
			<span className="flex max-w-72 flex-col gap-1">
				{/* Hydration-safe: absolute date on the server, ticking relative text after mount. */}
				{asOf ? (
					<RelativeTime
						value={asOf}
						prefix={stale ? 'Last measured' : 'Measured'}
						{...(stale ? { className: 'text-warning' } : {})}
					/>
				) : null}
				{note ? <span>{note}</span> : null}
			</span>
		) : null

	const figure = content ? (
		<Hovercard className="ml-auto w-fit" contentClassName="p-3" content={content}>
			<span className={`${VALUE_CLS} underline decoration-dotted ${stale ? 'text-tertiary' : ''}`.trim()}>{value}</span>
		</Hovercard>
	) : (
		value
	)

	if (parts?.length) {
		return (
			<MetricSection label={label} value={figure} valueClassName="ml-auto" className="[&>summary]:border-none">
				{parts.map((part) => (
					<SubMetricRow
						key={part.key}
						label={part.label}
						value={part.value}
						extra={
							part.provenance ? (
								<span
									className={`ml-auto w-[4.5rem] body-md ${part.provenance === 'verified' ? 'text-primary' : 'text-secondary'}`}
								>
									{part.provenance}
								</span>
							) : undefined
						}
						valueClassName={`${part.provenance ? 'mono-md' : SUB_VALUE_CLS}${part.strong ? ' text-(--yield-reward-text)' : ''}`}
					/>
				))}
			</MetricSection>
		)
	}

	return <MetricRow label={label} className="border-none" value={figure} />
}

/**
 * The locked stand-in for the verified block: the section's header, the APY row with its value
 * withheld, and a caption beside the unlock button. Two lines, like the subscriber's first two rows,
 * so the chart beside the card — which takes the card's height — is the same size for both readers.
 * The feature's explanation is the announcement strip above the page and the help icon here.
 */
export function LockedVerifiedSection() {
	const { show, modal } = useSubscribeProModal('verified-yields', 'pool-page')
	return (
		// The modal sits outside the section: inside a `flex flex-col gap-2` it would be another item.
		<>
			<section className="flex flex-col gap-2 border-t border-subtle pt-2.5">
				<div className="flex items-center justify-between gap-3">
					<h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
						<SealGlyph size={15} />
						Verified APY
						<QuestionHelper text="Every day we simulate a real holder withdrawing from this pool on-chain and record what they actually received: the base yield an exit paid, whether it went through, how long it took and what it cost." />
					</h3>
					<span className="shrink-0 rounded-md bg-brand-muted px-1.5 py-0.5 label-xs tracking-widest text-link">
						PRO
					</span>
				</div>
				<div className="grid grid-cols-1 items-start gap-x-6 @min-[40rem]:grid-cols-2 @min-[90rem]:grid-cols-1">
					<MetricRow
						label="APY"
						className="border-none"
						value={
							<span className="flex items-center gap-1.5">
								<Icon name="lock" height={12} width={12} className="shrink-0 text-tertiary" aria-hidden />
								<span aria-label="hidden">•••</span>
							</span>
						}
					/>
					{/* Two fixed columns, not a wrapping row: the caption can never push the button onto its own
					    line, and the line keeps the metric row's height so the block reads as two even rows. */}
					<div className="grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1">
						<span className="body-sm whitespace-nowrap text-tertiary">Also exit.</span>
						<Button type="button" variant="primary" size="sm" onClick={show}>
							Unlock Verified APY
						</Button>
					</div>
				</div>
			</section>
			{modal}
		</>
	)
}
