import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { applyMeasuredBase, resolveVerifiedApy } from '../apy'
import type { ApyTriple, ResolvedApy, VerifiedBlock } from '../types'

function verified(overrides: Partial<VerifiedBlock> = {}): VerifiedBlock {
	return {
		apy: { avg_1d: 1, avg_7d: 2, avg_30d: 3 },
		apy_as_of: '2026-08-10T00:00:00.000Z',
		apy_confidence: 'high',
		exit: null,
		exit_liquidity: null,
		tvl: null,
		...overrides
	}
}

describe('resolveVerifiedApy', () => {
	// Matched window for window against the reported figure it displaces: `current` reads the
	// realized 1d, never a 7d average dressed up as today's rate.
	test('reads the measured window that matches the requested one', () => {
		const row = verified()

		expect(resolveVerifiedApy(row, 'current')).toBe(1)
		expect(resolveVerifiedApy(row, 'avg_7d')).toBe(2)
		expect(resolveVerifiedApy(row, 'avg_30d')).toBe(3)
	})

	// Realized returns can be negative and a measured 0 is a real reading — neither may be
	// clamped away or mistaken for "no data".
	test('preserves negative and zero measurements', () => {
		const negative = verified({ apy: { avg_1d: -0.0000054, avg_7d: 0, avg_30d: -3 } })

		expect(resolveVerifiedApy(negative, 'current')).toBe(-0.0000054)
		expect(resolveVerifiedApy(negative, 'avg_7d')).toBe(0)
		expect(resolveVerifiedApy(negative, 'avg_30d')).toBe(-3)
	})

	test('returns null for an unmeasured pool and for a window with no reading', () => {
		expect(resolveVerifiedApy(null, 'current')).toBeNull()
		expect(resolveVerifiedApy(undefined, 'avg_7d')).toBeNull()
		expect(resolveVerifiedApy(verified({ apy: { avg_1d: null, avg_7d: null, avg_30d: null } }), 'current')).toBeNull()
	})
})

describe('applyMeasuredBase', () => {
	// The fixture reading is dated 2026-08-10; the table would judge it the morning after.
	beforeAll(() => vi.setSystemTime(new Date('2026-08-11T06:00:00Z')))
	afterAll(() => vi.useRealTimers())

	const triple = (over: Partial<ApyTriple> = {}): ApyTriple => ({ base: 2.38, reward: 0.45, total: 2.83, ...over })
	const resolved = (over: Partial<ResolvedApy> = {}): ResolvedApy => ({
		base: 2.38,
		reward: 0.45,
		intrinsic: null,
		total: 2.83,
		...over
	})

	test('replaces the base and recomposes the total from the reported reward', () => {
		const out = applyMeasuredBase(
			resolved(),
			triple(),
			verified({ apy: { avg_1d: 2.58, avg_7d: 0, avg_30d: 0 } }),
			'current',
			true
		)

		expect(out.base).toBe(2.58)
		expect(out.reward).toBe(0.45)
		expect(out.total).toBeCloseTo(3.03, 10)
		expect(out.measured).toBe(2.58)
		expect(out.reported).toBe(2.38)
	})

	// Intrinsic yield is the pool's own compounding, measured separately from the base — it rides
	// on top exactly as it does for an unmeasured pool.
	test('carries an intrinsic component through the recomposition', () => {
		const view = resolved({ base: 0.00002, reward: null, intrinsic: 2.44311, total: 2.44313 })
		const out = applyMeasuredBase(
			view,
			triple({ reward: null, total: null }),
			verified({ apy: { avg_1d: 0.00003, avg_7d: 0, avg_30d: 0 } }),
			'current',
			false
		)

		expect(out.total).toBeCloseTo(2.44314, 10)
		expect(out.intrinsic).toBe(2.44311)
	})

	// A realized return of exactly 0 is a measurement, not a missing one — it must still displace
	// the protocol's claim of a positive base.
	test('treats a measured zero as a real reading', () => {
		const out = applyMeasuredBase(
			resolved({ reward: null, total: 2.38 }),
			triple({ reward: null }),
			verified({ apy: { avg_1d: 0, avg_7d: 0, avg_30d: 0 } }),
			'current',
			false
		)

		expect(out.total).toBe(0)
		expect(out.measured).toBe(0)
		expect(out.reported).toBe(2.38)
	})

	test('passes the reported composition through when the pool is unmeasured', () => {
		const view = resolved()
		const out = applyMeasuredBase(view, triple(), null, 'current', true)

		expect(out).toEqual({
			...view,
			measured: null,
			reported: null,
			intrinsicMeasured: null,
			intrinsicReported: null,
			reportedTotal: view.total
		})
	})

	// No base slot to land in. Without reward tokens the unsplit total is base-only in fact, so
	// the swap is safe; with them it could already contain emissions we cannot separate out.
	test('replaces a rewardless unsplit total and refuses one that may hide emissions', () => {
		const unsplit = resolved({ base: null, reward: null, total: 4.52 })
		const block = verified({ apy: { avg_1d: 5.68, avg_7d: 0, avg_30d: 0 } })

		const swapped = applyMeasuredBase(
			unsplit,
			triple({ base: null, reward: null, total: 4.52 }),
			block,
			'current',
			false
		)
		expect(swapped.total).toBe(5.68)
		expect(swapped.reported).toBe(4.52)

		const refused = applyMeasuredBase(
			unsplit,
			triple({ base: null, reward: null, total: 4.52 }),
			block,
			'current',
			true
		)
		expect(refused.total).toBe(4.52)
		expect(refused.measured).toBeNull()
	})
})
