import { describe, expect, test } from 'vitest'
import {
	buildCombinedSummary,
	buildGrowthChart,
	buildIntrinsicSeries,
	buildGrowthGaps,
	buildGrowthSeries,
	buildGrowthSummary,
	firstMeasuredIndex,
	growthAxisDigits,
	growthFractionDigits,
	growthOutcomeLabel,
	growthReasonLabel,
	resolveGrowthAnchor,
	selectGrowthDrawdown,
	type GrowthChartModel
} from '../growthChart'
import type { PoolHistoryPoint, VerifiedExitOutcome } from '../types'

function day(
	date: string,
	reportedTotal: number | null,
	verified: { pps: number | null; quoted?: number | null; reason?: string; outcome?: VerifiedExitOutcome } | null
): PoolHistoryPoint {
	return {
		date,
		tvl_usd: 100,
		apy: {
			avg_1d: { base: reportedTotal, reward: null, total: reportedTotal },
			avg_7d: { base: reportedTotal, reward: null, total: reportedTotal },
			avg_30d: { base: reportedTotal, reward: null, total: reportedTotal }
		},
		intrinsic: null,
		price_per_share: null,
		verified: verified
			? {
					apy: { avg_1d: null, avg_7d: null, avg_30d: null },
					price_per_share: verified.pps,
					price_per_share_quoted: verified.quoted ?? null,
					reason: (verified.reason ?? null) as NonNullable<PoolHistoryPoint['verified']>['reason'],
					liquidity_available: null,
					liquidity_available_usd: null,
					tvl: null,
					tvl_usd: null,
					exit: verified.outcome ? { outcome: verified.outcome } : null
				}
			: null
	}
}

describe('buildGrowthChart', () => {
	test('reads the measured rate and outcome off each row', () => {
		const model = buildGrowthChart([
			day('2026-01-01', 5, { pps: 1.2, outcome: 'ok_full' }),
			day('2026-01-02', 6, { pps: 1.25, outcome: 'ok_partial' })
		])

		expect(model?.dates).toEqual([Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2)])
		expect(model?.pps).toEqual([1.2, 1.25])
		expect(model?.outcomes).toEqual(['ok_full', 'ok_partial'])
	})

	test('treats an unmeasured day, a rate-less measurement and a non-positive rate alike', () => {
		const model = buildGrowthChart([
			day('2026-01-01', 5, { pps: 1 }),
			day('2026-01-02', 5, null),
			day('2026-01-03', 5, { pps: null, outcome: 'reverted_liquidity' }),
			day('2026-01-04', 5, { pps: 0, outcome: 'error_rpc' })
		])

		expect(model?.pps).toEqual([1, null, null, null])
		// The outcome still comes through on days that produced no rate — that is the explanation
		// the tooltip shows for the gap.
		expect(model?.outcomes).toEqual([null, null, 'reverted_liquidity', 'error_rpc'])
	})

	test('is null when nothing was ever measured', () => {
		expect(buildGrowthChart([day('2026-01-01', 5, null), day('2026-01-02', 5, { pps: null })])).toBeNull()
		expect(buildGrowthChart([])).toBeNull()
	})

	// The quoted rate only ever stands in for a missing executed one, and a pool with nothing but
	// quotes has nothing verified to draw.
	test('keeps the quoted rate and its reason only on days without an executed rate', () => {
		const model = buildGrowthChart([
			day('2026-01-01', 5, { pps: 1.1, quoted: 1.2 }),
			day('2026-01-02', 5, { pps: null, quoted: 1.12, reason: 'rate_quality_floor', outcome: 'ok_partial' }),
			day('2026-01-03', 5, { pps: null, quoted: 0 }),
			day('2026-01-04', 5, null)
		])
		expect(model?.pps).toEqual([1.1, null, null, null])
		expect(model?.quoted).toEqual([null, 1.12, null, null])
		expect(model?.reasons).toEqual([null, 'rate_quality_floor', null, null])
		expect(buildGrowthChart([day('2026-01-01', 5, { pps: null, quoted: 1.2 })])).toBeNull()
	})
})

describe('buildGrowthSeries', () => {
	const model = buildGrowthChart([
		day('2026-01-01', 10, { pps: 2 }),
		day('2026-01-02', 10, { pps: 2.5 }),
		day('2026-01-03', 10, { pps: 3 })
	]) as GrowthChartModel

	test('rebases the measured line onto the window and starts it at exactly 1', () => {
		const full = buildGrowthSeries(model, 0, 3)
		expect(full.anchor).toBe(0)
		expect(full.measured).toEqual([1, 1.25, 1.5])
	})

	test('re-anchors when the visible window changes', () => {
		const tail = buildGrowthSeries(model, 1, 3)
		expect(tail.anchor).toBe(1)
		// Rebased on 2.5, not on the series' own first point.
		expect(tail.measured).toEqual([1, 1.2])
		expect(tail.measured).toHaveLength(2)
	})

	test('breaks the measured line on gap days without interpolating across them', () => {
		const gapped = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-02', 10, null),
			day('2026-01-03', 10, { pps: 1.5 })
		]) as GrowthChartModel

		const series = buildGrowthSeries(gapped, 0, 3)
		expect(series.measured).toEqual([1, null, 1.5])
	})

	test('anchors on the first MEASURED day, not the first visible day', () => {
		const leading = buildGrowthChart([
			day('2026-01-01', 10, null),
			day('2026-01-02', 10, null),
			day('2026-01-03', 10, { pps: 4 }),
			day('2026-01-04', 10, { pps: 5 })
		]) as GrowthChartModel

		const series = buildGrowthSeries(leading, 0, 4)
		expect(series.anchor).toBe(2)
		// Nothing is claimed for the days before the deposit.
		expect(series.measured).toEqual([null, null, 1, 1.25])
	})

	test('reports no anchor when the window holds no measurement', () => {
		const series = buildGrowthSeries(model, 3, 3)
		expect(series.anchor).toBe(-1)
		expect(series.measured).toEqual([])
		expect(series.quoted).toEqual([])
	})

	test('continues through quoted days as a separate series that joins the executed line', () => {
		const quotedRun = buildGrowthChart([
			day('2026-01-01', 10, { pps: 2 }),
			day('2026-01-02', 10, { pps: null, quoted: 2.2, reason: 'rate_quality_floor' }),
			day('2026-01-03', 10, { pps: null, quoted: 2.4, reason: 'rate_quality_floor' }),
			day('2026-01-04', 10, { pps: 3 }),
			day('2026-01-05', 10, null),
			day('2026-01-06', 10, { pps: null, quoted: 3.2 })
		]) as GrowthChartModel

		const series = buildGrowthSeries(quotedRun, 0, 6)
		// The executed line still breaks on every day without an executed rate.
		expect(series.measured).toEqual([1, null, null, 1.5, null, null])
		// The quoted run is rebased on the same basis and bridged to the executed points beside it;
		// a run with no executed neighbour on one side simply starts or ends open.
		expect(series.quoted).toEqual([1, 1.1, 1.2, 1.5, null, 1.6])
		// Quoted days are not coverage gaps; the unmeasured day between executed points still is.
		const gappedModel = buildGrowthChart([
			day('2026-01-01', 10, { pps: 2 }),
			day('2026-01-02', 10, { pps: null, quoted: 2.2 }),
			day('2026-01-03', 10, null),
			day('2026-01-04', 10, { pps: 3 })
		]) as GrowthChartModel
		expect(buildGrowthGaps(gappedModel, 0, 4).map((gap) => [gap.from, gap.days])).toEqual([[Date.UTC(2026, 0, 3), 1]])
		// The summary is what a holder got, so it reads executed days only.
		expect(buildGrowthSummary(quotedRun, 0, 6, 1)?.endValue).toBe(1.5)
	})

	test('carries a real loss through as a decline below the deposit', () => {
		const losing = buildGrowthChart([
			day('2026-01-01', -50, { pps: 1 }),
			day('2026-01-02', -50, { pps: 0.9 })
		]) as GrowthChartModel

		const series = buildGrowthSeries(losing, 0, 2)
		expect(series.measured).toEqual([1, 0.9])
	})
})

describe('buildGrowthSummary', () => {
	// +10% over 100 days, measured throughout.
	const hundredDays = buildGrowthChart([
		day('2026-01-01', 10, { pps: 2 }),
		day('2026-02-10', 10, { pps: 2.1 }),
		day('2026-04-11', 10, { pps: 2.2 })
	]) as GrowthChartModel

	test('states what the deposit became, its gain, and the annualized rate', () => {
		const summary = buildGrowthSummary(hundredDays, 0, 3, 10_000)
		expect(summary?.days).toBe(100)
		expect(summary?.endValue).toBeCloseTo(11_000, 8)
		expect(summary?.gain).toBeCloseTo(1000, 8)
		expect(summary?.returnPct).toBeCloseTo(10, 8)
		// 1.1 ^ (365/100) - 1
		expect(summary?.annualizedPct).toBeCloseTo((1.1 ** 3.65 - 1) * 100, 8)
	})

	test('scales with the deposit and leaves the percentages untouched', () => {
		const one = buildGrowthSummary(hundredDays, 0, 3, 1)
		const big = buildGrowthSummary(hundredDays, 0, 3, 250_000)
		expect(one?.endValue).toBeCloseTo(1.1, 8)
		expect(big?.endValue).toBeCloseTo(275_000, 8)
		expect(big?.returnPct).toBeCloseTo(one!.returnPct, 8)
		expect(big?.annualizedPct).toBeCloseTo(one!.annualizedPct!, 8)
	})

	test('measures to the last MEASURED day, ignoring a trailing gap', () => {
		const trailing = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-11', 10, { pps: 1.05 }),
			day('2026-01-21', 10, null)
		]) as GrowthChartModel

		const summary = buildGrowthSummary(trailing, 0, 3, 100)
		expect(summary?.to).toBe(Date.UTC(2026, 0, 11))
		expect(summary?.days).toBe(10)
		expect(summary?.endValue).toBeCloseTo(105, 8)
	})

	test('reports a real loss as a loss, never clamped', () => {
		const losing = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-03-02', 10, { pps: 0.8 })
		]) as GrowthChartModel

		const summary = buildGrowthSummary(losing, 0, 2, 10_000)
		expect(summary?.endValue).toBeCloseTo(8000, 8)
		expect(summary?.gain).toBeCloseTo(-2000, 8)
		expect(summary?.returnPct).toBeCloseTo(-20, 8)
		expect(summary?.annualizedPct).toBeLessThan(-20)
	})

	test('refuses to annualize a window too short to mean anything', () => {
		const short = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-03', 10, { pps: 1.01 })
		]) as GrowthChartModel

		const summary = buildGrowthSummary(short, 0, 2, 100)
		expect(summary?.days).toBe(2)
		// 1.01 ^ (365/2) would read as +5,000,000% — a number we have no business printing.
		expect(summary?.annualizedPct).toBeNull()
		expect(summary?.returnPct).toBeCloseTo(1, 8)
	})

	test('is null without a usable anchor or measurement', () => {
		expect(buildGrowthSummary(hundredDays, -1, 3, 100)).toBeNull()
		expect(buildGrowthSummary(hundredDays, 3, 3, 100)).toBeNull()
	})

	test('handles a single measured day as a flat, unannualized result', () => {
		const single = buildGrowthChart([day('2026-01-01', 10, { pps: 1.5 })]) as GrowthChartModel
		const summary = buildGrowthSummary(single, 0, 1, 500)
		expect(summary?.days).toBe(0)
		expect(summary?.endValue).toBeCloseTo(500, 8)
		expect(summary?.gain).toBeCloseTo(0, 8)
		expect(summary?.annualizedPct).toBeNull()
	})
})

describe('buildGrowthSummary drawdown', () => {
	test('is null when the value never fell below a previous peak', () => {
		const rising = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-11', 10, { pps: 1.1 }),
			day('2026-01-21', 10, { pps: 1.2 })
		]) as GrowthChartModel
		expect(buildGrowthSummary(rising, 0, 3, 100)?.drawdown).toBeNull()
	})

	test('measures the deepest peak-to-trough fall and names both days', () => {
		const dipping = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-11', 10, { pps: 1.2 }), // peak
			day('2026-01-21', 10, { pps: 0.9 }), // trough: -25% from peak
			day('2026-01-31', 10, { pps: 1.1 })
		]) as GrowthChartModel

		const drawdown = buildGrowthSummary(dipping, 0, 4, 100)?.drawdown
		expect(drawdown?.pct).toBeCloseTo(-25, 8)
		expect(drawdown?.peakDate).toBe(Date.UTC(2026, 0, 11))
		expect(drawdown?.troughDate).toBe(Date.UTC(2026, 0, 21))
		// Ends at 1.1, still under the 1.2 peak.
		expect(drawdown?.recovered).toBe(false)
	})

	test('marks a dip that has been made back as recovered', () => {
		const recovered = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-11', 10, { pps: 0.95 }),
			day('2026-01-21', 10, { pps: 1.05 })
		]) as GrowthChartModel

		const drawdown = buildGrowthSummary(recovered, 0, 3, 100)?.drawdown
		expect(drawdown?.pct).toBeCloseTo(-5, 8)
		expect(drawdown?.recovered).toBe(true)
	})

	// 100 → 50 → 110 → 105: the worst fall was from 100, and 105 is back above it, whatever the
	// later 110 peak did.
	test('judges recovery against the peak the worst drawdown fell from', () => {
		const rebounded = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-11', 10, { pps: 0.5 }),
			day('2026-01-21', 10, { pps: 1.1 }),
			day('2026-01-31', 10, { pps: 1.05 })
		]) as GrowthChartModel

		const drawdown = buildGrowthSummary(rebounded, 0, 4, 100)?.drawdown
		expect(drawdown?.pct).toBeCloseTo(-50, 8)
		expect(drawdown?.peakDate).toBe(Date.UTC(2026, 0, 1))
		expect(drawdown?.recovered).toBe(true)
	})

	test('skips gap days instead of reading them as a fall to zero', () => {
		const gapped = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-11', 10, null),
			day('2026-01-21', 10, { pps: 1.1 })
		]) as GrowthChartModel
		expect(buildGrowthSummary(gapped, 0, 3, 100)?.drawdown).toBeNull()
	})
})

describe('buildGrowthGaps', () => {
	test('finds a run of unmeasured days after the deposit', () => {
		const model = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-02', 10, { pps: null, outcome: 'unmeasured' }),
			day('2026-01-03', 10, { pps: null, outcome: 'unmeasured' }),
			day('2026-01-04', 10, { pps: 1.1 })
		]) as GrowthChartModel

		const gaps = buildGrowthGaps(model, 0, 4)
		expect(gaps).toHaveLength(1)
		expect(gaps[0].from).toBe(Date.UTC(2026, 0, 2))
		expect(gaps[0].to).toBe(Date.UTC(2026, 0, 3))
		expect(gaps[0].days).toBe(2)
		expect(gaps[0].kind).toBe('unmeasured')
		expect(gaps[0].label).toBe('Not measured · 2 days')
	})

	test('keeps a run a coverage gap even when the withdrawals inside it reverted', () => {
		const model = buildGrowthChart([
			day('2026-01-01', 10, { pps: 1 }),
			day('2026-01-02', 10, { pps: null, outcome: 'reverted_liquidity' }),
			day('2026-01-03', 10, { pps: null, outcome: 'reverted_paused' }),
			day('2026-01-04', 10, { pps: 1.1 }),
			day('2026-01-05', 10, { pps: null, outcome: 'reverted_unknown' }),
			day('2026-01-06', 10, { pps: null, outcome: 'unmeasured' }),
			day('2026-01-07', 10, { pps: 1.2 })
		]) as GrowthChartModel

		expect(buildGrowthGaps(model, 0, 7)).toHaveLength(2)
	})

	test('ignores days before the deposit and after the last measurement', () => {
		const model = buildGrowthChart([
			// Pre-deposit: the money wasn't in yet, so this is not a gap.
			day('2026-01-01', 10, { pps: null, outcome: 'reverted_liquidity' }),
			day('2026-01-02', 10, { pps: 1 }),
			day('2026-01-03', 10, { pps: null, outcome: 'unmeasured' }),
			day('2026-01-04', 10, { pps: 1.1 }),
			// Trailing: coverage simply hasn't caught up, not an interruption.
			day('2026-01-05', 10, { pps: null, outcome: 'unmeasured' })
		]) as GrowthChartModel

		const gaps = buildGrowthGaps(model, 1, 5)
		expect(gaps).toHaveLength(1)
		expect(gaps[0].from).toBe(Date.UTC(2026, 0, 3))
		expect(gaps[0].days).toBe(1)
		expect(gaps[0].label).toBe('Not measured · 1 day')
	})

	test('is empty without an anchor or a measurement', () => {
		const model = buildGrowthChart([day('2026-01-01', 10, { pps: 1 }), day('2026-01-02', 10, null)]) as GrowthChartModel
		expect(buildGrowthGaps(model, -1, 2)).toEqual([])
		expect(buildGrowthGaps(model, 1, 2)).toEqual([])
	})
})

describe('resolveGrowthAnchor', () => {
	const model = buildGrowthChart([
		day('2026-01-01', 10, { pps: 1 }),
		day('2026-01-02', 10, { pps: 1.1 }),
		day('2026-01-05', 10, { pps: 1.2 })
	]) as GrowthChartModel

	test('resolves a date present in the series to its own index', () => {
		expect(resolveGrowthAnchor(model, '2026-01-02', 0, 3)).toBe(1)
	})

	test('snaps a day the pool has no row for forward to the next real day', () => {
		// 3rd and 4th are absent from the series; the deposit lands on the 5th.
		expect(resolveGrowthAnchor(model, '2026-01-03', 0, 3)).toBe(2)
	})

	test('falls back to the window start for a missing, malformed or out-of-window date', () => {
		expect(resolveGrowthAnchor(model, null, 1, 3)).toBe(1)
		expect(resolveGrowthAnchor(model, 'not-a-date', 0, 3)).toBe(0)
		// After every day in the window — a stale deep link must not empty the chart.
		expect(resolveGrowthAnchor(model, '2027-06-01', 0, 3)).toBe(0)
		// Before the window: the range still wins, so the window start is used.
		expect(resolveGrowthAnchor(model, '2025-01-01', 1, 3)).toBe(1)
	})

	test('never resolves to an index outside the window', () => {
		expect(resolveGrowthAnchor(model, '2026-01-01', 2, 3)).toBe(2)
	})
})

describe('growthFractionDigits', () => {
	test('sticks to conventional currency steps as the deposit scales', () => {
		// Never an odd count: "$1,950.1" reads as a formatting bug.
		expect(growthFractionDigits(1)).toBe(4)
		expect(growthFractionDigits(9.99)).toBe(4)
		expect(growthFractionDigits(10)).toBe(2)
		expect(growthFractionDigits(100)).toBe(2)
		expect(growthFractionDigits(999)).toBe(2)
		expect(growthFractionDigits(1000)).toBe(0)
		expect(growthFractionDigits(1847)).toBe(0)
		expect(growthFractionDigits(1_000_000)).toBe(0)
	})

	test('falls back to full precision for a nonsense deposit', () => {
		expect(growthFractionDigits(0)).toBe(4)
		expect(growthFractionDigits(-5)).toBe(4)
		expect(growthFractionDigits(Number.NaN)).toBe(4)
	})
})

describe('growthOutcomeLabel', () => {
	test('says nothing about an outcome this build does not know', () => {
		expect(growthOutcomeLabel(null)).toBeNull()
		expect(growthOutcomeLabel('something_new' as VerifiedExitOutcome)).toBeNull()
	})
})

describe('firstMeasuredIndex', () => {
	// Mirrors the prod-clone shape: years of reported history, weeks of measurement.
	const model = buildGrowthChart([
		day('2026-01-01', 10, null),
		day('2026-01-02', 10, { pps: null, outcome: 'unmeasured' }),
		day('2026-01-03', 10, { pps: 1 }),
		day('2026-01-04', 10, { pps: 1.1 })
	]) as GrowthChartModel

	test('finds the first day with a measured rate', () => {
		expect(firstMeasuredIndex(model, 0, 4)).toBe(2)
	})

	test('never reaches back before the requested window', () => {
		expect(firstMeasuredIndex(model, 3, 4)).toBe(3)
	})

	test('is -1 when the window holds no measurement', () => {
		expect(firstMeasuredIndex(model, 0, 2)).toBe(-1)
	})
})

describe('growthAxisDigits', () => {
	test('gives a tiny span enough decimals to separate its ticks', () => {
		// $1 deposit moving 3 hundredths of a cent: at 4 decimals ECharts printed
		// "$1.0002" twice in a row.
		expect(growthAxisDigits(0.0003)).toBe(5)
		expect(growthAxisDigits(0.00003)).toBe(6)
	})

	test('drops decimals as the span grows', () => {
		expect(growthAxisDigits(0.06)).toBe(3)
		expect(growthAxisDigits(0.5)).toBe(2)
		expect(growthAxisDigits(558)).toBe(0)
		expect(growthAxisDigits(1_000_000)).toBe(0)
	})

	test('falls back to full precision for a degenerate span', () => {
		expect(growthAxisDigits(0)).toBe(4)
		expect(growthAxisDigits(-1)).toBe(4)
		expect(growthAxisDigits(Number.NaN)).toBe(4)
	})
})

describe('growthReasonLabel', () => {
	test('passes an unknown code through', () => {
		expect(growthReasonLabel('some_new_code')).toBe('some_new_code')
		expect(growthReasonLabel(null)).toBeNull()
	})
})

const D = (n: number) => `2026-01-0${n}`

// The source pool's own measured rate, by date: the asset's growth is a ratio of two of these.
const source = (...rates: Array<number | null>): Record<string, number> =>
	Object.fromEntries(rates.flatMap((rate, i) => (rate == null ? [] : [[D(i + 1), rate]])))

const flat = (n: number) => Array.from({ length: n }, (_, i) => day(D(i + 1), 5, { pps: 1 }))

describe('buildIntrinsicSeries', () => {
	test('keeps measured days and drops the rest', () => {
		expect(
			buildIntrinsicSeries([
				day(D(1), 5, { pps: 1.2 }),
				day(D(2), 5, { pps: null }),
				day(D(3), 5, null),
				day(D(4), 5, { pps: 1.3 })
			])
		).toEqual({ [D(1)]: 1.2, [D(4)]: 1.3 })
	})

	test('is null when the source pool was never measured', () => {
		expect(buildIntrinsicSeries([day(D(1), 5, null)])).toBeNull()
		expect(buildIntrinsicSeries(null)).toBeNull()
	})
})

describe('intrinsic leg', () => {
	test('joins the source rate by date and flags a pool that has one', () => {
		const model = buildGrowthChart(flat(2), source(1, 1.1)) as GrowthChartModel

		expect(model.sourcePps).toEqual([1, 1.1])
		expect(model.hasIntrinsic).toBe(true)
	})

	test('flags a pool with no source, so the toggle never appears', () => {
		const model = buildGrowthChart(flat(2)) as GrowthChartModel

		expect(model.sourcePps).toEqual([null, null])
		expect(model.hasIntrinsic).toBe(false)
	})

	test('rebases the asset on the deposit day and leaves it flat there', () => {
		const model = buildGrowthChart(flat(3), source(1, 1.1, 1.21)) as GrowthChartModel
		const { combined, asset, assetAnchor } = buildGrowthSeries(model, 0, 3)

		expect(assetAnchor).toBe(0)
		expect(combined).toEqual([1, 1.1, 1.21])
		// Nothing earned at the deposit itself.
		expect(asset[0]).toBe(0)
		expect(asset[2]).toBeCloseTo(0.21, 12)
	})

	test('breaks on a day the source was not measured, and loses nothing to it', () => {
		const model = buildGrowthChart(flat(3), source(1, null, 1.21)) as GrowthChartModel
		const { combined } = buildGrowthSeries(model, 0, 3)

		expect(combined[1]).toBeNull()
		// A ratio, so the next measured day is exact: the gap costs nothing, where a compounded
		// rate would have lost that day's yield for good.
		expect(combined[2]).toBeCloseTo(1.21, 12)
	})

	test('draws no band at all when the source was not measured on the deposit day', () => {
		const model = buildGrowthChart(flat(3), source(null, 1, 1.1)) as GrowthChartModel
		const { combined, assetAnchor } = buildGrowthSeries(model, 0, 3)

		// Starting it a day late would leave that day's asset growth out while still calling the
		// result the whole deposit's, so the band waits for a basis on the deposit day itself.
		expect(assetAnchor).toBe(-1)
		expect(combined).toEqual([null, null, null])
	})

	test('subtracts from the pool line when the asset loses value', () => {
		const model = buildGrowthChart(flat(2), source(1, 0.9)) as GrowthChartModel
		const { measured, combined, asset } = buildGrowthSeries(model, 0, 2)

		expect(asset[1]).toBeCloseTo(-0.1, 12)
		expect(combined[1] as number).toBeLessThan(measured[1] as number)
	})

	test('draws nothing on a day the pool went unmeasured', () => {
		const model = buildGrowthChart(
			[day(D(1), 5, { pps: 1 }), day(D(2), 5, null), day(D(3), 5, { pps: 1 })],
			source(1, 1.1, 1.21)
		) as GrowthChartModel
		const { combined } = buildGrowthSeries(model, 0, 3)

		expect(combined[1]).toBeNull()
		expect(combined[2]).toBeCloseTo(1.21, 12)
	})
})

describe('buildCombinedSummary', () => {
	test('splits the total exactly between the two legs', () => {
		const history = [day(D(1), 5, { pps: 1 }), day(D(2), 5, { pps: 1 }), day(D(3), 5, { pps: 1.05 })]
		const model = buildGrowthChart(history, source(1, 1, 1.1)) as GrowthChartModel
		const growth = buildGrowthSeries(model, 0, 3)
		const pool = buildGrowthSummary(model, growth.anchor, 3, 1)!
		const combined = buildCombinedSummary(model, growth, 0, 3, 1)!

		expect(pool.gain).toBeCloseTo(0.05, 12)
		expect(combined.gain).toBeCloseTo(0.155, 12)
		expect(pool.gain + combined.assetGain).toBeCloseTo(combined.gain, 12)
	})

	test("annualizes the asset over its own span, not the pool's", () => {
		// Seven days of the asset compounding at 10% a year.
		const model = buildGrowthChart(flat(8), source(1, 1, 1, 1, 1, 1, 1, 1.1 ** (7 / 365))) as GrowthChartModel
		const combined = buildCombinedSummary(model, buildGrowthSeries(model, 0, 8), 0, 8, 1)!

		expect(combined.assetAnnualizedPct).toBeCloseTo(10, 9)
		expect(combined.days).toBe(7)
	})

	test('reads both legs at one endpoint, even when the source stops earlier', () => {
		const history = [day(D(1), 5, { pps: 1 }), day(D(2), 5, { pps: 1.1 }), day(D(3), 5, { pps: 1.2 })]
		const model = buildGrowthChart(history, source(1, 1.05, null)) as GrowthChartModel
		const growth = buildGrowthSeries(model, 0, 3)
		const pool = buildGrowthSummary(model, growth.anchor, 3, 10_000)!
		const combined = buildCombinedSummary(model, growth, 0, 3, 10_000)!

		// The pool's own summary runs to day three; the combined one must not mix that in.
		expect(pool.gain).toBeCloseTo(2000, 6)
		expect(combined.poolGain).toBeCloseTo(1000, 6)
		expect(combined.poolGain + combined.assetGain).toBeCloseTo(combined.gain, 6)
		expect(combined.asOf).toBe(Date.UTC(2026, 0, 2))
	})

	test('takes the drawdown from the combined series, not the pool alone', () => {
		// The pool never falls; the asset does.
		const model = buildGrowthChart(flat(3), source(1, 1.2, 1)) as GrowthChartModel
		const growth = buildGrowthSeries(model, 0, 3)

		expect(buildGrowthSummary(model, growth.anchor, 3, 1)!.drawdown).toBeNull()
		expect(buildCombinedSummary(model, growth, 0, 3, 1)!.drawdown?.pct).toBeCloseTo(-16.6667, 4)
	})

	test('reports no drawdown when the asset carries the pool back over its dip', () => {
		const history = [day(D(1), 5, { pps: 1 }), day(D(2), 5, { pps: 0.95 }), day(D(3), 5, { pps: 1.2 })]
		const model = buildGrowthChart(history, source(1, 1.2, 1.1)) as GrowthChartModel
		const growth = buildGrowthSeries(model, 0, 3)
		const pool = buildGrowthSummary(model, growth.anchor, 3, 1)!
		const combined = buildCombinedSummary(model, growth, 0, 3, 1)!

		// 1 -> 1.14 -> 1.32 never falls, even though the pool's own line dipped 5%.
		expect(pool.drawdown?.pct).toBeCloseTo(-5, 6)
		expect(combined.drawdown).toBeNull()
		// The readout must show nothing here. A `??` would reach past this null to the pool's 5% and
		// badge a fall against a line that never fell.
		expect(selectGrowthDrawdown(pool, combined)).toBeNull()
	})

	test('falls back to the pool dip only when the combined series is not shown', () => {
		const model = buildGrowthChart(flat(3), source(1, 1.2, 1)) as GrowthChartModel
		const growth = buildGrowthSeries(model, 0, 3)
		const pool = buildGrowthSummary(model, growth.anchor, 3, 1)!

		expect(selectGrowthDrawdown(pool, null)).toBe(pool.drawdown)
		expect(selectGrowthDrawdown(pool, buildCombinedSummary(model, growth, 0, 3, 1)!)?.pct).toBeCloseTo(-16.6667, 4)
	})

	test('is null when the window holds no measured day to anchor to', () => {
		const model = buildGrowthChart([day(D(1), 5, { pps: 1 }), day(D(2), 5, null)], source(1, 1.1)) as GrowthChartModel

		expect(buildCombinedSummary(model, buildGrowthSeries(model, 1, 2), 1, 2, 1)).toBeNull()
	})
})
