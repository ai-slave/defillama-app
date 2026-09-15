// Exit reliability from the daily simulated-withdrawal outcomes. Rare events are listed, not
// plotted: four bad days in four years vanish under any time-proportional encoding.

import { DAY_MS, isoDay } from './poolChartUtils'
import type { PoolHistory, VerifiedExitOutcome } from './types'

// 'no_exit' is neither a failure nor a coverage gap: no redemption mechanism existed at that block.
export type ExitStripKind = 'full' | 'partial' | 'queued' | 'liquidity' | 'blocked' | 'no_exit' | 'unmeasured'

// Unknown outcomes map to 'unmeasured': a coverage hole, never an invented claim.
const OUTCOME_KIND: Record<VerifiedExitOutcome, ExitStripKind> = {
	ok_full: 'full',
	ok_partial: 'partial',
	delayed: 'queued',
	no_exit_primary: 'no_exit',
	reverted_liquidity: 'liquidity',
	reverted_paused: 'blocked',
	reverted_unknown: 'blocked',
	error_rpc: 'unmeasured',
	unmeasured: 'unmeasured'
}

export function exitStripKind(outcome: VerifiedExitOutcome | null | undefined): ExitStripKind {
	if (!outcome) return 'unmeasured'
	return OUTCOME_KIND[outcome] ?? 'unmeasured'
}

/** A day that reached a verdict, so it belongs in the pass ratio. */
export function isMeasuredKind(kind: ExitStripKind): boolean {
	return MEASURED_KINDS.has(kind)
}

const MEASURED_KINDS = new Set<ExitStripKind>(['full', 'partial', 'queued', 'liquidity', 'blocked'])
// A partial fill is not clean: it went through, but not in full.
const CLEAN_KINDS = new Set<ExitStripKind>(['full', 'queued'])

export const EXIT_OUTCOME_LABELS: Record<VerifiedExitOutcome, string> = {
	ok_full: 'Full exit',
	ok_partial: 'Partial exit only',
	delayed: 'Queued',
	no_exit_primary: 'No exit mechanism at this block',
	reverted_liquidity: 'Reverted, no liquidity',
	reverted_paused: 'Reverted, pool paused',
	reverted_unknown: 'Reverted',
	error_rpc: 'Not measured — RPC error',
	unmeasured: 'Not measured'
}

/** One unbroken run of days on which the withdrawal did not go through cleanly. */
export interface ExitIncident {
	/** First day of the run, YYYY-MM-DD UTC. */
	from: string
	days: number
	kind: ExitStripKind
	outcome: VerifiedExitOutcome | null
	availableUsd: number | null
	tvlUsd: number | null
}

/** Withdrawable as a share of deposits. Null when unmeasured or there are no deposits; a measured 0 stays 0. */
export function incidentWithdrawableShare(incident: ExitIncident): number | null {
	const { availableUsd, tvlUsd } = incident
	if (availableUsd == null || tvlUsd == null || tvlUsd <= 0) return null
	return availableUsd / tvlUsd
}

export interface ExitReliabilityModel {
	/** Days the withdrawal ran to a verdict. The denominator. */
	measuredDays: number
	/** Measured days that filled completely. */
	fullDays: number
	/** Measured days that went to a queue, which is that pool's promise rather than a failure. */
	queuedDays: number
	/**
	 * Newest first, over the full measured history. Measured kinds are failures inside the ratio;
	 * `unmeasured` and `no_exit` sit outside it.
	 * Invariant: fullDays + queuedDays + measured incident days === measuredDays.
	 */
	incidents: Array<ExitIncident>
	/** Days we failed to measure. Never in the ratio. */
	gapDays: number
	/** Days with no redemption mechanism at that block (Lido pre-Shapella). Not a failure, not a gap. */
	noExitDays: number
	/** Days since the last measured day that was not clean. Null when the ledger is empty. */
	lastInterruptionDaysAgo: number | null
	/** First measured day, YYYY-MM-DD. */
	measuredSince: string
}

function dayMs(date: string): number {
	return Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
}

/** Null when no day was ever measured. */
export function buildExitReliability(history: PoolHistory): ExitReliabilityModel | null {
	const rows = new Map<string, PoolHistory[number]>()
	let firstMeasured: number | null = null
	let lastDay: number | null = null
	for (const row of history) {
		const ms = dayMs(row.date)
		if (!Number.isFinite(ms)) continue
		rows.set(isoDay(ms), row)
		if (lastDay == null || ms > lastDay) lastDay = ms
		const kind = exitStripKind(row.verified?.exit?.outcome)
		if (isMeasuredKind(kind) && (firstMeasured == null || ms < firstMeasured)) firstMeasured = ms
	}
	if (firstMeasured == null || lastDay == null) return null

	let measuredDays = 0
	let fullDays = 0
	let queuedDays = 0
	let gapDays = 0
	let noExitDays = 0
	let lastInterruption: number | null = null
	const incidents: Array<ExitIncident> = []

	// Calendar-dense: a day the API skipped becomes an unmeasured incident.
	for (let ms = firstMeasured; ms <= lastDay; ms += DAY_MS) {
		const date = isoDay(ms)
		const verified = rows.get(date)?.verified ?? null
		const outcome = verified?.exit?.outcome ?? null
		const kind = exitStripKind(outcome)

		if (isMeasuredKind(kind)) {
			measuredDays++
			if (kind === 'full') fullDays++
			if (kind === 'queued') queuedDays++
			if (!CLEAN_KINDS.has(kind)) lastInterruption = ms
		} else if (kind === 'no_exit') {
			noExitDays++
		} else {
			gapDays++
		}

		if (CLEAN_KINDS.has(kind)) continue

		// The same outcome on the very next day extends the open run.
		const open = incidents[incidents.length - 1]
		if (open && open.outcome === outcome && dayMs(open.from) + open.days * DAY_MS === ms) {
			open.days++
			continue
		}
		incidents.push({
			from: date,
			days: 1,
			kind,
			outcome,
			availableUsd: verified?.liquidity_available_usd ?? null,
			tvlUsd: verified?.tvl_usd ?? null
		})
	}

	return {
		measuredDays,
		fullDays,
		queuedDays,
		gapDays,
		noExitDays,
		incidents: incidents.reverse(),
		lastInterruptionDaysAgo: lastInterruption == null ? null : Math.round((lastDay - lastInterruption) / DAY_MS),
		measuredSince: isoDay(firstMeasured)
	}
}

/** Measured failures only: the ledger's rows. */
export function exitFailures(incidents: Array<ExitIncident>): Array<ExitIncident> {
	return incidents.filter((incident) => isMeasuredKind(incident.kind))
}
