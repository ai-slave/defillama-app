import { describe, expect, test } from 'vitest'
import { lockPoolDetail, lockPoolHistory } from '../../data/verifiedGate'
import type { PoolDetail, PoolHistory } from '../types'
import { buildPoolVerifiedProps, EMPTY_POOL_VERIFIED_PROPS } from '../verifiedProps'

const POOL = {
	id: 'lido-steth',
	apy: { current: { base: 2.22 }, avg_7d: { base: 2.2 }, avg_30d: { base: 2.19 } },
	reward_tokens: [],
	intrinsic: null,
	underlying_tokens: [{ symbol: 'ETH' }],
	verified: {
		apy: { avg_1d: 2.24, avg_7d: 2.23, avg_30d: 2.21 },
		denomination: { token: '0xeee', decimals: 18 },
		exit: { status: 'queued' }
	}
} as unknown as PoolDetail

const NOW = Date.parse('2026-08-27T12:00:00Z')

const HISTORY = [
	{
		date: '2026-08-27',
		tvl_usd: 23_400_000_000,
		apy: { avg_1d: { base: 2.2 }, avg_7d: { base: 2.2 }, avg_30d: { base: 2.2 } },
		intrinsic: null,
		price_per_share: 1.1,
		verified: {
			apy: { avg_1d: 2.24, avg_7d: null, avg_30d: null },
			price_per_share: 1.1049,
			liquidity_available: '1000',
			liquidity_available_usd: 1000,
			tvl: '2000',
			tvl_usd: 23_513_000_000,
			exit: { outcome: 'delayed' }
		}
	}
] as unknown as PoolHistory

describe('buildPoolVerifiedProps', () => {
	test('carries the denomination decimals alongside the liquidity chart', () => {
		const props = buildPoolVerifiedProps({ pool: POOL, history: HISTORY, fullHistory: HISTORY, now: NOW })

		// The liquidity panel renders only when BOTH are present, so a chart without its decimals
		// is the same as no chart at all.
		expect(props.liquidityChart).not.toBeNull()
		expect(props.liquidityDecimals).toBe(18)
	})

	test('comes out entirely empty once the measurement has been redacted', () => {
		const props = buildPoolVerifiedProps({
			pool: lockPoolDetail(POOL),
			history: lockPoolHistory(HISTORY),
			fullHistory: lockPoolHistory(HISTORY),
			now: NOW
		})

		expect(props).toEqual(EMPTY_POOL_VERIFIED_PROPS)
	})
})
