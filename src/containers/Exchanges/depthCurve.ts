/**
 * Market-depth curves: cumulative USD resting at each distance from mid.
 *
 * Two things make these comparable across venues. The x-axis is the distance from each
 * market's own mid rather than a price, so books on different assets share an axis at
 * all. And the axis is CATEGORICAL over whatever bands the API returns: on a numeric
 * scale the bands that matter most (0.1% to 2%) collapse into a sliver beside the 25%
 * band and cannot be read.
 *
 * Both sides live on one axis, bids left of mid and asks right, and the curves are
 * SUPERIMPOSED rather than stacked. Stacking answers "what do these add up to", which
 * is the wrong question here: a trader is choosing between venues, so the curves have
 * to be readable against each other.
 *
 * Each entry is ONE series spanning the whole axis, not one per side. That is what
 * makes a legend a list of exchanges instead of exchange-and-side pairs, and it draws
 * the shape a depth chart is supposed to have: down to nothing at mid, up on both
 * sides.
 *
 * Every value is cumulative outward from mid: the point at 2% is everything within 2%,
 * not a slice at 2%.
 */
import { formatPercent } from '~/utils/numberFormat'
import type { ExchangeDepthLadder, ExchangeLiquidityRelation, ExchangeSegment } from './models'

export interface DepthCurveVenue {
	slug: string
	name: string
	ladder: ExchangeDepthLadder
}

/**
 * The four things a curve reads off a venue row. Narrower than a directory row on
 * purpose: the charts page ships exactly this, so a full listing payload never rides
 * along in the props of a page that would ignore it. A directory row satisfies it.
 */
export interface DepthCurveRow {
	slug: string
	name: string
	liquidity?: Partial<Record<ExchangeSegment, ExchangeLiquidityRelation | null>> | null
	segments: Partial<Record<ExchangeSegment, { depthLadder?: ExchangeDepthLadder | null } | undefined>>
}

/** One named curve: a venue, a segment, or an aggregate of either. */
export interface DepthCurveEntry {
	name: string
	ladder: ExchangeDepthLadder
}

export interface DepthCurveDataset {
	source: Array<Array<string | number | null>>
	dimensions: string[]
	/** Series names in dataset column order; one per entry, so one per legend item. */
	series: string[]
}

const OTHERS_LABEL = 'Others'

/** `0.0025` reads as `0.25%`, `0.25` as `25%`: enough precision for the tight bands
 *  without trailing zeros on the wide ones. Signed so the axis says which side. */
export function bandLabel(band: number, side: 'bid' | 'ask'): string {
	return `${side === 'bid' ? '-' : '+'}${formatPercent(band, { input: 'fraction', maximumFractionDigits: 2 })}`
}

/**
 * Venues that run the segment and have a captured book, deepest first.
 *
 * A venue trading on another venue's book is left out: OKX EU's spot rows are OKX's
 * spot rows, and counting both would double that liquidity. Same rule the backend
 * applies to every cross-venue total.
 */
export function depthCurveVenues(rows: DepthCurveRow[], segment: ExchangeSegment, limit?: number): DepthCurveVenue[] {
	const venues: Array<DepthCurveVenue & { size: number }> = []
	for (const row of rows) {
		if (row.liquidity?.[segment]?.mode === 'shared') continue
		const ladder = row.segments[segment]?.depthLadder
		if (!ladder?.length) continue
		const widest = ladder[ladder.length - 1]
		const size = (widest.bidUsd ?? 0) + (widest.askUsd ?? 0)
		if (size <= 0) continue
		venues.push({ slug: row.slug, name: row.name, ladder, size })
	}
	venues.sort((a, b) => b.size - a.size)
	const kept = limit == null ? venues : venues.slice(0, limit)
	return kept.map(({ slug, name, ladder }) => ({ slug, name, ladder }))
}

/** Band-wise sum across ladders. Coverage is averaged; it rides along for shape parity
 *  and is not plotted. */
export function sumLadders(ladders: ExchangeDepthLadder[]): ExchangeDepthLadder | null {
	const bands = ladders[0]
	if (!bands?.length) return null
	return bands.map((band, index) => {
		let bidUsd: number | null = null
		let askUsd: number | null = null
		let coverage = 0
		for (const ladder of ladders) {
			const entry = ladder[index]
			if (!entry) continue
			if (entry.bidUsd != null) bidUsd = (bidUsd ?? 0) + entry.bidUsd
			if (entry.askUsd != null) askUsd = (askUsd ?? 0) + entry.askUsd
			coverage += entry.coverage
		}
		return { band: band.band, bidUsd, askUsd, coverage: coverage / ladders.length }
	})
}

/** Every venue's book added together, as one curve. */
export function aggregateEntries(venues: DepthCurveVenue[]): DepthCurveEntry[] {
	const summed = sumLadders(venues.map((venue) => venue.ladder))
	return summed ? [{ name: 'All exchanges', ladder: summed }] : []
}

/**
 * One curve per venue. Past `limit` the tail is folded into a single "Others" curve
 * rather than dropped, so the chart still accounts for the whole book and no venue
 * silently disappears.
 */
export function venueEntries(venues: DepthCurveVenue[], limit: number): DepthCurveEntry[] {
	const entries: DepthCurveEntry[] = venues.slice(0, limit).map((venue) => ({ name: venue.name, ladder: venue.ladder }))
	const tail = venues.slice(limit)
	const others = tail.length ? sumLadders(tail.map((venue) => venue.ladder)) : null
	if (others) entries.push({ name: `${OTHERS_LABEL} (${tail.length})`, ladder: others })
	return entries
}

/**
 * The whole book on one axis: widest bid inward to mid, then out to the widest ask.
 * One column per entry, carrying its bid depth on the left of mid and its ask depth on
 * the right.
 *
 * Mid is a real row at zero. A book holds no cumulative depth at zero distance, so
 * anchoring there is both true and what makes each curve a continuous line that dips to
 * the origin and rises again, rather than two pieces with a step between them.
 */
export function depthCurveDataset(entries: DepthCurveEntry[]): DepthCurveDataset | null {
	const bands = entries[0]?.ladder
	if (!bands?.length) return null
	const series = entries.map((entry) => entry.name)
	const source: Array<Array<string | number | null>> = []
	for (let index = bands.length - 1; index >= 0; index--) {
		source.push([bandLabel(bands[index].band, 'bid'), ...entries.map((entry) => entry.ladder[index]?.bidUsd ?? null)])
	}
	source.push(['0%', ...entries.map(() => 0)])
	for (let index = 0; index < bands.length; index++) {
		source.push([bandLabel(bands[index].band, 'ask'), ...entries.map((entry) => entry.ladder[index]?.askUsd ?? null)])
	}
	return { source, dimensions: ['band', ...series], series }
}

/**
 * Most a book can lose to the slippage check. A book that delivered four times worse
 * than it advertised is not four times thinner than it showed, and pushing the curve
 * that far down would say more about our confidence than about the venue. Half is
 * enough to reorder two books without erasing either.
 */
export const MAX_SLIPPAGE_HAIRCUT = 0.5

/**
 * How much of the displayed book to keep, given what the order book promised a $10k
 * fill would cost and what those fills actually paid.
 *
 * A book that delivered what it showed keeps all of it. One that quoted 0.1% and
 * delivered 0.2% kept half: the depth it displayed at that distance was, in practice,
 * only half there. Beating the quote earns nothing back, because depth we never
 * measured is not evidence of extra depth.
 */
export function slippageHaircutFactor(predictedBps: number | null, realizedBps: number | null): number {
	if (predictedBps == null || realizedBps == null) return 1
	if (!(predictedBps > 0) || !(realizedBps > 0)) return 1
	if (realizedBps <= predictedBps) return 1
	return Math.max(MAX_SLIPPAGE_HAIRCUT, predictedBps / realizedBps)
}

/**
 * Discount the bands between the promised and the delivered distance.
 *
 * Only that span is touched. The miss is evidence about the depth sitting between
 * where the book said the fill would land and where it actually landed; bands further
 * out were never part of that claim.
 *
 * Tighter bands are then clamped to the discounted value. They are not penalised on
 * their own account: a cumulative curve cannot decrease outward, and reducing a band
 * without clamping what sits inside it would claim more depth within 0.5% than within
 * 1%.
 */
export function applySlippageHaircut(
	ladder: ExchangeDepthLadder,
	predictedBps: number | null,
	realizedBps: number | null
): ExchangeDepthLadder {
	const factor = slippageHaircutFactor(predictedBps, realizedBps)
	if (factor === 1) return ladder
	const from = (predictedBps as number) / 10_000
	const to = (realizedBps as number) / 10_000
	const scale = (value: number | null, discounted: boolean) =>
		value == null ? null : discounted ? value * factor : value

	const adjusted = ladder.map((band) => {
		const inSpan = band.band >= from && band.band <= to
		return { ...band, bidUsd: scale(band.bidUsd, inSpan), askUsd: scale(band.askUsd, inSpan) }
	})
	for (let index = adjusted.length - 2; index >= 0; index--) {
		const outer = adjusted[index + 1]
		const inner = adjusted[index]
		adjusted[index] = {
			...inner,
			bidUsd: inner.bidUsd == null || outer.bidUsd == null ? inner.bidUsd : Math.min(inner.bidUsd, outer.bidUsd),
			askUsd: inner.askUsd == null || outer.askUsd == null ? inner.askUsd : Math.min(inner.askUsd, outer.askUsd)
		}
	}
	return adjusted
}
