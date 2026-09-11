import type { VerifiedExitStatus } from '../data/types'
import type { LiquidityChartModel } from './liquidityChart'

// "Would MY money have got out?" — the question the withdrawable series can answer and a deposits
// chart cannot. Everything here reads the same measured `available` series the chart draws, so the
// count and the line can never disagree with the picture.

export interface ExitCapacityAnswer {
	/** Measured days in the visible window that carry a withdrawable figure. */
	measuredDays: number
	/** Days that figure sat below the reader's position. */
	shortDays: number
	/** Share of measured days the position would have cleared, 0..1. */
	clearedShare: number
	/** Withdrawable on the worst measured day, for the "even at its thinnest" line. */
	floorUsd: number
	/** Position size that clears 90% of measured days — a sizing rule, not a promise. */
	comfortableUsd: number | null
}

function percentile(sorted: Array<number>, p: number): number | null {
	if (sorted.length === 0) return null
	const at = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))
	return sorted[at] ?? null
}

/**
 * Null when there is nothing to answer with: a pool whose exit is a queue has no instant lane to
 * size against, and one with no measured days has no history to count. Both cases hide the whole
 * feature rather than showing a zero, which would read as "you cannot get out".
 */
export function answerExitCapacity(
	model: LiquidityChartModel,
	positionUsd: number,
	range: { start: number; end: number }
): ExitCapacityAnswer | null {
	if (model.uncappedQueue) return null

	const available: Array<number> = []
	for (let i = 0; i < model.dates.length; i++) {
		const date = model.dates[i]
		if (date == null || date < range.start || date > range.end) continue
		const value = model.usd.available[i]
		if (value != null) available.push(value)
	}
	if (available.length === 0) return null

	const shortDays = available.filter((value) => value < positionUsd).length
	const sorted = [...available].sort((a, b) => a - b)

	return {
		measuredDays: available.length,
		shortDays,
		clearedShare: (available.length - shortDays) / available.length,
		floorUsd: sorted[0] ?? 0,
		// The 10th percentile: a size that would have cleared on nine days in ten.
		comfortableUsd: percentile(sorted, 0.1)
	}
}

// "How fast has the queue actually moved?" — the question a queued pool can answer and a capacity
// figure cannot, since a queue has no instant lane to size against. Deposits net off against
// withdrawals, so a fall is a FLOOR on what the queue processed, never the gross figure.

export interface QueueFlowAnswer {
	measuredDays: number
	/** Deposits in token units on the first and last measured day of the window. */
	from: number
	to: number
	/** Largest fall in deposits across any seven days, as a positive number. Zero if it never fell. */
	worstWeek: number
	worstWeekFrom: number
	worstWeekTo: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function answerQueueFlow(
	model: LiquidityChartModel,
	range: { start: number; end: number },
	/** Anything but a live queue answers null: a missing capacity series alone does not make one. */
	exitStatus: VerifiedExitStatus | null
): QueueFlowAnswer | null {
	if (exitStatus !== 'queued') return null
	if (!model.uncappedQueue) return null
	// Flows are read in token units only: in dollars a fall can be the price dropping, which says
	// nothing about what the queue processed.
	if (!model.hasUnits) return null

	const points: Array<{ date: number; total: number }> = []
	for (let i = 0; i < model.dates.length; i++) {
		const date = model.dates[i]
		if (date == null || date < range.start || date > range.end) continue
		const total = model.units.total[i]
		if (total != null) points.push({ date, total })
	}
	if (points.length < 2) return null

	let worstWeek = 0
	let worstWeekFrom = 0
	let worstWeekTo = 0
	for (let j = 1; j < points.length; j++) {
		const floor = points[j].date - WEEK_MS
		// Walks back by DATE, not by index, so a gap in measurement cannot pass for a week.
		for (let i = j - 1; i >= 0 && points[i].date >= floor; i--) {
			const fall = points[i].total - points[j].total
			if (fall > worstWeek) {
				worstWeek = fall
				worstWeekFrom = points[i].date
				worstWeekTo = points[j].date
			}
		}
	}

	return {
		measuredDays: points.length,
		from: points[0].total,
		to: points[points.length - 1].total,
		worstWeek,
		worstWeekFrom,
		worstWeekTo
	}
}
