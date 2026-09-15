// "Deposits vs withdrawable" model for the pool detail page.
//
// Two stacked areas whose total is the measured deposits:
//   available - `verified.liquidity_available`, a BINDING CONSTRAINT: the most that could exit
//               right now. Not backing inventory. Labelled "withdrawable now".
//   remainder - the rest of the deposits, i.e. beyond that instant lane.
//
// The API serves a raw base-unit string AND a USD figure for each, so USD needs no price lookup on
// our side and native units need no guessing: `verified.denomination.decimals` gives the scale. A
// day can carry units without a USD price (~7% of measured days), so the two unit systems are
// tracked side by side rather than derived from one another.
//
// `remainder` is deliberately NOT called "locked" or "not withdrawable": a queued exit still works,
// it just is not immediate. And `liquidity_available: null` alongside `exit.status: 'queued'` is an
// UNCAPPED QUEUE - no instant lane at all - which must never render as "$0 withdrawable".

import type { PoolHistoryPoint, VerifiedExitOutcome } from './types'

function ms(date: string): number {
	return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date)
}

// Raw amounts are decimal strings of token base units, and several exceed
// Number.MAX_SAFE_INTEGER. They are reduced with BigInt arithmetic first and only converted once
// they are small enough to be exact, keeping six decimal places of the token.
const DISPLAY_DECIMALS = 6n
const DISPLAY_SCALE = 1e6

export function scaleRawUnits(raw: string | null | undefined, decimals: number | null | undefined): number | null {
	if (raw == null || raw === '') return null
	if (decimals == null || !Number.isInteger(decimals) || decimals < 0 || decimals > 78) return null
	let value: bigint
	try {
		value = BigInt(raw)
	} catch {
		// A malformed amount is treated as absent rather than guessed at.
		return null
	}
	const exponent = BigInt(decimals) - DISPLAY_DECIMALS
	const scaled = exponent >= 0n ? value / 10n ** exponent : value * 10n ** -exponent
	return Number(scaled) / DISPLAY_SCALE
}

// The two outcome classes this chart shades. Everything else (a working exit, or a day we simply
// did not measure) is left unshaded.
export type ExitClass = 'blocked' | 'partial'

const BLOCKED_OUTCOMES = new Set<VerifiedExitOutcome>(['reverted_liquidity', 'reverted_paused', 'reverted_unknown'])

export function exitClassOf(outcome: VerifiedExitOutcome | null | undefined): ExitClass | null {
	if (!outcome) return null
	if (BLOCKED_OUTCOMES.has(outcome)) return 'blocked'
	return outcome === 'ok_partial' ? 'partial' : null
}

export type LiquidityUnitKey = 'usd' | 'units'

/** One stacked series in a single unit. `remainder` is total minus available, floored at zero. */
export interface LiquiditySeries {
	total: Array<number | null>
	available: Array<number | null>
	remainder: Array<number | null>
}

export interface LiquidityChartModel {
	dates: Array<number>
	usd: LiquiditySeries
	// Native token units. All null when the pool carries no `denomination.decimals`, in which case
	// only the USD view is offered.
	units: LiquiditySeries
	classes: Array<ExitClass | null>
	// True on days the deposits are valued at the protocol's quoted rate because the exit could not
	// price them (`tvl_quoted`): the same supply, a different valuation, so the tooltip says so.
	quotedTotal: Array<boolean>
	symbol: string | null
	hasUnits: boolean
	// True when the pool reports measured deposits but never an instant lane: an uncapped queue,
	// which is a real state and emphatically not zero liquidity.
	uncappedQueue: boolean
}

function emptySeries(length: number): LiquiditySeries {
	return {
		total: new Array<number | null>(length).fill(null),
		available: new Array<number | null>(length).fill(null),
		remainder: new Array<number | null>(length).fill(null)
	}
}

// Null unless at least one day carries measured deposits. A pool with deposits but no instant lane
// still builds a model: the uncapped-queue state is worth showing, and hiding it would read as "no
// data" for pools that are simply queue-only.
export function buildLiquidityChart(
	series: Array<PoolHistoryPoint>,
	{ decimals, symbol }: { decimals: number | null; symbol: string | null }
): LiquidityChartModel | null {
	if (series.length === 0) return null

	const dates = new Array<number>(series.length)
	const usd = emptySeries(series.length)
	const units = emptySeries(series.length)
	const classes = new Array<ExitClass | null>(series.length)
	const quotedTotal = new Array<boolean>(series.length).fill(false)
	let hasTotal = false
	let hasUnits = false
	let hasAvailable = false

	for (let index = 0; index < series.length; index++) {
		const point = series[index]
		const verified = point.verified ?? null
		dates[index] = ms(point.date)
		classes[index] = exitClassOf(verified?.exit?.outcome)

		const quoted = verified?.tvl_usd == null && verified?.tvl == null
		const totalUsd = verified?.tvl_usd ?? (quoted ? (verified?.tvl_quoted_usd ?? null) : null)
		const availableUsd = verified?.liquidity_available_usd ?? null
		usd.total[index] = totalUsd
		usd.available[index] = availableUsd
		// An absent instant lane contributes nothing to the stack, so the remainder carries the whole
		// of the deposits rather than going null: the pool's size is still measured and worth drawing.
		usd.remainder[index] = totalUsd == null ? null : Math.max(totalUsd - (availableUsd ?? 0), 0)

		const totalUnits = scaleRawUnits(verified?.tvl ?? (quoted ? verified?.tvl_quoted : null), decimals)
		quotedTotal[index] = quoted && (totalUsd != null || totalUnits != null)
		const availableUnits = scaleRawUnits(verified?.liquidity_available, decimals)
		units.total[index] = totalUnits
		units.available[index] = availableUnits
		units.remainder[index] = totalUnits == null ? null : Math.max(totalUnits - (availableUnits ?? 0), 0)

		hasTotal ||= totalUsd != null || totalUnits != null
		hasUnits ||= totalUnits != null
		hasAvailable ||= availableUsd != null || availableUnits != null
	}

	if (!hasTotal) return null

	return { dates, usd, units, classes, quotedTotal, symbol, hasUnits, uncappedQueue: !hasAvailable }
}

// A live queue has no instant lane BY DESIGN, whatever the capacity probe returned on some days, so
// the chart shows deposits alone: the available series is dropped and the remainder carries the
// whole of the deposits, exactly as an uncapped queue is built.
export function depositsOnly(model: LiquidityChartModel): LiquidityChartModel {
	if (model.uncappedQueue) return model
	return { ...model, usd: withoutInstantLane(model.usd), units: withoutInstantLane(model.units), uncappedQueue: true }
}

function withoutInstantLane(series: LiquiditySeries): LiquiditySeries {
	return {
		total: series.total,
		available: new Array<number | null>(series.total.length).fill(null),
		remainder: series.total
	}
}

// First day at or after `from` carrying measured deposits, or -1. The plotted window starts where
// the measurement does: a pool can hold years of reported history behind a shorter measured run,
// and rendering that as empty axis compresses the areas into the right edge.
export function firstLiquidityIndex(model: LiquidityChartModel, from: number, end: number): number {
	for (let index = Math.max(0, from); index < end; index++) {
		if (model.usd.total[index] != null || model.units.total[index] != null) return index
	}
	return -1
}

export interface LiquidityBand {
	from: number
	to: number
	days: number
	kind: ExitClass
}

// Contiguous runs of the same exit class. `minDays` drops runs too short to draw as a legible band:
// across the dataset, runs of 3+ days hold the overwhelming majority of partial and blocked days,
// while one-day runs render as hairlines that read as chart artefacts rather than as status.
export function buildLiquidityBands(
	model: LiquidityChartModel,
	start: number,
	end: number,
	/** Runs shorter than this are dropped. Default 1: visibility is the renderer's job, via the band outline. */
	minDays = 1
): Array<LiquidityBand> {
	const bands: Array<LiquidityBand> = []
	let runStart = -1
	let runKind: ExitClass | null = null

	const flush = (endIndex: number) => {
		if (runStart === -1 || runKind == null) return
		const days = endIndex - runStart + 1
		if (days >= minDays) {
			bands.push({ from: model.dates[runStart], to: model.dates[endIndex], days, kind: runKind })
		}
		runStart = -1
		runKind = null
	}

	for (let index = Math.max(0, start); index < end; index++) {
		const kind = model.classes[index]
		if (kind !== runKind) {
			flush(index - 1)
			if (kind) {
				runStart = index
				runKind = kind
			}
		}
	}
	flush(end - 1)

	return bands
}

export interface LiquiditySummary {
	// Most recent day carrying measured deposits.
	asOf: number
	total: number
	// Null on an uncapped queue: there is no instant lane to measure, which is not zero.
	available: number | null
	remainder: number | null
	// Fraction of measured deposits withdrawable now, 0..1. Null on an uncapped queue.
	availableFraction: number | null
}

export function buildLiquiditySummary(
	model: LiquidityChartModel,
	start: number,
	end: number,
	unit: LiquidityUnitKey
): LiquiditySummary | null {
	const series = unit === 'usd' ? model.usd : model.units
	for (let index = end - 1; index >= Math.max(0, start); index--) {
		const total = series.total[index]
		if (total == null || total <= 0) continue
		const available = series.available[index]
		return {
			asOf: model.dates[index],
			total,
			available,
			remainder: available == null ? null : Math.max(total - available, 0),
			availableFraction: available == null ? null : Math.min(available / total, 1)
		}
	}
	return null
}
