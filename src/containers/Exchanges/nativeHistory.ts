/**
 * Where our own measurement starts.
 *
 * History before this day is third-party backfill (per-pair open interest pulled from
 * Coinalyze, which reaches back to 2024 for some venues and not at all for others).
 * Our own collection covers far more venues and pairs than any backfill did, so the
 * switchover shows up on every cross-venue chart as a step change — and a step change
 * on a volume or open-interest chart reads as "usage doubled that month". It didn't;
 * our coverage did. There is no honest way to draw the two eras as one line, so the
 * charts start where the measurement does.
 *
 * ONE VALUE TO KEEP RIGHT: the day native collection became complete enough to be the
 * whole picture. Too early and the seam is back on the chart; too late and real
 * history is thrown away. Read it off the venue series — the day the tracked-venue
 * count stops climbing in steps — not off a deploy log.
 *
 * The upstream fix is a per-metric `native_since` on the series contract, which would
 * let each venue keep the history it genuinely has. Until then one date applies to
 * every chart, which over-clips venues we tracked earlier than most.
 */
export const NATIVE_HISTORY_START = Date.UTC(2026, 3, 1) / 1000 // 2026-04-01, UTC day start

/**
 * Index of the first day at or after the cutoff, or 0 when that would leave nothing.
 *
 * The clip must never empty a chart. A blank panel is worse than a stepped line, and
 * the cutoff is a hand-set date — if it is ever wrong, or a series simply ends before
 * it, failing open shows the data we have instead of silently deleting the product.
 */
function firstNativeIndex(days: number[]): number {
	const index = days.findIndex((day) => day >= NATIVE_HISTORY_START)
	return index === -1 ? 0 : index
}

/**
 * Drop the pre-native head of a columnar `{ days, series }` payload. Series columns
 * are sliced by the same index, so nothing can shift relative to the day axis.
 * Returns the input unchanged when there is nothing to clip.
 */
export function clipToNativeHistory<T extends Record<string, Array<number | null>>>(
	days: number[],
	series: T
): { days: number[]; series: T } {
	const start = firstNativeIndex(days)
	if (start === 0) return { days, series }
	const clipped = Object.fromEntries(Object.entries(series).map(([key, values]) => [key, values.slice(start)])) as T
	return { days: days.slice(start), series: clipped }
}

/** Same clip for the research surface, where each series carries its own values array. */
export function clipSeriesValues<T extends { values: Array<number | null> }>(
	days: number[],
	series: T[]
): { days: number[]; series: T[] } {
	const start = firstNativeIndex(days)
	if (start === 0) return { days, series }
	return {
		days: days.slice(start),
		series: series.map((entry) => ({ ...entry, values: entry.values.slice(start) }))
	}
}
