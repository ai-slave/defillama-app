import { describe, expect, test } from 'vitest'
import type { VerifiedBlock } from '../../data/types'
import { buildVerifiedSnapshot } from '../VerifiedSnapshotCard'

const verified: VerifiedBlock = {
	apy: { avg_1d: 2.28, avg_7d: 2.3, avg_30d: 2.23 },
	apy_as_of: '2026-08-26T12:00:00Z',
	apy_confidence: 'high',
	exit: { status: 'queued', eta_seconds: 259_200, fee_bps: 0, as_of: '2026-08-26T11:00:00Z' },
	exit_liquidity: { amount: null, usd: null, slippage_bps: 0, as_of: '2026-08-26T11:00:00Z' },
	tvl: null,
	methods: ['sharesOf(holder)']
}

// The fixtures are dated 2026-08-26; judge freshness from the day after, as the page would have.
const NOW = Date.parse('2026-08-27T09:00:00Z')

describe('verified snapshot', () => {
	test('compares like-for-like daily base APY and names an uncapped queue', () => {
		expect(buildVerifiedSnapshot(verified, [{ label: '24h', verified: 2.28 }], NOW)).toEqual({
			baseApy: 2.28,
			lastVerifiedApy: null,
			current: true,
			exitHeadline: 'Queued ~3 days',
			exitDetail: 'Uncapped queue: no instant lane, takes any size',
			withdrawableUsd: null,
			// An uncapped queue has no instant lane to measure, so the share stays absent rather than 0.
			withdrawableFraction: null,
			feeBps: 0
		})
	})

	test('reports the withdrawable amount and share when a lane exists', () => {
		const instant: VerifiedBlock = {
			...verified,
			exit: { status: 'instant', eta_seconds: null, fee_bps: 5, as_of: null },
			exit_liquidity: { amount: '250000000', usd: 250, slippage_bps: 0, as_of: null },
			tvl: { amount: '1000000000', usd: 1000, as_of: null },
			denomination: { address: '0xabc', decimals: 6 }
		}
		const snapshot = buildVerifiedSnapshot(instant, [{ label: '24h', verified: 2.28 }], NOW)
		expect(snapshot.withdrawableUsd).toBe(250)
		expect(snapshot.withdrawableFraction).toBeCloseTo(0.25, 8)
		// The dollar figure has its own row, so the detail carries the share.
		expect(snapshot.exitDetail).toBe('25% of pool withdrawable at once')
		// Signed: only a positive fee is one the holder pays.
		expect(snapshot.feeBps).toBe(5)
	})
})

/*
 * The exit headline must never claim success for a state we did not verify. Failing OPEN here is
 * the worst direction to be wrong in: presenting a paused or unattestable exit as "Instant" tells
 * a reader their money can leave when we have no evidence of that.
 *
 * This suite stands in for a compile-time exhaustiveness guard, which cannot work in this project:
 * `tsconfig.json` sets `strict: false`, so narrowing never reaches `never` and a `satisfies never`
 * check passes silently.
 */
describe('exitStatusFallsBackToUnattested', () => {
	const withStatus = (status: unknown): VerifiedBlock => ({
		...verified,
		exit: { status, eta_seconds: null, fee_bps: 0, as_of: null } as VerifiedBlock['exit'],
		exit_liquidity: { amount: '250000000', usd: 250, slippage_bps: 0, as_of: null },
		tvl: { amount: '1000000000', usd: 1000, as_of: null }
	})

	// A closed exit path is not a revert and emphatically not an instant exit.
	test('names an unavailable exit rather than reading it as instant', () => {
		const snapshot = buildVerifiedSnapshot(withStatus('unavailable'), [], NOW)

		expect(snapshot.exitHeadline).toBe('Unavailable')
		expect(snapshot.exitDetail).toBe('No usable exit path right now')
	})

	// A null status is an RPC failure at the last observation, not a verdict about the pool.
	test('reports a null status as unattested', () => {
		const snapshot = buildVerifiedSnapshot(withStatus(null), [], NOW)

		expect(snapshot.exitHeadline).toBe('—')
		expect(snapshot.exitDetail).toBe('Exit could not be attested on the last check')
	})

	test('degrades an unrecognised status to unattested, never to success', () => {
		for (const status of ['probe_timeout', 'PARTIAL', '', 'instant ']) {
			const snapshot = buildVerifiedSnapshot(withStatus(status), [], NOW)

			expect(snapshot.exitHeadline, `status ${JSON.stringify(status)}`).toBe('—')
			expect(snapshot.exitDetail).toBe('Exit could not be attested on the last check')
		}
	})

	// An absent exit block is a third state again: nothing was probed at all.
	test('distinguishes an absent exit block from an unattested one', () => {
		const snapshot = buildVerifiedSnapshot({ ...verified, exit: null }, [], NOW)

		expect(snapshot.exitHeadline).toBe('—')
		expect(snapshot.exitDetail).toBe('Exit not measured')
	})

	// The six real statuses still resolve to their own headline, so the fallback cannot swallow one.
	test('keeps every known status distinct', () => {
		const headlines = (['instant', 'partial', 'depleted', 'queued', 'unavailable', 'blocked'] as const).map(
			(status) => buildVerifiedSnapshot(withStatus(status), [], NOW).exitHeadline
		)

		expect(new Set(headlines).size).toBe(headlines.length)
		expect(headlines).not.toContain('—')
	})
})
