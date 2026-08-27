/**
 * One token's order book across exchanges: cumulative depth by distance from mid, one
 * superimposed curve per venue, bids left of mid and asks right.
 *
 * USD perps only. Spot has no measured execution on any venue, so a spot book here
 * could not be checked against a single real fill, and an unchecked book charted beside
 * checked ones can only look better than it has earned.
 *
 * For the same reason a venue with no measured fills for this token is left out, as is
 * one whose book we never captured. What remains is discounted by how far each venue's
 * fills missed what it quoted.
 *
 * Independent of the markets tabs: this is the venue comparison for the token, not a
 * picture of whichever rows the table happens to be filtered to.
 */
import * as React from 'react'
import { applySlippageHaircut, sumLadders, venueEntries, type DepthCurveVenue } from './depthCurve'
import { DepthCurveBody } from './DepthCurveBody'
import type { ExchangePairModel } from './models'

/** Named venues in the chart; the rest fold into one "Others" curve. */
const NAMED_VENUES = 12

/** What the book promised a $10k fill would cost against what those fills paid, per
 *  venue slug. A venue absent from this map is not charted. */
export type VenueSlippage = Record<string, { predictedBps: number | null; realizedBps: number | null }>

export type TokenDepthPair = ExchangePairModel & { venue?: string | null; venueSlug?: string | null }

/**
 * One entry per venue, its pairs' ladders added together, discounted by that venue's
 * measured slippage on this token.
 */
export function tokenDepthVenues(pairs: TokenDepthPair[], slippage: VenueSlippage = {}): DepthCurveVenue[] {
	const withFills = new Set(Object.keys(slippage))
	const byVenue = new Map<string, { name: string; pairs: TokenDepthPair[] }>()
	for (const pair of pairs) {
		if (!pair.depthLadder?.length) continue
		const slug = pair.venueSlug ?? pair.venue
		if (!slug) continue
		const entry = byVenue.get(slug) ?? { name: pair.venue ?? slug, pairs: [] }
		entry.pairs.push(pair)
		byVenue.set(slug, entry)
	}

	const venues: Array<DepthCurveVenue & { size: number }> = []
	for (const [slug, { name, pairs: venuePairs }] of byVenue) {
		if (!withFills.has(slug)) continue
		const summed = sumLadders(venuePairs.map((pair) => pair.depthLadder!))
		if (!summed) continue
		const fills = slippage[slug]
		const ladder = applySlippageHaircut(summed, fills?.predictedBps ?? null, fills?.realizedBps ?? null)
		const widest = ladder[ladder.length - 1]
		const size = (widest.bidUsd ?? 0) + (widest.askUsd ?? 0)
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
	/** Venues with measured fills for this token. Only these are charted. */
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
					{`Cumulative USD resting within each distance of mid on the USD perp venues where we measure ${symbol} fills, each venue's book discounted by how far its fills missed what it quoted. Curves are drawn on their own, not stacked.`}
				</p>
			</div>
			<DepthCurveBody entries={entries} />
		</section>
	)
}
