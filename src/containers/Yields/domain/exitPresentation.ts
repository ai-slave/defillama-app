// Wording for a pool's measured exit, shared by the earn table's Exit column, the APY card and the
// pool page so they cannot drift.

import { formatUsd } from '~/utils/numberFormat'
import { withdrawableFraction } from '../data/exit'
import type { VerifiedBlock, VerifiedExit } from '../data/types'

/**
 * "~11d" / "~4h" / "~30m" compact, "~11 days" / "~4 hours" / "~30 min" long.
 *
 * Coarse on purpose: an exit ETA is an estimate and false precision reads as a promise. Queues
 * in the data run from exactly 1 day to 30, so anything at or past a day reads in days ("~1
 * day", never "~24 hours").
 */
export function humanizeEta(seconds: number | null, options?: { compact?: boolean }): string | null {
	if (seconds == null || seconds <= 0) return null
	const compact = options?.compact ?? false
	const minutes = Math.round(seconds / 60)
	if (minutes < 60) return compact ? `~${minutes}m` : `~${minutes} min`
	if (seconds < 86_400) {
		const hours = Math.round(seconds / 3600)
		return compact ? `~${hours}h` : `~${hours} ${hours === 1 ? 'hour' : 'hours'}`
	}
	const days = Math.round(seconds / 86_400)
	return compact ? `~${days}d` : `~${days} ${days === 1 ? 'day' : 'days'}`
}

/** Fraction 0..1 as a whole percentage, for the partial-exit label. */
export function withdrawablePct(fraction: number | null): number | null {
	return fraction == null ? null : Math.round(fraction * 100)
}

/** Whole-percentage label which keeps a small positive share distinct from a measured zero. */
export function withdrawablePctLabel(fraction: number | null): string | null {
	const pct = withdrawablePct(fraction)
	if (pct == null) return null
	if (fraction != null && fraction > 0 && pct === 0) return '<1%'
	return `${pct}%`
}

// Same compact-dollar policy as the pool page's YIELD_USD_OPTIONS, duplicated because the domain
// layer must not depend on page-level display config.
const COVERAGE_USD_OPTIONS = { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const

/**
 * The one-line answer to "can I exit today?": what a single exit is covered up to, or why no such
 * figure exists. Shared by the pool page's verified well and the earn table's exit hovercard so
 * the two can never drift on wording.
 */
export function exitCoverageLine(verified: VerifiedBlock): string | null {
	const exit = verified.exit
	if (!exit) return null
	if (exit.status === 'blocked') return 'Latest withdrawal simulation reverted'
	if (exit.status === 'unavailable') return 'No usable exit path right now'
	// The dust figure is evidence for the pool page, never the headline: it would read as "$0.0018 withdrawable".
	if (exit.status === 'depleted')
		return 'Nothing meaningful can be withdrawn right now: the instant lane holds under 0.1% of deposits. Leaving means selling on a secondary market.'
	if (exit.status === 'queued') {
		// A null amount beside a queue is an UNCAPPED queue (no instant lane), never zero.
		return verified.exit_liquidity?.amount == null
			? 'Uncapped queue: no instant lane, takes any size'
			: 'Withdrawal queue measured onchain'
	}
	// Null (RPC failure) or an unknown status is not a claim about the pool; never read it as a working exit.
	if (exit.status !== 'instant' && exit.status !== 'partial') return 'Exit could not be attested on the last check'
	const availableUsd = verified.exit_liquidity?.usd ?? null
	if (availableUsd == null) {
		// An instant exit with no dollar figure is a lane whose SIZE was never measured — the
		// withdrawal itself went through. Never render this state as "$0 withdrawable".
		return exit.status === 'instant'
			? 'Exited instantly when measured; size limit not measured'
			: 'Only part of deposits can exit now'
	}
	const covers = `Covers any exit up to ${formatUsd(availableUsd, COVERAGE_USD_OPTIONS)} today`
	// Partial's own status label already carries the percentage, so the pool share rides only on
	// an instant exit.
	if (exit.status !== 'instant') return covers
	const pct = withdrawablePct(withdrawableFraction(verified))
	return pct == null ? covers : `${covers} · ${pct}% of pool`
}

/** "100% of pool withdrawable at once": for an instant lane whose dollar figure is shown elsewhere. */
export function exitShareLine(verified: VerifiedBlock): string {
	const pct = withdrawablePct(withdrawableFraction(verified))
	return pct == null ? 'Instant lane measured onchain' : `${pct}% of pool withdrawable at once`
}

/**
 * Headline token: "Instant", "Partial 40%", "Queued ~3 days" ("~3d" compact), "Unavailable",
 * "Blocked". Every status names itself; a magnitude follows where there is one. Null for a null or
 * unrecognized status rather than a guess in either direction.
 */
export function exitHeadline(verified: VerifiedBlock, options?: { compact?: boolean }): string | null {
	const exit = verified.exit
	switch (exit?.status) {
		case 'instant':
			return 'Instant'
		case 'partial': {
			const label = withdrawablePctLabel(withdrawableFraction(verified))
			return label == null ? 'Partial' : `Partial ${label}`
		}
		case 'depleted':
			// Names the reader's outcome, like Blocked and Unavailable, rather than the pool's buffer.
			return 'No liquidity'
		case 'queued': {
			const eta = humanizeEta(exit.eta_seconds, options)
			return eta == null ? 'Queued' : `Queued ${eta}`
		}
		case 'unavailable':
			return 'Unavailable'
		case 'blocked':
			return 'Blocked'
		default:
			return null
	}
}

/**
 * "Instant exit", "Queued exit ~7 days", "Partial exit 20% withdrawable", "Exit blocked".
 * Shared by the APY cell's card and the Exit column's tooltip so the two cannot word it differently.
 */
export function exitStatusLine(verified: VerifiedBlock): string {
	const exit = verified.exit
	if (exit?.status === 'queued') {
		const eta = humanizeEta(exit.eta_seconds)
		return eta ? `Queued exit ${eta}` : 'Queued exit'
	}
	if (exit?.status === 'partial') {
		const fraction = withdrawableFraction(verified)
		const label = withdrawablePctLabel(fraction)
		// The server already demotes a dust lane to `depleted`; whatever is still "partial" is a real
		// size boundary, so the share is stated as-is, "<1%" included.
		return label == null ? 'Partial exit' : `Partial exit ${label} withdrawable`
	}
	if (exit?.status === 'depleted') return 'No exit liquidity'
	if (exit?.status === 'blocked') return 'Exit blocked'
	if (exit?.status === 'unavailable') return 'Exit unavailable'
	if (exit?.status === 'instant') return 'Instant exit'
	return 'Exit not attested'
}

export type ExitTone = 'good' | 'neutral' | 'warning' | 'bad'

/**
 * A queue is a fact about the pool's design, not a warning, so it stays neutral. A partial lane is
 * a warning: some deposits could leave, not all. Only a revert or a closed door is bad on its own.
 */
export function exitStatusTone(status: VerifiedExit['status']): ExitTone {
	if (status === 'blocked' || status === 'unavailable' || status === 'depleted') return 'bad'
	if (status === 'partial') return 'warning'
	return status === 'instant' ? 'good' : 'neutral'
}

/** The tone for a block. Depletion is decided server-side (see `depleted`), so nothing is re-judged here. */
export function exitTone(verified: VerifiedBlock): ExitTone {
	return exitStatusTone(verified.exit?.status)
}

/** Tone colors ride on the status ICON. Text keeps the table's own colors so a column of exits does not become a column of colors. */
export const EXIT_TONE_CLASS: Record<ExitTone, string> = {
	good: 'text-success',
	neutral: 'text-secondary',
	warning: 'text-warning',
	bad: 'text-error'
}

/**
 * A measured fee is a warning, not a footnote: it comes straight out of what the holder
 * received. Only a fee the holder actually PAYS earns the warning, because the measurement also
 * returns small negative values (dust in the holder's favor) and flagging those would be a
 * false alarm. Returns null when there is nothing to warn about.
 */
export function exitFeeWarning(feeBps: number | null): string | null {
	if (feeBps == null || feeBps <= 0) return null
	// Trim float dust without implying basis-point precision we don't have.
	const rounded = Math.round(feeBps * 100) / 100
	return `exit fee ~${rounded} bps, measured`
}
