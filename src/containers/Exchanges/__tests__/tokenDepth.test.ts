import { describe, expect, it } from 'vitest'
import type { ExchangeDepthLadder } from '../models'
import { tokenDepthVenues, type TokenDepthPair } from '../TokenDepthChart'

const BANDS = [0.01, 0.02, 0.25]

const ladder = (scale: number): ExchangeDepthLadder =>
	BANDS.map((band, index) => ({ band, bidUsd: (index + 1) * scale, askUsd: (index + 1) * scale, coverage: 1 }))

/** Fills that matched the quote: present, so the venue is charted, but no discount. */
const FILLS = { predictedBps: 10, realizedBps: 10 }

const pair = (venueSlug: string, depthLadder: ExchangeDepthLadder | null): TokenDepthPair =>
	({ venueSlug, venue: venueSlug, depthLadder }) as unknown as TokenDepthPair

/** Every venue used below has measured fills unless a test says otherwise. */
const MEASURED = { thin: FILLS, deep: FILLS, some: FILLS, none: FILLS, honest: FILLS }

describe('tokenDepthVenues', () => {
	it('adds a venue’s pairs together and ranks the deepest first', () => {
		const venues = tokenDepthVenues(
			[pair('thin', ladder(1)), pair('deep', ladder(10)), pair('deep', ladder(10))],
			MEASURED
		)
		expect(venues.map((venue) => venue.slug)).toEqual(['deep', 'thin'])
		// Two pairs of the same size on one venue: the widest band is both of them.
		expect(venues[0].ladder[2].bidUsd).toBe(60)
	})

	// A venue listing the token with no snapshot has nothing to contribute. Drawing it
	// at zero would read as "no liquidity here" when we simply did not look.
	it('leaves out venues with no captured book', () => {
		expect(tokenDepthVenues([pair('none', null), pair('some', ladder(1))], MEASURED).map((v) => v.slug)).toEqual([
			'some'
		])
		expect(tokenDepthVenues([pair('none', null)], MEASURED)).toEqual([])
	})

	// A book we have never seen a fill against is unverified depth. Charted beside books
	// that were checked, the unchecked one can only look better than it has earned.
	it('leaves out venues with no measured fills for this token', () => {
		const pairs = [pair('measured', ladder(10)), pair('unmeasured', ladder(10))]
		expect(tokenDepthVenues(pairs, { measured: FILLS }).map((venue) => venue.slug)).toEqual(['measured'])
		// No feed at all means nothing to chart, rather than everything unchecked.
		expect(tokenDepthVenues(pairs)).toEqual([])
	})

	it('discounts a venue by its own measured slippage and leaves the others alone', () => {
		const venues = tokenDepthVenues([pair('missed', ladder(10)), pair('honest', ladder(10))], {
			// Quoted 1%, delivered 2%: the 1% and 2% bands halve on this venue only.
			missed: { predictedBps: 100, realizedBps: 200 },
			honest: FILLS
		})
		const missed = venues.find((venue) => venue.slug === 'missed')!
		const honest = venues.find((venue) => venue.slug === 'honest')!
		expect(missed.ladder.map((band) => band.bidUsd)).toEqual([5, 10, 30])
		expect(honest.ladder.map((band) => band.bidUsd)).toEqual([10, 20, 30])
	})

	it('is untouched for a venue whose fills matched its quote', () => {
		const venues = tokenDepthVenues([pair('honest', ladder(10))], { honest: FILLS })
		expect(venues[0].ladder.map((band) => band.bidUsd)).toEqual([10, 20, 30])
	})
})
