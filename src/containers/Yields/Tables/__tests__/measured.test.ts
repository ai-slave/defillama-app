import { describe, expect, test } from 'vitest'
import type { VerifiedBlock, VerifiedExit, VerifiedExitStatus } from '../../data/types'
import { exitFeeWarning, exitTone, humanizeEta } from '../../domain/exitPresentation'

// The withdrawable share is derived from the measured amounts, so a fixture states it by setting
// them: `fraction` of $1,000 deposits.
function block(
	status: VerifiedExitStatus | null,
	{ fraction = 1, ...exit }: Partial<VerifiedExit> & { fraction?: number | null } = {}
): VerifiedBlock {
	return {
		apy: { avg_1d: 1, avg_7d: 1, avg_30d: 1 },
		apy_as_of: '2026-08-09T00:00:00.000Z',
		apy_confidence: 'high',
		exit: { status, eta_seconds: null, fee_bps: 0, as_of: '2026-08-09', ...exit },
		exit_liquidity:
			fraction == null ? null : { amount: '1', usd: fraction * 1000, slippage_bps: 0, as_of: '2026-08-09' },
		tvl: { amount: '1000', usd: 1000, as_of: '2026-08-09' }
	}
}

describe('exitTone', () => {
	// Depletion is decided server-side, so a small partial share stays a warning here.
	test('follows the status alone, leaving depletion to the server', () => {
		expect(exitTone(block('partial', { fraction: 0.4 }))).toBe('warning')
		expect(exitTone(block('partial', { fraction: 0.004 }))).toBe('warning')
		expect(exitTone(block('partial', { fraction: 0 }))).toBe('warning')
		expect(exitTone(block('depleted', { fraction: 0 }))).toBe('bad')
	})
})

describe('exitFeeWarning', () => {
	test('warns only about a fee the holder actually pays', () => {
		expect(exitFeeWarning(12)).toBe('exit fee ~12 bps, measured')
	})

	// The measurement returns small negative fees (dust in the holder's favour); flagging one
	// as an exit fee would be a false alarm.
	test('treats zero and negative measured fees as no fee at all', () => {
		expect(exitFeeWarning(0)).toBeNull()
		expect(exitFeeWarning(-0.03)).toBeNull()
	})

	test('makes no claim when the fee was not measured', () => {
		expect(exitFeeWarning(null)).toBeNull()
	})
})

describe('humanizeEta', () => {
	test('scales the unit to the magnitude and never implies precision', () => {
		expect(humanizeEta(1800)).toBe('~30 min')
		expect(humanizeEta(14_400)).toBe('~4 hours')
		expect(humanizeEta(3600)).toBe('~1 hour')
		expect(humanizeEta(2_592_000)).toBe('~30 days')
	})

	test('returns null for a missing or non-positive ETA', () => {
		expect(humanizeEta(null)).toBeNull()
		expect(humanizeEta(0)).toBeNull()
	})
})
