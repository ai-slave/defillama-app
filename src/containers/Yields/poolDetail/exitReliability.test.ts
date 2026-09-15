import { describe, expect, test } from 'vitest'
import { formatPercent } from '~/utils/numberFormat'
import {
	buildExitReliability,
	type ExitIncident,
	exitFailures,
	exitStripKind,
	incidentWithdrawableShare,
	isMeasuredKind
} from './exitReliability'
import type { PoolHistoryPoint, VerifiedExitOutcome } from './types'

const DAY_MS = 86_400_000
const START = Date.UTC(2026, 0, 1)

function iso(offset: number): string {
	return new Date(START + offset * DAY_MS).toISOString().slice(0, 10)
}

function day(
	date: string,
	outcome: VerifiedExitOutcome | null,
	extra?: { availableUsd?: number | null; tvlUsd?: number | null; apy1d?: number | null }
): PoolHistoryPoint {
	return {
		date,
		tvl_usd: null,
		apy: {
			avg_1d: { base: null, reward: null, total: null },
			avg_7d: { base: null, reward: null, total: null },
			avg_30d: { base: null, reward: null, total: null }
		},
		intrinsic: null,
		price_per_share: null,
		verified: {
			apy: { avg_1d: extra?.apy1d ?? null, avg_7d: null, avg_30d: null },
			price_per_share: null,
			liquidity_available: null,
			tvl: null,
			liquidity_available_usd: extra?.availableUsd ?? null,
			tvl_usd: extra?.tvlUsd ?? null,
			exit: outcome ? { outcome } : null
		}
	}
}

describe('exitStripKind', () => {
	test('maps every outcome to a strip colour, and unknown ones to grey', () => {
		expect(exitStripKind('ok_full')).toBe('full')
		expect(exitStripKind('ok_partial')).toBe('partial')
		expect(exitStripKind('delayed')).toBe('queued')
		expect(exitStripKind('no_exit_primary')).toBe('no_exit')
		expect(exitStripKind('reverted_liquidity')).toBe('liquidity')
		expect(exitStripKind('reverted_paused')).toBe('blocked')
		expect(exitStripKind('reverted_unknown')).toBe('blocked')
		expect(exitStripKind('error_rpc')).toBe('unmeasured')
		expect(exitStripKind('unmeasured')).toBe('unmeasured')
		expect(exitStripKind(null)).toBe('unmeasured')
		expect(exitStripKind('brand_new_outcome' as VerifiedExitOutcome)).toBe('unmeasured')
	})
})

describe('buildExitReliability', () => {
	test('returns null when no day was ever measured', () => {
		expect(buildExitReliability([])).toBeNull()
		expect(buildExitReliability([day(iso(0), null), day(iso(1), 'error_rpc'), day(iso(2), 'unmeasured')])).toBeNull()
	})

	test('counts measured days over the whole history and lists every other day as an incident', () => {
		const model = buildExitReliability([
			day(iso(0), 'unmeasured'), // before the first measured day: excluded entirely
			day(iso(1), 'ok_full'),
			day(iso(2), 'ok_partial'),
			day(iso(3), 'delayed'),
			day(iso(4), 'reverted_liquidity'),
			day(iso(5), 'reverted_paused'),
			day(iso(6), 'error_rpc'), // a hole in our coverage, not a failure
			day(iso(7), 'ok_full')
		])

		expect(model?.measuredSince).toBe(iso(1))
		expect(model?.measuredDays).toBe(6)
		expect(model?.fullDays).toBe(2)
		expect(model?.queuedDays).toBe(1)
		// Newest first, and a queued day is the pool keeping its promise rather than an interruption.
		expect(model?.incidents.map((i) => [i.from, i.kind])).toEqual([
			[iso(6), 'unmeasured'],
			[iso(5), 'blocked'],
			[iso(4), 'liquidity'],
			[iso(2), 'partial']
		])
		// The last failure is the paused day at offset 5, two calendar days before the last row.
		expect(model?.lastInterruptionDaysAgo).toBe(2)
	})

	/*
	 * The ledger's accounting rule: the numerator plus every MEASURED incident day equals the
	 * denominator. Coverage gaps sit outside the ratio, so they must not be counted into it —
	 * otherwise the header cannot be reconciled with the verdict above it, which is the exact
	 * flaw this design replaced.
	 */
	test('accounts for every measured day the numerator misses, gaps excluded', () => {
		const model = buildExitReliability([
			day(iso(0), 'ok_full'),
			day(iso(1), 'ok_partial'),
			day(iso(2), 'ok_partial'),
			day(iso(3), 'reverted_liquidity'),
			day(iso(4), 'error_rpc'), // a hole in our coverage, outside the ratio
			day(iso(5), 'no_exit_primary'), // no mechanism existed, also outside it
			day(iso(6), 'delayed'),
			day(iso(7), 'ok_full')
		])!

		const measuredIncidentDays = model.incidents
			.filter((incident) => isMeasuredKind(incident.kind))
			.reduce((sum, incident) => sum + incident.days, 0)

		expect(model.fullDays + model.queuedDays + measuredIncidentDays).toBe(model.measuredDays)
		// Three distinct non-measured states, counted apart: a hole in OUR coverage, and a day the
		// protocol had no redemption mechanism at all. Collapsing them blames us for its history.
		expect(model.gapDays).toBe(1)
		expect(model.noExitDays).toBe(1)
		// Both classes still earn a row — a reader wants to see a gap, just not counted as a failure.
		expect(model.incidents).toHaveLength(4)
		expect(exitFailures(model.incidents)).toHaveLength(2)
	})

	test('groups consecutive days with the same outcome into one incident', () => {
		const model = buildExitReliability([
			day(iso(0), 'ok_full'),
			day(iso(1), 'reverted_liquidity'),
			day(iso(2), 'reverted_liquidity'),
			day(iso(3), 'reverted_liquidity'),
			day(iso(4), 'ok_full')
		])

		expect(model?.incidents).toHaveLength(1)
		expect(model?.incidents[0]).toMatchObject({ from: iso(1), days: 3, kind: 'liquidity' })
	})

	// Two reverts for different reasons are two different claims about the pool.
	test('starts a new incident when the reason changes', () => {
		const model = buildExitReliability([
			day(iso(0), 'ok_full'),
			day(iso(1), 'reverted_paused'),
			day(iso(2), 'reverted_liquidity'),
			day(iso(3), 'ok_full')
		])

		expect(model?.incidents.map((i) => [i.from, i.outcome])).toEqual([
			[iso(2), 'reverted_liquidity'],
			[iso(1), 'reverted_paused']
		])
	})

	test('fills calendar holes and never bridges an incident across them', () => {
		const model = buildExitReliability([
			day(iso(0), 'reverted_liquidity'),
			day(iso(1), 'reverted_liquidity'),
			// offsets 2-3 missing from the API entirely
			day(iso(4), 'reverted_liquidity'),
			day(iso(5), 'ok_full')
		])

		// A gap we did not observe is its own incident, so the run must not claim three days.
		expect(model?.incidents.map((i) => [i.from, i.days, i.kind])).toEqual([
			[iso(4), 1, 'liquidity'],
			[iso(2), 2, 'unmeasured'],
			[iso(0), 2, 'liquidity']
		])
		expect(model?.measuredDays).toBe(4)
	})

	test('carries the receipt from the incident first day', () => {
		const model = buildExitReliability([
			day(iso(0), 'ok_full'),
			day(iso(1), 'reverted_liquidity', { availableUsd: 0, tvlUsd: 10_200_000 }),
			day(iso(2), 'reverted_liquidity', { availableUsd: 5000, tvlUsd: 9_900_000 })
		])

		expect(model?.incidents[0]).toMatchObject({ days: 2, availableUsd: 0, tvlUsd: 10_200_000 })
	})

	// A queue is what that pool promises, so it is neither a pass-in-full nor an interruption.
	test('counts a queued pool as clearing rather than failing', () => {
		const model = buildExitReliability([day(iso(0), 'delayed'), day(iso(1), 'delayed'), day(iso(2), 'delayed')])

		expect(model).toMatchObject({ measuredDays: 3, fullDays: 0, queuedDays: 3, lastInterruptionDaysAgo: null })
		expect(model?.incidents).toEqual([])
	})
})

describe('no_exit_primary days', () => {
	test('stays out of the counts but still earns a row, distinct from unmeasured', () => {
		const model = buildExitReliability([
			day(iso(0), 'no_exit_primary'), // pre-redemption era: a fact, not a check
			day(iso(1), 'ok_full'),
			day(iso(2), 'no_exit_primary'),
			day(iso(3), 'unmeasured'),
			day(iso(4), 'ok_full')
		])

		// The history opens at the first CHECK, so the leading no-mechanism era is cropped.
		expect(model?.measuredSince).toBe(iso(1))
		// Only the two real withdrawal checks count; no-mechanism days are neither passes nor gaps.
		expect(model?.measuredDays).toBe(2)
		expect(model?.fullDays).toBe(2)
		// …and a no-mechanism day after it keeps its own kind, never collapsing into 'unmeasured'.
		expect(model?.incidents.map((i) => [i.from, i.kind])).toEqual([
			[iso(3), 'unmeasured'],
			[iso(2), 'no_exit']
		])
	})
})

describe('a date the API skipped', () => {
	test('counts as a coverage gap, never as a failure', () => {
		const model = buildExitReliability([day(iso(0), 'ok_full'), day(iso(2), 'ok_full')])!

		expect(model.measuredDays).toBe(2)
		expect(model.fullDays).toBe(2)
		expect(model.gapDays).toBe(1)
		expect(model.incidents.map((i) => [i.from, i.kind])).toEqual([[iso(1), 'unmeasured']])
		// The ratio still reconciles: the gap sits outside both sides of it.
		expect(model.lastInterruptionDaysAgo).toBeNull()
	})
})

// A pool can carry both instant and queued days. Both are clean by the model's own definition, so
// the verdict has to count both — scoring only the majority kind silently drops real clean days
// out of the numerator while leaving them in the denominator.
describe('mixed instant and queued histories', () => {
	test('counts every clean day, whichever exit path the pool used that day', () => {
		const model = buildExitReliability([
			day(iso(0), 'ok_full'),
			day(iso(1), 'ok_full'),
			day(iso(2), 'delayed'),
			day(iso(3), 'ok_full'),
			day(iso(4), 'ok_partial'),
			day(iso(5), 'ok_full'),
			day(iso(6), 'delayed'),
			day(iso(7), 'ok_full')
		])!

		expect(model.measuredDays).toBe(8)
		expect(model.fullDays).toBe(5)
		expect(model.queuedDays).toBe(2)
		// 5 full + 2 queued = 7 clean of 8 measured, and the one partial day is the only interruption.
		expect(model.fullDays + model.queuedDays).toBe(7)
		expect(model.incidents).toHaveLength(1)
		expect(model.incidents[0]).toMatchObject({ from: iso(4), days: 1, kind: 'partial' })
		expect(model.gapDays).toBe(0)
		expect(model.noExitDays).toBe(0)
	})
})

/*
 * The verdict's sub-line and the ledger must describe the same set of days. Tracking only outright
 * reverts left a partial-only history saying "1 interruption" above "No interruption has ever been
 * measured on this pool."
 */
describe('the verdict cannot contradict its own ledger', () => {
	test('dates the last partial exit, not just the last revert', () => {
		const model = buildExitReliability([
			day(iso(0), 'ok_full'),
			day(iso(1), 'ok_partial'),
			day(iso(2), 'ok_full'),
			day(iso(3), 'ok_full')
		])!

		expect(model.incidents).toHaveLength(1)
		// Two calendar days from the partial at offset 1 to the last day at offset 3.
		expect(model.lastInterruptionDaysAgo).toBe(2)
	})

	test('stays null only when the ledger is genuinely empty', () => {
		const clean = buildExitReliability([day(iso(0), 'ok_full'), day(iso(1), 'delayed')])!

		expect(clean.incidents).toEqual([])
		expect(clean.lastInterruptionDaysAgo).toBeNull()
	})

	// A coverage gap is not an interruption and must not date one.
	test('ignores days that carry no verdict', () => {
		const gapped = buildExitReliability([day(iso(0), 'ok_full'), day(iso(1), 'error_rpc'), day(iso(2), 'ok_full')])!

		expect(gapped.gapDays).toBe(1)
		expect(gapped.lastInterruptionDaysAgo).toBeNull()
	})

	// Every incident kind the ledger lists has to be datable by the verdict above it.
	test.each(['ok_partial', 'reverted_liquidity', 'reverted_paused'] as const)(
		'dates a %s like any other interruption',
		(outcome) => {
			const model = buildExitReliability([day(iso(0), outcome), day(iso(1), 'ok_full')])!

			expect(model.incidents.length).toBe(1)
			expect(model.lastInterruptionDaysAgo).toBe(1)
		}
	)
})

describe('incidentWithdrawableShare', () => {
	function incident(availableUsd: number | null, tvlUsd: number | null): ExitIncident {
		return { from: '2026-01-01', days: 1, kind: 'partial', outcome: 'ok_partial', availableUsd, tvlUsd }
	}

	test('divides the lane by the deposits it was measured against', () => {
		expect(incidentWithdrawableShare(incident(8650, 733_800_000))).toBeCloseTo(8650 / 733_800_000, 15)
	})

	test('keeps a measured zero, which is a finding rather than a missing number', () => {
		expect(incidentWithdrawableShare(incident(0, 1_000_000))).toBe(0)
	})

	test('has no share to state without both figures, or without deposits to divide by', () => {
		expect(incidentWithdrawableShare(incident(null, 1_000_000))).toBeNull()
		expect(incidentWithdrawableShare(incident(1000, null))).toBeNull()
		// Never Infinity.
		expect(incidentWithdrawableShare(incident(1000, 0))).toBeNull()
	})

	test('renders a vanishing lane as one honest bucket, and holds two decimals for the column', () => {
		const options = {
			input: 'fraction',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
			smallValueDisplay: 'threshold'
		} as const

		expect(formatPercent(incidentWithdrawableShare(incident(0.0000038, 889_680_000)), options)).toBe('<0.01%')
		expect(formatPercent(incidentWithdrawableShare(incident(0, 889_680_000)), options)).toBe('0.00%')
		// Trailing zeros kept so the column aligns.
		expect(formatPercent(incidentWithdrawableShare(incident(13_000_000, 100_000_000)), options)).toBe('13.00%')
		expect(formatPercent(incidentWithdrawableShare(incident(11_610_000, 100_000_000)), options)).toBe('11.61%')
		// Widest the figure gets; the column is sized for it.
		expect(formatPercent(incidentWithdrawableShare(incident(100, 100)), options)).toBe('100.00%')
		expect(formatPercent(incidentWithdrawableShare(incident(null, null)), options)).toBeNull()
	})
})
