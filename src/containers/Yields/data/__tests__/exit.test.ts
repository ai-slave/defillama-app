import { describe, expect, test } from 'vitest'
import { humanizeEta, withdrawablePct } from '../../domain/exitPresentation'
import { exitSortScore, withdrawableFraction } from '../exit'
import type { VerifiedBlock, VerifiedExit, VerifiedExitStatus } from '../types'

function exit(status: VerifiedExitStatus, overrides: Partial<VerifiedExit> = {}): VerifiedExit {
	return { status, eta_seconds: null, fee_bps: 0, as_of: '2026-08-09', ...overrides }
}

// The withdrawable share is DERIVED from the two measured amounts now, so a fixture states it by
// setting them: `fraction` of $1,000 deposits.
function block(exitValue: VerifiedExit | null, fraction: number | null = 1): VerifiedBlock {
	return {
		apy: { avg_1d: 1, avg_7d: 1, avg_30d: 1 },
		apy_as_of: '2026-08-10T00:00:00.000Z',
		apy_confidence: 'high',
		exit: exitValue,
		exit_liquidity:
			fraction == null ? null : { amount: '1', usd: fraction * 1000, slippage_bps: 0, as_of: '2026-08-09' },
		tvl: { amount: '1000', usd: 1000, as_of: '2026-08-09' }
	}
}

const score = (exitValue: VerifiedExit | null, fraction: number | null = 1) => exitSortScore(block(exitValue, fraction))

describe('exitSortScore', () => {
	// The column's stated order, descending.
	test('ranks the statuses into disjoint bands', () => {
		const instant = score(exit('instant'))!
		const partial = score(exit('partial'), 0.5)!
		const queued = score(exit('queued', { eta_seconds: 86_400 }))!
		const depleted = score(exit('depleted'), 0)!
		const unavailable = score(exit('unavailable'), 0)!
		const blocked = score(exit('blocked'), 0)!
		expect(depleted).toBeGreaterThan(unavailable)
		expect(depleted).toBeLessThan(score(exit('queued', { eta_seconds: null }))!)

		expect(instant).toBeGreaterThan(partial)
		expect(partial).toBeGreaterThan(queued)
		expect(queued).toBeGreaterThan(unavailable)
		// `unavailable` is a closed door, `blocked` is a revert we actually observed.
		expect(unavailable).toBeGreaterThan(blocked)
	})

	test('ranks sized exits by withdrawable dollars, whatever their status', () => {
		expect(score(exit('partial'), 0.5)!).toBeGreaterThan(score(exit('instant'), 0.1)!)
		expect(score(exit('partial'), 0.35)!).toBeGreaterThan(score(exit('partial'), 0.0099)!)
	})

	test('ranks an unsized exit below every sized one and above a queue', () => {
		const unsizedInstant = score(exit('instant'), null)!
		const unsizedPartial = score(exit('partial'), null)!

		expect(unsizedInstant).toBeLessThan(score(exit('partial'), 0.001)!)
		expect(unsizedPartial).toBeLessThan(unsizedInstant)
		expect(unsizedPartial).toBeGreaterThan(score(exit('queued', { eta_seconds: 86_400 }))!)
	})

	test('orders queued exits by how long the wait is', () => {
		const oneDay = score(exit('queued', { eta_seconds: 86_400 }))!
		const thirtyDays = score(exit('queued', { eta_seconds: 2_592_000 }))!

		expect(oneDay).toBeGreaterThan(thirtyDays)
		// The slowest queue still beats a blocked exit.
		expect(thirtyDays).toBeGreaterThan(score(exit('blocked'), 0)!)
	})

	// An unknown wait is the worst kind of queue, so it sits at the band floor rather than
	// scoring as though it were instant.
	test('puts a queued exit with no ETA at the bottom of its band', () => {
		const unknown = score(exit('queued', { eta_seconds: null }))!

		expect(unknown).toBeLessThan(score(exit('queued', { eta_seconds: 2_592_000 }))!)
		expect(unknown).toBeGreaterThan(score(exit('blocked'), 0)!)
	})

	test('returns null when there is no measurement to rank', () => {
		expect(exitSortScore(null)).toBeNull()
		expect(exitSortScore(undefined)).toBeNull()
		expect(score(null)).toBeNull()
		// A status this build does not know must not be ranked as though it were understood.
		expect(score(exit(null as unknown as VerifiedExitStatus))).toBeNull()
	})
})

describe('withdrawableFraction', () => {
	test('derives the share from the two measured amounts', () => {
		expect(withdrawableFraction(block(exit('partial'), 0.25))).toBeCloseTo(0.25, 10)
	})

	// A missing amount is an uncapped queue with no instant lane to take a share of. Returning 0
	// would read as "nothing can leave", which is the opposite of the truth.
	test('answers null rather than zero when either amount is missing', () => {
		expect(withdrawableFraction(block(exit('queued'), null))).toBeNull()
		expect(withdrawableFraction({ ...block(exit('instant')), tvl: null })).toBeNull()
		expect(withdrawableFraction(null)).toBeNull()
	})

	test('keeps a measured zero as a real reading', () => {
		expect(withdrawableFraction(block(exit('partial'), 0))).toBe(0)
	})

	test('clamps stamp drift to a valid pool share for every consumer', () => {
		expect(withdrawableFraction(block(exit('instant'), 1.05))).toBe(1)
		expect(withdrawablePct(withdrawableFraction(block(exit('instant'), 1.05)))).toBe(100)
		expect(withdrawableFraction(block(exit('partial'), -0.05))).toBe(0)
	})
})

describe('compact exit formatting', () => {
	test('abbreviates the ETA for the column while the card keeps words', () => {
		expect(humanizeEta(950_400, { compact: true })).toBe('~11d')
		expect(humanizeEta(950_400)).toBe('~11 days')
		expect(humanizeEta(14_400, { compact: true })).toBe('~4h')
		expect(humanizeEta(1800, { compact: true })).toBe('~30m')
	})

	test('rounds the withdrawable fraction to a whole percent', () => {
		expect(withdrawablePct(0.1999)).toBe(20)
		expect(withdrawablePct(0.0099)).toBe(1)
		expect(withdrawablePct(0)).toBe(0)
		expect(withdrawablePct(null)).toBeNull()
	})
})
