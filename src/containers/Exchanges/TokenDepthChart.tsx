/**
 * One token's order book across exchanges: cumulative depth by distance from mid, one
 * superimposed curve per venue, bids left of mid and asks right.
 *
 * USD perps only. Spot has no measured execution on any venue, so a spot book here
 * could not be checked against a single real fill, and an unchecked book charted beside
 * checked ones can only look better than it has earned.
 *
 * A venue's USD perp books are added together, because the page's job here is the
 * token's whole USD perp liquidity per venue, not one market of it. Where a venue's
 * fills were measured they discount the book they were measured on and no other:
 * BTCUSDT's realized slippage says nothing about BTCUSDC's book, and a venue with no
 * measured fills is charted undiscounted rather than dropped.
 *
 * Independent of the markets tabs: this is the venue comparison for the token, not a
 * picture of whichever rows the table happens to be filtered to.
 */
import * as React from 'react'
import { applySlippageHaircut, sumLadders, venueEntries, type DepthCurveVenue } from './depthCurve'
import { DepthCurveBody } from './DepthCurveBody'
import type { ExchangeDepthLadder, ExchangePairModel } from './models'

/** Named venues in the chart; the rest fold into one "Others" curve. */
const NAMED_VENUES = 12

/** What one exact book promised a $10k fill would cost against what those fills paid,
 *  keyed by venue slug. `symbol` is the only book the discount may be applied to. */
export type VenueSlippage = Record<string, { symbol: string; predictedBps: number | null; realizedBps: number | null }>

export type TokenDepthPair = ExchangePairModel & { venue?: string | null; venueSlug?: string | null }

/**
 * One entry per venue: all of its USD perp books for the token, added band by band,
 * with the measured book — and only that book — discounted by its own fills.
 */
export function tokenDepthVenues(pairs: TokenDepthPair[], slippage: VenueSlippage = {}): DepthCurveVenue[] {
	const byVenue = new Map<string, { name: string; ladders: ExchangeDepthLadder[] }>()
	for (const pair of pairs) {
		if (!pair.depthLadder?.length) continue
		const slug = pair.venueSlug ?? pair.venue
		if (!slug) continue
		const fills = slippage[slug]
		const measured = fills != null && pair.pairId === fills.symbol
		const ladder = measured
			? applySlippageHaircut(pair.depthLadder, fills.predictedBps, fills.realizedBps)
			: pair.depthLadder
		const entry = byVenue.get(slug) ?? { name: pair.venue ?? slug, ladders: [] }
		entry.ladders.push(ladder)
		byVenue.set(slug, entry)
	}

	const venues: Array<DepthCurveVenue & { size: number }> = []
	for (const [slug, { name, ladders }] of byVenue) {
		const ladder = sumLadders(ladders)
		if (!ladder) continue
		// Rank on the widest total the sum actually measured. sumLadders carries each
		// book's widest measured value outward, so the outermost non-null band holds it.
		const widest = ladder.findLast((point) => point.bidUsd != null || point.askUsd != null)
		const size = (widest?.bidUsd ?? 0) + (widest?.askUsd ?? 0)
		if (size <= 0) continue
		venues.push({ slug, name, ladder, size })
	}
	venues.sort((a, b) => b.size - a.size)
	return venues.map(({ slug, name, ladder }) => ({ slug, name, ladder }))
}

export function TokenDepthChart({
	pairs,
	slippage,
	symbol
}: {
	/** Every USD perp market for the token, regardless of the table's current tabs. */
	pairs: TokenDepthPair[]
	/** Venues and the exact market symbol whose fills discount that venue's book. */
	slippage?: VenueSlippage
	symbol: string
}) {
	const venues = React.useMemo(() => tokenDepthVenues(pairs, slippage), [pairs, slippage])
	const entries = React.useMemo(() => venueEntries(venues, NAMED_VENUES), [venues])

	// Nothing measured for this token: no panel rather than an empty frame.
	if (entries.length === 0) return null

	return (
		<section className="flex flex-col gap-2" aria-label={`${symbol} order-book depth`}>
			<div className="flex flex-col gap-0.5 px-1">
				<h3 className="label-md text-secondary">USD perp order book</h3>
				<p className="body-sm text-tertiary">
					{`Cumulative USD resting within each distance of mid across each venue's USD perp ${symbol} books. Where we measure fills, the book they were measured on is discounted by how far they missed its quote. Past where a book's snapshot reached, its widest measured total is carried forward, so a curve never falls outward. Curves are drawn on their own, not stacked.`}
				</p>
			</div>
			<DepthCurveBody entries={entries} />
		</section>
	)
}
