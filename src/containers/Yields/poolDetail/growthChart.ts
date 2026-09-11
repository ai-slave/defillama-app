// "Growth of $X" model for the pool detail page.
//
// One line: the verified redemption rate (`verified.price_per_share`) rebased to the day the user
// chose to deposit, i.e. what a holder's money actually became, measured by simulating their
// withdrawal on-chain. The anchor is recomputed for whatever window is in view, which is why the
// raw series lives here and the rebasing happens per-render.
//
// Deliberately NOT compared against the pool's reported APY: reported APY includes reward tokens
// paid outside the share price, so a reward-paying pool would appear to underdeliver purely by
// construction (measured against 30 divergent pools, 19 were explained by reward APY alone).
//
// Days without a measured rate are honest gaps: they emit null and break the line. Nothing is
// ever interpolated across them. The one continuation allowed is the protocol's own QUOTED rate on
// a day the exit ran but could not price a full position (`price_per_share_quoted`, served only
// where the quote is corroborated against executed exits): it draws as its own dashed series with
// its own label, never spliced into the executed one — the quoted point is what the protocol said,
// the executed point is what a holder got.

import type { PoolHistoryPoint, VerifiedExitOutcome } from './types'

function ms(date: string): number {
	// Bare YYYY-MM-DD → pin to UTC midnight; anything else parse as-is.
	return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date)
}

export interface GrowthChartModel {
	dates: Array<number>
	// Measured underlying-per-share, unrebased. Null wherever the day produced no rate.
	pps: Array<number | null>
	// The quoted rate, only on days `pps` is null; null everywhere an executed rate exists.
	quoted: Array<number | null>
	// Why a day has no executed rate, for the tooltip. Null on executed and unmeasured days alike.
	reasons: Array<string | null>
	// That day's simulated-withdrawal outcome, for the tooltip.
	outcomes: Array<VerifiedExitOutcome | null>
}

export interface GrowthSeries {
	// Model index the line is anchored to (the deposit day), or -1 when the window contains no
	// measured rate at all.
	anchor: number
	// Window-length array, one entry per visible day.
	measured: Array<number | null>
	// The quoted continuation, rebased on the same basis, plus the executed point on either side of
	// each quoted run so the dashed segment joins the solid line instead of floating beside it.
	quoted: Array<number | null>
}

// Null unless at least one day carries a usable measured rate.
export function buildGrowthChart(series: Array<PoolHistoryPoint>): GrowthChartModel | null {
	if (series.length === 0) return null

	const dates = new Array<number>(series.length)
	const pps = new Array<number | null>(series.length)
	const quoted = new Array<number | null>(series.length)
	const reasons = new Array<string | null>(series.length)
	const outcomes = new Array<VerifiedExitOutcome | null>(series.length)
	let hasRate = false

	for (let index = 0; index < series.length; index++) {
		const point = series[index]
		const verified = point.verified ?? null
		// A non-positive rate can't be a basis or a ratio, so it is treated as unmeasured
		// rather than propagated into a nonsensical multiple.
		const rate = verified?.price_per_share ?? null
		const quote = verified?.price_per_share_quoted ?? null
		dates[index] = ms(point.date)
		pps[index] = rate != null && rate > 0 ? rate : null
		// The quote only ever stands in for a missing executed rate.
		quoted[index] = pps[index] == null && quote != null && quote > 0 ? quote : null
		reasons[index] = pps[index] == null ? (verified?.reason ?? null) : null
		outcomes[index] = verified?.exit?.outcome ?? null
		hasRate ||= pps[index] != null
	}

	// Executed rates only: a pool with nothing but quotes has nothing verified to show.
	if (!hasRate) return null

	return { dates, pps, quoted, reasons, outcomes }
}

// First day at or after `from` that carries a measured rate, or -1. Callers use it to begin the
// plotted window where measurement begins: a pool can hold years of reported history behind a few
// weeks of measurement, and rendering the unmeasured run as empty axis squeezes the line into a
// sliver at the right edge rather than telling the reader anything.
export function firstMeasuredIndex(model: GrowthChartModel, from: number, end: number): number {
	for (let index = Math.max(0, from); index < end; index++) {
		if (model.pps[index] != null) return index
	}
	return -1
}

// Rebases the line onto `[start, end)`. The anchor is the first day in the window with a measured
// rate — not simply the first day — so the line always starts at exactly the deposit and the
// result is never anchored to a day we didn't measure.
export function buildGrowthSeries(model: GrowthChartModel, start: number, end: number): GrowthSeries {
	const length = Math.max(0, end - start)
	const measured = new Array<number | null>(length).fill(null)
	const quoted = new Array<number | null>(length).fill(null)

	const anchor = firstMeasuredIndex(model, start, end)
	if (anchor === -1) return { anchor, measured, quoted }

	const basis = model.pps[anchor] as number
	for (let index = anchor; index < end; index++) {
		const rate = model.pps[index]
		measured[index - start] = rate == null ? null : rate / basis
	}
	for (let index = anchor; index < end; index++) {
		const quote = model.quoted[index]
		if (quote == null) continue
		quoted[index - start] = quote / basis
		// Bridge to the executed points on either side, so the dashed run leaves and rejoins the line.
		if (index > anchor && measured[index - 1 - start] != null) quoted[index - 1 - start] = measured[index - 1 - start]
		if (index + 1 < end && measured[index + 1 - start] != null) quoted[index + 1 - start] = measured[index + 1 - start]
	}

	return { anchor, measured, quoted }
}

export interface GrowthDrawdown {
	// Percent, always <= 0. The deepest peak-to-trough fall in the measured value.
	pct: number
	peakDate: number
	troughDate: number
	// True once the value has climbed back to its old peak — a past dip the holder has recovered
	// from reads very differently from one they are still under.
	recovered: boolean
}

export interface GrowthSummary {
	// Both are UTC-midnight timestamps: the deposit day and the last day actually measured, which
	// is NOT necessarily the last day in the window (the series can end in a gap).
	from: number
	to: number
	days: number
	endValue: number
	gain: number
	// Percent (5.6 = +5.6%), negative allowed — a measured loss must read as a loss.
	returnPct: number
	// Percent, annualized from the realized return. Null for windows too short to annualize
	// honestly: extrapolating two days of data to a yearly rate invents a number.
	annualizedPct: number | null
	// Null when the value never fell below a previous peak. Reported exactly as measured; the
	// caller decides what size is worth showing, so dust never becomes a scary headline.
	drawdown: GrowthDrawdown | null
}

// Windows shorter than this can't be annualized without the result being noise.
const MIN_ANNUALIZE_DAYS = 7
const DAYS_PER_YEAR = 365
const MS_PER_DAY = 86_400_000

// What the deposit actually became, measured from the anchor to the last measured day in the
// window. Null when the window holds no measurement.
export function buildGrowthSummary(
	model: GrowthChartModel,
	anchor: number,
	end: number,
	deposit: number
): GrowthSummary | null {
	if (anchor < 0 || anchor >= end) return null
	const basis = model.pps[anchor]
	if (basis == null) return null

	// Walk back from the window end so a trailing gap doesn't hide the last real measurement.
	let last = -1
	for (let index = end - 1; index >= anchor; index--) {
		if (model.pps[index] != null) {
			last = index
			break
		}
	}
	if (last < 0) return null

	const multiple = (model.pps[last] as number) / basis
	const endValue = deposit * multiple
	const days = Math.round((model.dates[last] - model.dates[anchor]) / MS_PER_DAY)
	const returnPct = (multiple - 1) * 100

	// Deepest peak-to-trough fall over the measured days. Gap days are skipped rather than treated
	// as zeroes, which would invent a total loss on every unmeasured day.
	let peak = basis
	let peakIndex = anchor
	let worstPct = 0
	let worstPeakIndex = anchor
	let worstTroughIndex = anchor
	for (let index = anchor; index <= last; index++) {
		const rate = model.pps[index]
		if (rate == null) continue
		if (rate > peak) {
			peak = rate
			peakIndex = index
		}
		const fallPct = (rate / peak - 1) * 100
		if (fallPct < worstPct) {
			worstPct = fallPct
			worstPeakIndex = peakIndex
			worstTroughIndex = index
		}
	}

	return {
		from: model.dates[anchor],
		to: model.dates[last],
		days,
		endValue,
		gain: endValue - deposit,
		returnPct,
		annualizedPct: days >= MIN_ANNUALIZE_DAYS ? (multiple ** (DAYS_PER_YEAR / days) - 1) * 100 : null,
		drawdown:
			worstPct < 0
				? {
						pct: worstPct,
						peakDate: model.dates[worstPeakIndex],
						troughDate: model.dates[worstTroughIndex],
						// Made back once the last value is at or above the peak THIS drawdown fell from; a later,
						// higher peak is a different question.
						recovered: (model.pps[last] as number) >= (model.pps[worstPeakIndex] as number)
					}
				: null
	}
}

// One kind only: a hole in the redemption-rate series is a hole in OUR coverage. Whether a
// withdrawal would have worked on those days is the exit chart's question, not this line's.
export type GrowthGapKind = 'unmeasured'

export interface GrowthGap {
	// Inclusive UTC-midnight bounds of the unmeasured run.
	from: number
	to: number
	days: number
	kind: GrowthGapKind
	label: string
}

// Runs of unmeasured days AFTER the deposit. Days before the anchor are not gaps — the deposit
// simply hadn't happened yet — so they are never shaded.
export function buildGrowthGaps(model: GrowthChartModel, anchor: number, end: number): Array<GrowthGap> {
	if (anchor < 0) return []
	const gaps: Array<GrowthGap> = []
	// Trailing nulls are excluded: the series just hasn't been measured up to today yet, which is a
	// coverage edge rather than an interruption inside the holder's period.
	let last = -1
	for (let index = end - 1; index >= anchor; index--) {
		if (model.pps[index] != null) {
			last = index
			break
		}
	}
	if (last < 0) return []

	// `last` is measured by definition, so every run opened inside the loop is also closed by it.
	// A day carried by the quoted rate is not a hole in coverage: the exit ran, it just could not
	// price the position, and the dashed continuation already says so.
	let runStart = -1
	for (let index = anchor; index <= last; index++) {
		const missing = model.pps[index] == null && model.quoted[index] == null
		if (missing) {
			if (runStart === -1) runStart = index
			continue
		}
		if (runStart !== -1) {
			gaps.push(describeGap(model, runStart, index - 1))
			runStart = -1
		}
	}

	return gaps
}

function describeGap(model: GrowthChartModel, from: number, to: number): GrowthGap {
	const days = to - from + 1
	return {
		from: model.dates[from],
		to: model.dates[to],
		days,
		kind: 'unmeasured',
		label: `Not measured · ${days} day${days === 1 ? '' : 's'}`
	}
}

// Resolves a "deposited on" date to a model index inside `[windowStart, end)`. A date that falls
// on a day the pool has no row for snaps FORWARD to the next day in the series, so clicking a
// weekend/gap still anchors somewhere real. Returns `windowStart` when the date is absent or falls
// outside the window — the range's own start is always a safe answer.
export function resolveGrowthAnchor(
	model: GrowthChartModel,
	anchorDate: string | null,
	windowStart: number,
	end: number
): number {
	if (!anchorDate) return windowStart
	const target = Date.parse(`${anchorDate}T00:00:00Z`)
	if (!Number.isFinite(target)) return windowStart
	for (let index = Math.max(0, windowStart); index < end; index++) {
		if (model.dates[index] >= target) return index
	}
	return windowStart
}

// Decimals for the money figures. Kept to conventional currency steps — 0, 2 or 4 — because an odd
// count reads as a formatting bug ($1,950.1). A big deposit needs none; a $1 deposit needs four or
// the whole movement rounds away. In between, two decimals is what money looks like, and the
// percentage shown alongside carries the precision the dollars drop.
export function growthFractionDigits(deposit: number): number {
	if (!Number.isFinite(deposit) || deposit <= 0) return 4
	if (deposit >= 1000) return 0
	if (deposit >= 10) return 2
	return 4
}

// Decimals an AXIS needs so its ticks do not collapse into duplicate labels. Driven by the plotted
// span rather than the deposit: a $1 deposit moving three hundredths of a cent needs five decimals
// to separate its ticks, while the same deposit over three years needs two. `growthFractionDigits`
// stays for the money readouts, where currency convention wins over tick separation.
export function growthAxisDigits(span: number): number {
	if (!Number.isFinite(span) || span <= 0) return 4
	return Math.max(0, Math.min(6, Math.ceil(-Math.log10(span)) + 1))
}

// Only outcomes this build knows are labelled. An unknown one yields null and the tooltip omits
// the row — never a guessed or negative claim about the pool.
const OUTCOME_LABELS: Record<VerifiedExitOutcome, string> = {
	ok_full: 'Exit: full',
	ok_partial: 'Exit: partial',
	delayed: 'Exit: queued',
	no_exit_primary: 'Exit: no redemption mechanism at this block',
	reverted_liquidity: 'Exit: reverted (liquidity)',
	reverted_paused: 'Exit: reverted (paused)',
	reverted_unknown: 'Exit: reverted',
	error_rpc: 'Exit: not measured (RPC error)',
	unmeasured: 'Exit: not measured'
}

export function growthOutcomeLabel(outcome: VerifiedExitOutcome | null | undefined): string | null {
	if (!outcome) return null
	return OUTCOME_LABELS[outcome] ?? null
}

// Why a measured day has no executed price. An unknown code is shown as-is: it still explains the
// gap better than silence, and inventing a friendlier claim would be guessing.
const REASON_LABELS: Record<string, string> = {
	rate_quality_floor: 'the redemption returned only dust',
	nav_quote_no_exit_path: 'the rate is a NAV quote with no exit path',
	no_executed_exit_path: 'no exit path could be executed'
}

export function growthReasonLabel(reason: string | null | undefined): string | null {
	if (!reason) return null
	return REASON_LABELS[reason] ?? reason
}
