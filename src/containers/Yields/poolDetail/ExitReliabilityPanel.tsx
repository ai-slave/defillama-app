import { useState } from 'react'
import {
	TokenPageTable,
	TokenPageTableBodyCell,
	TokenPageTableHeaderCell,
	TokenPageTableScroller
} from '~/components/Table/helpers'
import { ChartPanel } from '~/ui/ChartPanel'
import { keepFocus } from '~/ui/focus'
import { StatusBadge, type Status } from '~/ui/StatusBadge'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { formatNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { VerifiedBlock } from '../data/types'
import { scrollIntoViewIfHashed } from './anchorScroll'
import {
	EXIT_OUTCOME_LABELS,
	type ExitIncident,
	type ExitReliabilityModel,
	type ExitStripKind,
	exitFailures,
	incidentWithdrawableShare
} from './exitReliability'
import type { DetailHolders } from './types'

export const EXIT_STATUS_ID = 'exit-status'

// The crowding note shows raw dollar figures, small pools included, so the compact threshold sits
// at 1k rather than the charts' 1m.
const RECEIPT_USD = { compact: true, minimumCompactValue: 1000, compactSuffix: 'lowercase' } as const

// Two decimals both ends so the column aligns; `smallValueDisplay` is explicit because a fixed
// minimum would otherwise disable the "<0.01%" threshold these lanes need.
const RECEIPT_SHARE = {
	input: 'fraction',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	smallValueDisplay: 'threshold'
} as const

// A revert is a failure, a partial fill is a shortfall, and an unmeasured day is a hole in our own
// coverage. Three different claims, so three different statuses — never one "bad" red.
const INCIDENT_STATUS: Record<ExitStripKind, Status> = {
	full: 'good',
	queued: 'good',
	partial: 'caution',
	liquidity: 'bad',
	blocked: 'bad',
	no_exit: 'neutral',
	unmeasured: 'neutral'
}

// Past ten rows the table reads as a log, so the rest folds; the count stays visible.
const VISIBLE_INCIDENTS = 10

// Narrows to the specific claim when the history is homogeneous.
export function cleanClaim({ fullDays, queuedDays }: { fullDays: number; queuedDays: number }): string {
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
	holders
}: {
	model: ExitReliabilityModel
	verified: VerifiedBlock | null
	holders: DetailHolders | null
}) {
	return (
		<ChartPanel id={EXIT_STATUS_ID} ref={scrollIntoViewIfHashed} className="@container scroll-mt-4">
			<ExitLedger model={model} verified={verified} holders={holders} />
		</ChartPanel>
	)
}

/** The interruptions: the table, the coverage notes and the crowding line. */
export function ExitLedger({
	model,
	verified,
	holders
}: {
	model: ExitReliabilityModel
	// Current-state block for the crowding note. Null hides it.
	verified: VerifiedBlock | null
	// Top-holder shares for the crowding note. Null hides it.
	holders: DetailHolders | null
}) {
	const [expanded, setExpanded] = useState(false)
	// Failures only; coverage gaps and no-mechanism days are footnotes outside the ratio.
	const failures = exitFailures(model.incidents)
	const gaps = model.incidents.filter((incident) => incident.kind === 'unmeasured')
	const noExit = model.incidents.filter((incident) => incident.kind === 'no_exit')
	const shown = expanded ? failures : failures.slice(0, VISIBLE_INCIDENTS)
	const folded = failures.length - shown.length

	return (
		<div className="flex min-w-0 flex-col">
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 pt-3 pb-1">
				<h3 className="label-lg text-primary">Withdrawal interruptions</h3>
				{failures.length > 0 ? (
					<span className="body-sm text-secondary">
						{`${count(failures.length)} ${failures.length === 1 ? 'episode' : 'episodes'}`}
					</span>
				) : null}
			</div>

			{failures.length > 0 ? (
				<>
					<TokenPageTableScroller>
						<TokenPageTable className="min-w-[560px] table-fixed">
							<colgroup>
								<col style={{ width: '22%' }} />
								<col style={{ width: '13%' }} />
								<col style={{ width: '29%' }} />
								<col style={{ width: '14%' }} />
								<col style={{ width: '12%' }} />
								<col style={{ width: '10%' }} />
							</colgroup>
							<thead>
								<tr className="border-t border-b border-subtle bg-surface">
									<TokenPageTableHeaderCell>Started</TokenPageTableHeaderCell>
									<TokenPageTableHeaderCell textAlign="end">Lasted</TokenPageTableHeaderCell>
									<TokenPageTableHeaderCell>Outcome</TokenPageTableHeaderCell>
									<TokenPageTableHeaderCell textAlign="end">Withdrawable</TokenPageTableHeaderCell>
									<TokenPageTableHeaderCell textAlign="end">Deposits</TokenPageTableHeaderCell>
									<TokenPageTableHeaderCell textAlign="end">
										<Tooltip
											content="What could have been withdrawn immediately, against total deposits, both measured on-chain at that day's block."
											className="ml-auto w-fit cursor-help"
											tabIndex={0}
										>
											<span className="underline decoration-dotted">Share</span>
										</Tooltip>
									</TokenPageTableHeaderCell>
								</tr>
							</thead>
							<tbody>
								{shown.map((incident) => (
									<IncidentRow key={`${incident.from}-${incident.outcome}`} incident={incident} />
								))}
							</tbody>
						</TokenPageTable>
					</TokenPageTableScroller>
					{folded > 0 ? (
						<button
							type="button"
							// The button leaves as the older rows appear: the first of them takes focus.
							onClick={(event) => {
								const table = event.currentTarget.previousElementSibling
								keepFocus(
									() => setExpanded(true),
									() => table?.querySelectorAll<HTMLElement>('tbody tr')[VISIBLE_INCIDENTS]
								)
							}}
							className="border-t border-subtle px-3 py-2 text-left body-sm text-link hover:underline"
						>
							{`Show ${count(folded)} older ${folded === 1 ? 'episode' : 'episodes'}`}
						</button>
					) : null}
				</>
			) : (
				// The empty ledger IS the claim, so it gets the panel's one tinted block rather than
				// the grey shrug an empty state usually earns.
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-subtle bg-(--yield-verified-badge) px-3 py-3">
					<p className="label-sm text-(--yield-positive-text)">
						{`No interruptions in ${count(model.measuredDays)} measured days.`}
					</p>
					<p className="body-sm text-secondary">
						{`Every day we asked this contract for a withdrawal, and all of them ${cleanClaim(model)}.`}
					</p>
				</div>
			)}

			{noExit.length > 0 ? <NoExitNote days={model.noExitDays} first={noExit[noExit.length - 1].from} /> : null}
			{gaps.length > 0 ? <CoverageNote gaps={gaps} days={model.gapDays} /> : null}
			{verified ? <CrowdingNote verified={verified} holders={holders} /> : null}
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
	const share = formatPercent(incidentWithdrawableShare(incident), RECEIPT_SHARE)
	return (
		<tr tabIndex={-1} className="border-b border-subtle last:border-b-0">
			<TokenPageTableBodyCell>
				<span className="text-primary">{day(incident.from)}</span>
			</TokenPageTableBodyCell>
			<TokenPageTableBodyCell textAlign="end">
				<span className="text-primary">
					{incident.days} {incident.days === 1 ? 'day' : 'days'}
				</span>
			</TokenPageTableBodyCell>
			<TokenPageTableBodyCell>
				<StatusBadge status={INCIDENT_STATUS[incident.kind]}>
					{incident.outcome ? EXIT_OUTCOME_LABELS[incident.outcome] : 'Not measured'}
				</StatusBadge>
			</TokenPageTableBodyCell>
			<TokenPageTableBodyCell textAlign="end">
				<span className="text-primary">
					{incident.availableUsd == null ? '—' : formatUsd(incident.availableUsd, RECEIPT_USD)}
				</span>
			</TokenPageTableBodyCell>
			<TokenPageTableBodyCell textAlign="end">
				<span className="text-primary">{incident.tvlUsd == null ? '—' : formatUsd(incident.tvlUsd, RECEIPT_USD)}</span>
			</TokenPageTableBodyCell>
			<TokenPageTableBodyCell textAlign="end">
				<span className="text-primary">{share ?? '—'}</span>
			</TokenPageTableBodyCell>
		</tr>
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
			<Tooltip
				content="Each holder's share of the receipt supply times total deposits, compared against the measured instant lane. Positions are point-in-time and holders rarely exit together — this flags concentration against capacity, not a prediction."
				className="cursor-help"
				tabIndex={0}
			>
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
