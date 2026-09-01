import { describe, expect, it } from 'vitest'
import {
	aggregateEntries,
	applySlippageHaircut,
	bandLabel,
	depthCurveAriaLabel,
	depthCurveDataset,
	depthCurveVenues,
	MAX_SLIPPAGE_HAIRCUT,
	slippageHaircutFactor,
	venueEntries
} from '../depthCurve'
import type { ExchangeDepthLadder, ExchangeDirectoryRowModel } from '../models'

const BANDS = [0.01, 0.02, 0.25]

const ladder = (values: Array<[number, number]>): ExchangeDepthLadder =>
	values.map(([bidUsd, askUsd], index) => ({ band: BANDS[index], bidUsd, askUsd, coverage: 1 }))

const row = (
	slug: string,
	spot: ExchangeDepthLadder | null,
	liquidity: 'own' | 'shared' = 'own'
): ExchangeDirectoryRowModel =>
	({
		slug,
		name: slug,
		segments: { spot: { depthLadder: spot } },
		liquidity: { spot: { mode: liquidity } }
	}) as unknown as ExchangeDirectoryRowModel

const DEEP = ladder([
	[10, 12],
	[20, 24],
	[30, 36]
])

describe('depthCurveVenues', () => {
	it('ranks by the widest band and skips venues with no captured book', () => {
		const thin = ladder([
			[1, 1],
			[2, 2],
			[3, 3]
		])
		const venues = depthCurveVenues([row('thin', thin), row('deep', DEEP), row('none', null)], 'spot')
		expect(venues.map((venue) => venue.slug)).toEqual(['deep', 'thin'])
		expect(depthCurveVenues([row('deep', DEEP)], 'spot', 0)).toEqual([])
	})

	// A venue trading on another venue's book carries that book's rows. Counting both
	// doubles the same liquidity, which is why cross-venue totals exclude it.
	it('leaves out a venue whose book belongs to another venue', () => {
		const venues = depthCurveVenues([row('okx', DEEP), row('okx-eu', DEEP, 'shared')], 'spot')
		expect(venues.map((venue) => venue.slug)).toEqual(['okx'])
	})
})

describe('depthCurveDataset', () => {
	const dataset = depthCurveDataset(aggregateEntries(depthCurveVenues([row('a', DEEP), row('b', DEEP)], 'spot')))!

	// One slot per band from the API, not a numeric scale: on a numeric axis the tight
	// bands collapse into a sliver beside 25% and cannot be read.
	it('runs widest bid inward to mid and back out to widest ask', () => {
		expect(dataset.source.map((entry) => entry[0])).toEqual(['-25%', '-2%', '-1%', '0%', '+1%', '+2%', '+25%'])
	})

	// One series per entry, not one per side: that is what makes the legend a list of
	// exchanges rather than exchange-and-side pairs.
	it('gives each entry a single series spanning both sides', () => {
		expect(dataset.series).toEqual(['All exchanges'])
		expect(dataset.dimensions).toEqual(['band', 'All exchanges'])
		const column = dataset.dimensions.indexOf('All exchanges')
		// Bids fall inward to nothing at mid, then asks rise back out.
		expect(dataset.source.map((entry) => entry[column])).toEqual([60, 40, 20, 0, 24, 48, 72])
	})

	it('omits bands that were forward-filled past the measured book', () => {
		const partial = DEEP.map((point, index) => ({ ...point, coverage: index < 2 ? 1 : 0.5 }))
		const partialDataset = depthCurveDataset([{ name: 'Partial', ladder: partial }])!
		expect(partialDataset.source.map((entry) => entry[1])).toEqual([null, 20, 10, 0, 12, 24, null])
	})

	// Venue coverage is the share of the segment's volume whose book reached the band,
	// so a sliver of volume on an uncrawled market lands it at 0.9987 rather than 1.
	// Demanding exactly 1 there erased three quarters of the drawable points.
	it('draws a band a rounding error short of complete coverage', () => {
		const nearly = DEEP.map((point) => ({ ...point, coverage: 0.9987 }))
		const nearlyDataset = depthCurveDataset([{ name: 'Nearly', ladder: nearly }])!
		expect(nearlyDataset.source.map((entry) => entry[1])).toEqual([30, 20, 10, 0, 12, 24, 36])
	})

	it('has nothing to draw when every band is unmeasured', () => {
		const unmeasured = DEEP.map((point) => ({ ...point, coverage: 0 }))
		expect(depthCurveDataset([{ name: 'Unmeasured', ladder: unmeasured }])).toBeNull()
	})

	it('summarizes the widest fully measured point for screen readers', () => {
		const partial = DEEP.map((point, index) => ({ ...point, coverage: index < 2 ? 1 : 0.5 }))
		const label = depthCurveAriaLabel([{ name: 'Venue A', ladder: partial }])
		expect(label).toContain('Venue A: $20 bid and $24 ask within 2% of mid.')
		expect(label).toContain('Unmeasured outer bands are omitted.')
	})

	it('labels sub-percent bands precisely enough to tell them apart', () => {
		expect(bandLabel(0.001, 'bid')).toBe('-0.1%')
		expect(bandLabel(0.0025, 'ask')).toBe('+0.25%')
	})

	it('has nothing to draw without an entry', () => {
		expect(depthCurveDataset([])).toBeNull()
		expect(aggregateEntries([])).toEqual([])
	})
})

describe('summing books', () => {
	// Past a book's reach its widest measured total is carried forward: everything
	// within 0.9% is also within 1%, so the carry is a floor we observed. Dropping the
	// book instead let the sum decrease outward, which no cumulative curve may do.
	it('carries a ladder forward past the band it reached', () => {
		const shallow = DEEP.map((point, index) => ({ ...point, coverage: index === 0 ? 1 : 0 }))
		const [entry] = aggregateEntries([
			{ slug: 'deep', name: 'deep', ladder: DEEP },
			{ slug: 'shallow', name: 'shallow', ladder: shallow }
		])
		expect(entry.ladder.map((point) => point.bidUsd)).toEqual([20, 30, 40])
		expect(entry.ladder.map((point) => point.coverage)).toEqual([1, 1, 1])
	})

	it('reports a band no book reached as unmeasured, and charts nothing for it', () => {
		const unmeasured = DEEP.map((point) => ({ ...point, coverage: 0 }))
		const [entry] = aggregateEntries([{ slug: 'a', name: 'a', ladder: unmeasured }])
		expect(entry.ladder.map((point) => point.coverage)).toEqual([0, 0, 0])
		expect(depthCurveDataset([entry])).toBeNull()
	})
})

describe('venueEntries', () => {
	// The tail is grouped, never dropped: a chart that silently omits venues would not
	// account for the same book the aggregate view describes.
	it('folds venues past the limit into one Others curve', () => {
		const venues = depthCurveVenues([row('a', DEEP), row('b', DEEP), row('c', DEEP)], 'spot')
		const entries = venueEntries(venues, 1)
		expect(entries.map((entry) => entry.name)).toEqual(['a', 'Others (2)'])

		const widest = (name: string) => entries.find((entry) => entry.name === name)!.ladder[2].bidUsd!
		expect(widest('a') + widest('Others (2)')).toBe(aggregateEntries(venues)[0].ladder[2].bidUsd)
	})

	it('names every venue when they all fit', () => {
		const venues = depthCurveVenues([row('a', DEEP), row('b', DEEP)], 'spot')
		expect(venueEntries(venues, 10).map((entry) => entry.name)).toEqual(['a', 'b'])
	})
})

describe('slippageHaircutFactor', () => {
	it('keeps the whole book when it delivered what it showed, or better', () => {
		expect(slippageHaircutFactor(10, 10)).toBe(1)
		// Beating the quote earns nothing back: depth we never measured is not evidence.
		expect(slippageHaircutFactor(20, 10)).toBe(1)
	})

	it('keeps the share of the quote that was actually delivered', () => {
		// Quoted 0.1%, delivered 0.2%: half the displayed depth was really there.
		expect(slippageHaircutFactor(10, 20)).toBe(0.5)
		expect(slippageHaircutFactor(10, 12.5)).toBe(0.8)
	})

	// A book four times worse than advertised is not four times thinner than it showed.
	it('never removes more than half, however bad the miss', () => {
		expect(slippageHaircutFactor(10, 100)).toBe(MAX_SLIPPAGE_HAIRCUT)
		expect(slippageHaircutFactor(1, 1000)).toBe(MAX_SLIPPAGE_HAIRCUT)
	})

	it('does nothing without both measurements', () => {
		expect(slippageHaircutFactor(null, 20)).toBe(1)
		expect(slippageHaircutFactor(10, null)).toBe(1)
		expect(slippageHaircutFactor(0, 20)).toBe(1)
		expect(slippageHaircutFactor(-1, 20)).toBe(1)
	})
})

describe('applySlippageHaircut', () => {
	const evenLadder = (): ExchangeDepthLadder =>
		BANDS.map((band, index) => ({ band, bidUsd: (index + 1) * 20, askUsd: (index + 1) * 20, coverage: 1 }))

	it('discounts only the bands between the promised and the delivered distance', () => {
		// Quoted 1%, delivered 2%: both bands are inside that span, 25% is not.
		const out = applySlippageHaircut(evenLadder(), 100, 200)
		expect(out.map((band) => band.bidUsd)).toEqual([10, 20, 60])
		expect(out.map((band) => band.askUsd)).toEqual([10, 20, 60])
	})

	it('leaves the ladder alone when there is nothing to discount', () => {
		const input = evenLadder()
		expect(applySlippageHaircut(input, 200, 100)).toBe(input)
		expect(applySlippageHaircut(input, null, null)).toBe(input)
	})

	// A cumulative curve cannot decrease outward. Discounting 2% without touching 1%
	// would claim more depth within 1% than within 2%.
	it('clamps tighter bands so the curve never decreases outward', () => {
		const tight: ExchangeDepthLadder = [
			{ band: 0.01, bidUsd: 20, askUsd: 20, coverage: 1 },
			{ band: 0.02, bidUsd: 30, askUsd: 30, coverage: 1 },
			{ band: 0.25, bidUsd: 60, askUsd: 60, coverage: 1 }
		]
		const out = applySlippageHaircut(tight, 150, 300)
		expect(out.map((band) => band.bidUsd)).toEqual([15, 15, 60])
		for (let index = 1; index < out.length; index++) {
			expect(out[index].bidUsd!).toBeGreaterThanOrEqual(out[index - 1].bidUsd!)
		}
	})

	it('carries a missing side through untouched', () => {
		const oneSided = BANDS.map((band) => ({ band, bidUsd: null, askUsd: 40, coverage: 1 }))
		const out = applySlippageHaircut(oneSided, 100, 200)
		expect(out.map((band) => band.bidUsd)).toEqual([null, null, null])
		expect(out.map((band) => band.askUsd)).toEqual([20, 20, 40])
	})
})
