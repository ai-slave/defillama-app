import { describe, expect, test } from 'vitest'
import type { ExchangeDepthLadder } from '../models'
import { tokenDepthVenues, type TokenDepthPair } from '../TokenDepthChart'

const BANDS = [0.01, 0.02, 0.25]

const ladder = (scale: number): ExchangeDepthLadder =>
	BANDS.map((band, index) => ({ band, bidUsd: (index + 1) * scale, askUsd: (index + 1) * scale, coverage: 1 }))

/** Fills that matched the quote: measured, so no discount. */
const FILLS = { symbol: 'BTCUSDT', predictedBps: 10, realizedBps: 10 }

const pair = (venueSlug: string, depthLadder: ExchangeDepthLadder | null, pairId = 'BTCUSDT'): TokenDepthPair =>
	({ venueSlug, venue: venueSlug, pairId, depthLadder }) as unknown as TokenDepthPair

const MEASURED = { thin: FILLS, deep: FILLS, some: FILLS, none: FILLS, honest: FILLS }

describe('tokenDepthVenues', () => {
	// The token page's question is how deep a venue is in this asset's USD perps, which
	// is all of its books for the asset, not whichever one execution happens to sample.
	test('adds a venue’s USD perp books together and ranks the deepest first', () => {
		const venues = tokenDepthVenues(
			[pair('thin', ladder(1)), pair('deep', ladder(10)), pair('deep', ladder(10), 'BTCUSDC')],
			MEASURED
		)
		expect(venues.map((venue) => venue.slug)).toEqual(['deep', 'thin'])
		expect(venues[0].ladder[2].bidUsd).toBe(60)
	})

	// A measured symbol that names no charted book (Bitfinex's `t` prefix, a numeric
	// market id, or fills taken on the venue's COIN perp) costs the discount, not the
	// venue: an undiscounted book is still a book we captured.
	test('charts the venue undiscounted when the measured symbol matches no book', () => {
		const venues = tokenDepthVenues([pair('binance', ladder(10), 'BTCUSDC')], {
			binance: { symbol: 'BTCUSDT', predictedBps: 100, realizedBps: 200 }
		})
		expect(venues[0].ladder.map((band) => band.bidUsd)).toEqual([10, 20, 30])
	})

	// Past a book's reach its widest measured total is carried forward, never dropped:
	// depth within 25% is at least depth within 1%, so a cumulative curve cannot fall.
	// Dropping it made BingX's BTC curve go $1.1b within 0.75% to $18m within 1%.
	test('carries a book forward past its reach instead of dropping it', () => {
		const shallow = ladder(10).map((point, index) => ({ ...point, coverage: index === 0 ? 1 : 0 }))
		const venues = tokenDepthVenues([pair('deep', ladder(10)), pair('deep', shallow, 'BTCUSDC')], MEASURED)
		expect(venues[0].ladder.map((band) => band.bidUsd)).toEqual([20, 30, 40])
	})

	// A band no book reached stays unmeasured, so the curve ends where the crawls did
	// rather than running flat to the widest band.
	test('leaves bands no book reached unmeasured', () => {
		const shallow = ladder(10).map((point, index) => ({ ...point, coverage: index === 0 ? 1 : 0 }))
		const venues = tokenDepthVenues([pair('only', shallow)], MEASURED)
		expect(venues[0].ladder.map((band) => band.coverage)).toEqual([1, 0, 0])
	})

	// A venue listing the token with no snapshot has nothing to contribute. Drawing it
	// at zero would read as "no liquidity here" when we simply did not look.
	test('leaves out venues with no captured book', () => {
		expect(tokenDepthVenues([pair('none', null), pair('some', ladder(1))], MEASURED).map((v) => v.slug)).toEqual([
			'some'
		])
		expect(tokenDepthVenues([pair('none', null)], MEASURED)).toEqual([])
	})

	// Fills discount a book; they are not a licence to show it. Most venues running a
	// token's perp are never in the execution basket, and hiding their captured books
	// understated the token's real venue set.
	test('charts venues with no measured fills, undiscounted', () => {
		const pairs = [pair('measured', ladder(10)), pair('unmeasured', ladder(10))]
		expect(
			tokenDepthVenues(pairs, { measured: FILLS })
				.map((venue) => venue.slug)
				.sort()
		).toEqual(['measured', 'unmeasured'])
		expect(
			tokenDepthVenues(pairs)
				.map((venue) => venue.slug)
				.sort()
		).toEqual(['measured', 'unmeasured'])
	})

	test('discounts a venue by its own measured slippage and leaves the others alone', () => {
		const venues = tokenDepthVenues([pair('missed', ladder(10)), pair('honest', ladder(10))], {
			// Quoted 1%, delivered 2%: the 1% and 2% bands halve on this venue only.
			missed: { symbol: 'BTCUSDT', predictedBps: 100, realizedBps: 200 },
			honest: FILLS
		})
		const missed = venues.find((venue) => venue.slug === 'missed')!
		const honest = venues.find((venue) => venue.slug === 'honest')!
		expect(missed.ladder.map((band) => band.bidUsd)).toEqual([5, 10, 30])
		expect(honest.ladder.map((band) => band.bidUsd)).toEqual([10, 20, 30])
	})

	// One pair's fills cannot vouch for its sister market, so the discount stops at the
	// book it was measured on: BTCUSDT halves, BTCUSDC is added in at full size.
	test('discounts only the book its fills were measured on', () => {
		const venues = tokenDepthVenues([pair('venue', ladder(10)), pair('venue', ladder(10), 'BTCUSDC')], {
			venue: { symbol: 'BTCUSDT', predictedBps: 100, realizedBps: 200 }
		})
		expect(venues[0].ladder.map((band) => band.bidUsd)).toEqual([15, 30, 60])
	})

	test('is untouched for a venue whose fills matched its quote', () => {
		const venues = tokenDepthVenues([pair('honest', ladder(10))], { honest: FILLS })
		expect(venues[0].ladder.map((band) => band.bidUsd)).toEqual([10, 20, 30])
	})
})
