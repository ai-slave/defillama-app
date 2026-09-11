import { type ReactNode, useState } from 'react'
import { ChartPanel } from '~/ui/ChartPanel'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { formatNumber, formatUsd } from '~/utils/numberFormat'
import type { VerifiedBlock } from '../data/types'
import {
	EXIT_OUTCOME_LABELS,
	type ExitIncident,
	type ExitReliabilityModel,
	type ExitStripKind,
	exitFailures
} from './exitReliability'
import type { DetailHolders } from './types'
import { useAnchorScroll } from './useAnchorScroll'
import { CHART_SECTION_HEIGHT } from './VerifiedApyPanel'

export const EXIT_STATUS_ID = 'exit-status'

// The crowding note shows raw dollar figures, small pools included, so the compact threshold sits
// at 1k rather than the charts' 1m.
const RECEIPT_USD = { compact: true, minimumCompactValue: 1000, compactSuffix: 'lowercase' } as const

// A revert is a failure, a partial fill is a shortfall, and an unmeasured day is a hole in our own
// coverage. Three different claims, so three different tones — never one "bad" red.
const INCIDENT_TONE: Record<ExitStripKind, string> = {
	full: 'text-secondary',
	queued: 'text-secondary',
	partial: 'text-warning',
	liquidity: 'text-(--yield-negative-text)',
	blocked: 'text-(--yield-negative-text)',
	no_exit: 'text-tertiary',
	unmeasured: 'text-tertiary'
}

const INCIDENT_DOT: Record<ExitStripKind, string> = {
	full: 'bg-(--yield-positive-text)',
	queued: 'bg-(--yield-positive-text)',
	partial: 'bg-(--yield-warning-text)',
	liquidity: 'bg-(--yield-negative-text)',
	blocked: 'bg-(--yield-negative-text)',
	no_exit: 'bg-(--text-tertiary) opacity-60',
	unmeasured: 'bg-(--text-tertiary) opacity-60'
}

// Past ten rows the list stops being readable at a glance and starts being a log. The count in the
// header stays honest either way, so nothing is hidden — only folded.
const VISIBLE_INCIDENTS = 10

// Narrows to the specific claim when the history is homogeneous.
function cleanClaim({ fullDays, queuedDays }: { fullDays: number; queuedDays: number }): string {
	if (!queuedDays) return 'went through in full'
	if (!fullDays) return 'were accepted into the queue'
	return "followed the pool's available exit path"
}

function day(date: string): string {
	return formatDate(date) ?? date
}

function count(value: number): string {
	return formatNumber(value, { maximumFractionDigits: 0 }) ?? String(value)
}

/**
 * "Did the exit work, and when didn't it?" Every failure over the whole measured history is a row
 * with a date, a duration and the on-chain receipt from that block — no score, no model. A pool
 * with four bad days in four years hides them under any time-proportional encoding, so this lists
 * them instead of plotting them.
 */
export function ExitReliabilityPanel({
	model,
	verified,
	holders,
	children
}: {
	model: ExitReliabilityModel
	// Current-state block for the crowding note. Null hides it.
	verified: VerifiedBlock | null
	// Top-holder shares for the crowding note. Null hides it.
	holders: DetailHolders | null
	/** The exit history chart, when the page has history for it. */
	children?: ReactNode
}) {
	useAnchorScroll(EXIT_STATUS_ID)
	const [expanded, setExpanded] = useState(false)
	// Failures only; coverage gaps and no-mechanism days are footnotes outside the ratio.
	const failures = exitFailures(model.incidents)
	const gaps = model.incidents.filter((incident) => incident.kind === 'unmeasured')
	const noExit = model.incidents.filter((incident) => incident.kind === 'no_exit')
	const shown = expanded ? failures : failures.slice(0, VISIBLE_INCIDENTS)
	const folded = failures.length - shown.length

	return (
		<ChartPanel id={EXIT_STATUS_ID} className="@container scroll-mt-4">
			{children ? (
				<div className={`flex ${CHART_SECTION_HEIGHT} flex-col border-b border-subtle`}>{children}</div>
			) : null}

			<div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 pt-3">
				<h3 className="label-lg text-primary">Exit status</h3>
				<span className="ml-auto mono-sm text-tertiary">Measured since {day(model.measuredSince)}</span>
			</div>
			<Verdict model={model} />

			{failures.length > 0 ? (
				<>
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-subtle bg-surface-elevated-1 px-3 py-2">
						<span className="label-sm text-primary">
							{count(failures.length)} {failures.length === 1 ? 'interruption' : 'interruptions'}
						</span>
						<Tooltip
							content="What could have been withdrawn immediately, against total deposits, both measured on-chain at that day's block."
							className="ml-auto"
						>
							<span className="body-sm text-tertiary underline decoration-dotted">
								Withdrawable / deposits, measured at that block
							</span>
						</Tooltip>
					</div>
					<ul className="flex flex-col">
						{shown.map((incident) => (
							<IncidentRow key={`${incident.from}-${incident.outcome}`} incident={incident} />
						))}
					</ul>
					{folded > 0 ? (
						<button
							type="button"
							onClick={() => setExpanded(true)}
							className="border-t border-subtle px-3 py-2 text-left body-sm text-link hover:underline focus-visible:focus-ring"
						>
							{`Show ${count(folded)} older ${folded === 1 ? 'interruption' : 'interruptions'}`}
						</button>
					) : null}
				</>
			) : (
				// The empty ledger IS the claim, so it gets the panel's one tinted block rather than
				// the grey shrug an empty state usually earns.
				<div className="flex flex-col gap-0.5 border-t border-subtle bg-(--yield-verified-badge) px-3 py-3">
					<p className="label-sm text-(--yield-positive-text)">Nothing to report.</p>
					<p className="body-sm text-secondary">
						{`We asked this contract for a withdrawal on all ${count(model.measuredDays)} measured days. All of them ${cleanClaim(model)}.`}
					</p>
				</div>
			)}

			{noExit.length > 0 ? <NoExitNote days={model.noExitDays} first={noExit[noExit.length - 1].from} /> : null}
			{gaps.length > 0 ? <CoverageNote gaps={gaps} days={model.gapDays} /> : null}
			{verified ? <CrowdingNote verified={verified} holders={holders} /> : null}
		</ChartPanel>
	)
}

function Verdict({
	model
}: {
	model: Pick<ExitReliabilityModel, 'measuredDays' | 'fullDays' | 'queuedDays' | 'lastInterruptionDaysAgo'>
}) {
	const clean = model.fullDays + model.queuedDays
	return (
		<div className="flex flex-col gap-1 px-3 py-3">
			<div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
				<span className="mono-xl text-(--yield-positive-text)">
					{count(clean)} / {count(model.measuredDays)}
				</span>
				<span className="body-sm text-secondary">
					withdrawals we simulated <strong className="font-semibold text-primary">{cleanClaim(model)}</strong>
				</span>
			</div>
			<p className="body-sm text-tertiary">
				{model.lastInterruptionDaysAgo == null
					? 'No interruption has ever been measured on this pool.'
					: `Last one that didn't: ${model.lastInterruptionDaysAgo} days ago.`}
			</p>
		</div>
	)
}

function NoExitNote({ days, first }: { days: number; first: string }) {
	return (
		<p className="border-t border-subtle px-3 py-2 body-sm text-tertiary">
			{`No exit mechanism existed on ${count(days)} ${days === 1 ? 'day' : 'days'} from ${day(first)} — there was no withdrawal to attempt, so those days are outside the count above.`}
		</p>
	)
}

function CoverageNote({ gaps, days }: { gaps: Array<ExitIncident>; days: number }) {
	const named = gaps.slice(0, 3).map((gap) => day(gap.from))
	const rest = gaps.length - named.length
	return (
		<p className="border-t border-subtle px-3 py-2 body-sm text-tertiary">
			{`No measurement on ${count(days)} ${days === 1 ? 'day' : 'days'} here (${named.join(', ')}${
				rest > 0 ? ` and ${count(rest)} more` : ''
			}) — a gap in our coverage, not a failed withdrawal.`}
		</p>
	)
}

function IncidentRow({ incident }: { incident: ExitIncident }) {
	const receipt =
		incident.availableUsd == null || incident.tvlUsd == null
			? null
			: `${formatUsd(incident.availableUsd, RECEIPT_USD)} of ${formatUsd(incident.tvlUsd, RECEIPT_USD)}`
	return (
		<li className="grid grid-cols-[7px_auto_auto_1fr] items-baseline gap-x-3 gap-y-0.5 border-t border-subtle px-3 py-1.5 @min-[36rem]:grid-cols-[7px_6.5rem_4rem_1fr_auto]">
			<span className={`size-[7px] shrink-0 self-center rounded-full ${INCIDENT_DOT[incident.kind]}`} aria-hidden />
			<span className="mono-sm text-primary">{day(incident.from)}</span>
			<span className="mono-sm text-secondary">
				{incident.days} {incident.days === 1 ? 'day' : 'days'}
			</span>
			<span className={`label-sm ${INCIDENT_TONE[incident.kind]}`}>
				{incident.outcome ? EXIT_OUTCOME_LABELS[incident.outcome] : 'Not measured'}
			</span>
			{receipt ? (
				<span className="col-start-2 mono-sm text-tertiary @min-[36rem]:col-start-5 @min-[36rem]:text-right">
					{receipt}
				</span>
			) : null}
		</li>
	)
}

// "Does the exit work for MY size, today?" — the user's position against the latest measured
// lane. Pure arithmetic on the same on-chain check the rest of the panel reports; the verdict
// changes with the amount, never with a model.
function CrowdingNote({ verified, holders }: { verified: VerifiedBlock; holders: DetailHolders | null }) {
	const availableUsd = verified.exit_liquidity?.usd ?? null
	const tvlUsd = verified.tvl?.usd ?? null
	const status = verified.exit?.status
	const shares = (holders?.top_10_holders?.holders ?? [])
		.map((holder) => holder.share_pct)
		.filter((share): share is number => share != null)
	if (availableUsd == null || tvlUsd == null || shares.length === 0) return null
	if (status !== 'instant' && status !== 'partial') return null

	const largestUsd = (Math.max(...shares) / 100) * tvlUsd
	const top10Usd = (shares.reduce((sum, share) => sum + share, 0) / 100) * tvlUsd
	const largestCovered = largestUsd <= availableUsd
	const top10Covered = top10Usd <= availableUsd

	return (
		<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-subtle px-3 py-2">
			<Tooltip content="Each holder's share of the receipt supply times total deposits, compared against the measured instant lane. Positions are point-in-time and holders rarely exit together — this flags concentration against capacity, not a prediction.">
				<span className="label-xs tracking-widest text-tertiary underline decoration-dotted">CROWDING</span>
			</Tooltip>
			<span className={`body-sm ${largestCovered ? 'text-secondary' : 'text-warning'}`}>
				{largestCovered
					? `The largest holder (${formatUsd(largestUsd, RECEIPT_USD)}) could exit in full today.`
					: `The largest holder's ${formatUsd(largestUsd, RECEIPT_USD)} position exceeds today's ${formatUsd(
							availableUsd,
							RECEIPT_USD
						)} lane.`}
			</span>
			<span className={`body-sm ${top10Covered ? 'text-secondary' : 'text-warning'}`}>
				{top10Covered
					? `The top 10 combined (${formatUsd(top10Usd, RECEIPT_USD)}) fit inside today's lane.`
					: `The top 10 combined (${formatUsd(top10Usd, RECEIPT_USD)}) exceed today's lane.`}
			</span>
		</div>
	)
}
