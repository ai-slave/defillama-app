import { describe, expect, test } from 'vitest'
import {
	buildLiquidityChart,
	buildLiquiditySummary,
	depositsOnly,
	exitClassOf,
	firstLiquidityIndex,
	scaleRawUnits,
	type LiquidityChartModel
} from './liquidityChart'
import type { PoolHistoryPoint, VerifiedExitOutcome } from './types'

type DayInput = {
	tvl?: string | null
	tvlUsd?: number | null
	tvlQuoted?: string | null
	tvlQuotedUsd?: number | null
	liq?: string | null
	liqUsd?: number | null
	outcome?: VerifiedExitOutcome
}

function day(date: string, verified: DayInput | null): PoolHistoryPoint {
	const apy = { base: 1, reward: null, total: 1 }
	return {
		date,
		tvl_usd: 100,
		apy: { avg_1d: apy, avg_7d: apy, avg_30d: apy },
		intrinsic: null,
		price_per_share: null,
		verified: verified
			? {
					apy: { avg_1d: null, avg_7d: null, avg_30d: null },
					price_per_share: 1,
					liquidity_available: verified.liq ?? null,
					liquidity_available_usd: verified.liqUsd ?? null,
					tvl: verified.tvl ?? null,
					tvl_usd: verified.tvlUsd ?? null,
					tvl_quoted: verified.tvlQuoted ?? null,
					tvl_quoted_usd: verified.tvlQuotedUsd ?? null,
					exit: verified.outcome ? { outcome: verified.outcome } : null
				}
			: null
	}
}

const USDC = { decimals: 6, symbol: 'USDC' }

describe('quoted deposits', () => {
	// The exit could not price the supply that day, so the deposits continue at the quoted rate and
	// the day is flagged for the tooltip; a day with an executed valuation ignores the quote.
	test('continue the deposits from tvl_quoted only where tvl is null, and flag those days', () => {
		const model = buildLiquidityChart(
			[
				day('2026-01-01', { tvl: '1000000000', tvlUsd: 1000, tvlQuoted: '2000000000', tvlQuotedUsd: 2000 }),
				day('2026-01-02', { tvlQuoted: '1100000000', tvlQuotedUsd: 1100, outcome: 'ok_partial' }),
				day('2026-01-03', { outcome: 'reverted_liquidity' })
			],
			USDC
		) as LiquidityChartModel
		expect(model.usd.total).toEqual([1000, 1100, null])
		expect(model.units.total).toEqual([1000, 1100, null])
		expect(model.quotedTotal).toEqual([false, true, false])
	})
})

describe('scaleRawUnits', () => {
	test('scales an 18-decimal amount far beyond Number precision exactly', () => {
		expect(scaleRawUnits('462068007153307491475273', 18)).toBeCloseTo(462_068.007153, 6)
	})

	test('handles 6-decimal stablecoin amounts and sub-display decimals', () => {
		expect(scaleRawUnits('1234567890', 6)).toBeCloseTo(1234.56789, 6)
		expect(scaleRawUnits('12345', 2)).toBeCloseTo(123.45, 6)
		expect(scaleRawUnits('7', 0)).toBe(7)
	})

	test('treats absent, malformed or undenominated amounts as absent, never as zero', () => {
		expect(scaleRawUnits(null, 18)).toBeNull()
		expect(scaleRawUnits('', 18)).toBeNull()
		expect(scaleRawUnits('12.5', 18)).toBeNull()
		expect(scaleRawUnits('abc', 18)).toBeNull()
		// A pool with no `denomination.decimals` cannot be scaled at all.
		expect(scaleRawUnits('1000000', null)).toBeNull()
		expect(scaleRawUnits('1000000', undefined)).toBeNull()
		expect(scaleRawUnits('100', -1)).toBeNull()
	})

	test('never routes a huge amount through Number before reducing it', () => {
		expect(scaleRawUnits(`1${'0'.repeat(30)}`, 18)).toBe(1e12)
	})
})

describe('exitClassOf', () => {
	test('classifies the reverted family as blocked and ok_partial as partial', () => {
		expect(exitClassOf('reverted_liquidity')).toBe('blocked')
		expect(exitClassOf('reverted_paused')).toBe('blocked')
		expect(exitClassOf('reverted_unknown')).toBe('blocked')
		expect(exitClassOf('ok_partial')).toBe('partial')
	})

	test('leaves working exits and unmeasured days unshaded', () => {
		for (const outcome of ['ok_full', 'delayed', 'no_exit_primary', 'unmeasured', 'error_rpc'] as const) {
			expect(exitClassOf(outcome)).toBeNull()
		}
		expect(exitClassOf(null)).toBeNull()
	})
})

describe('buildLiquidityChart', () => {
	test('reads USD straight off the API and scales units with the denomination', () => {
		const model = buildLiquidityChart(
			[day('2026-01-01', { tvl: '1000000000', tvlUsd: 1000, liq: '250000000', liqUsd: 250, outcome: 'ok_partial' })],
			USDC
		)
		expect(model?.usd).toEqual({ total: [1000], available: [250], remainder: [750] })
		expect(model?.units).toEqual({ total: [1000], available: [250], remainder: [750] })
		expect(model?.classes).toEqual(['partial'])
		expect(model?.hasUnits).toBe(true)
		expect(model?.uncappedQueue).toBe(false)
	})

	test('keeps USD when a day has no denomination to scale units with', () => {
		const model = buildLiquidityChart([day('2026-01-01', { tvlUsd: 1000, liqUsd: 250 })], {
			decimals: null,
			symbol: null
		})
		expect(model?.usd.total).toEqual([1000])
		expect(model?.units.total).toEqual([null])
		// Without units the chart offers USD only rather than guessing a scale.
		expect(model?.hasUnits).toBe(false)
	})

	test('treats a missing instant lane as an uncapped queue, not as zero', () => {
		// liquidity_available null across the whole series: the pool exits via a queue with no cap.
		const model = buildLiquidityChart(
			[
				day('2026-01-01', { tvl: '1000000', tvlUsd: 500, outcome: 'delayed' }),
				day('2026-01-02', { tvl: '1000000', tvlUsd: 520, outcome: 'delayed' })
			],
			USDC
		)
		expect(model?.uncappedQueue).toBe(true)
		expect(model?.usd.available).toEqual([null, null])
		// The deposits are still fully measured, so the remainder carries the whole pool.
		expect(model?.usd.remainder).toEqual([500, 520])
	})

	test('clamps an available figure above the measured total instead of drawing a negative band', () => {
		const model = buildLiquidityChart([day('2026-01-01', { tvlUsd: 100, liqUsd: 150 })], USDC)
		expect(model?.usd.remainder).toEqual([0])
	})

	test('leaves days without measured deposits null rather than zero', () => {
		const model = buildLiquidityChart([day('2026-01-01', { tvlUsd: 100, liqUsd: 40 }), day('2026-01-02', null)], USDC)
		expect(model?.usd.total).toEqual([100, null])
		expect(model?.usd.remainder).toEqual([60, null])
	})

	test('is null only when no day carries measured deposits at all', () => {
		expect(buildLiquidityChart([day('2026-01-01', null)], USDC)).toBeNull()
		expect(buildLiquidityChart([], USDC)).toBeNull()
	})
})

describe('depositsOnly', () => {
	// A live queue has no instant lane by design, whatever the probe returned on some days.
	test('drops the instant lane and carries every deposit in the remainder', () => {
		const model = buildLiquidityChart(
			[
				day('2026-01-01', { tvl: '1000', tvlUsd: 100, liq: '250', liqUsd: 25 }),
				day('2026-01-02', { tvl: '800', tvlUsd: 80 })
			],
			{ decimals: 0, symbol: 'X' }
		)!
		expect(model.uncappedQueue).toBe(false)

		const queued = depositsOnly(model)
		expect(queued.uncappedQueue).toBe(true)
		expect(queued.usd.available).toEqual([null, null])
		expect(queued.usd.remainder).toEqual([100, 80])
		expect(queued.units.available).toEqual([null, null])
		expect(queued.units.remainder).toEqual([1000, 800])
		expect(queued.usd.total).toEqual([100, 80])
	})

	test('returns an uncapped queue unchanged', () => {
		const model = buildLiquidityChart([day('2026-01-01', { tvlUsd: 100 })], { decimals: null, symbol: null })!
		expect(depositsOnly(model)).toBe(model)
	})
})

describe('firstLiquidityIndex', () => {
	const model = buildLiquidityChart(
		[
			day('2026-01-01', null),
			day('2026-01-02', null),
			day('2026-01-03', { tvlUsd: 100, liqUsd: 25 }),
			day('2026-01-04', { tvlUsd: 110, liqUsd: 30 })
		],
		USDC
	) as LiquidityChartModel

	test('finds the first measured day', () => {
		expect(firstLiquidityIndex(model, 0, 4)).toBe(2)
	})

	test('never reaches back before the requested window', () => {
		expect(firstLiquidityIndex(model, 3, 4)).toBe(3)
	})

	test('is -1 when the window holds no measured day', () => {
		expect(firstLiquidityIndex(model, 0, 2)).toBe(-1)
	})
})

describe('buildLiquiditySummary', () => {
	test('reports the most recent measured day in the requested unit', () => {
		const model = buildLiquidityChart(
			[
				day('2026-01-01', { tvl: '1000000', tvlUsd: 900, liq: '900000', liqUsd: 810 }),
				day('2026-01-02', { tvl: '1000000', tvlUsd: 1000, liq: '250000', liqUsd: 250 }),
				// A trailing unmeasured day must not become the headline.
				day('2026-01-03', null)
			],
			USDC
		) as LiquidityChartModel

		const usd = buildLiquiditySummary(model, 0, 3, 'usd')
		expect(usd?.asOf).toBe(Date.UTC(2026, 0, 2))
		expect(usd?.total).toBe(1000)
		expect(usd?.availableFraction).toBeCloseTo(0.25, 8)
		expect(usd?.remainder).toBeCloseTo(750, 8)

		const units = buildLiquiditySummary(model, 0, 3, 'units')
		expect(units?.total).toBeCloseTo(1, 8)
		expect(units?.availableFraction).toBeCloseTo(0.25, 8)
	})

	test('reports no withdrawable figure at all on an uncapped queue', () => {
		const model = buildLiquidityChart([day('2026-01-01', { tvlUsd: 8_500_000_000, outcome: 'delayed' })], USDC)
		const summary = buildLiquiditySummary(model as LiquidityChartModel, 0, 1, 'usd')
		// Never 0 and never 0%: there is no instant lane to measure, which is a different claim.
		expect(summary?.total).toBe(8_500_000_000)
		expect(summary?.available).toBeNull()
		expect(summary?.availableFraction).toBeNull()
	})

	test('is null when the window holds no measured day', () => {
		const model = buildLiquidityChart(
			[day('2026-01-01', { tvlUsd: 100, liqUsd: 10 }), day('2026-01-02', null)],
			USDC
		) as LiquidityChartModel
		expect(buildLiquiditySummary(model, 1, 2, 'usd')).toBeNull()
	})
})
