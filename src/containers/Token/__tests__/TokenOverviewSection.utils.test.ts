import { describe, expect, it } from 'vitest'
import { roundToSignificantFigures } from '../TokenOverviewSection.utils'

describe('roundToSignificantFigures', () => {
	it('rounds a BTC-sized price down to 4 significant figures', () => {
		expect(roundToSignificantFigures(118000 * 0.95)).toBe(112100)
	})

	it('rounds a sub-cent memecoin price down to 4 significant figures', () => {
		expect(roundToSignificantFigures(0.00004521 * 0.95)).toBe(0.00004295)
	})

	it('keeps a mid-range price at 4 significant figures', () => {
		expect(roundToSignificantFigures(4521.789)).toBe(4522)
	})

	it('preserves sign for negative input', () => {
		expect(roundToSignificantFigures(-4521.789)).toBe(-4522)
	})

	it('returns 0 for a 0 input', () => {
		expect(roundToSignificantFigures(0)).toBe(0)
	})

	it('returns 0 for non-finite input instead of throwing', () => {
		expect(roundToSignificantFigures(NaN)).toBe(0)
		expect(roundToSignificantFigures(Infinity)).toBe(0)
		expect(roundToSignificantFigures(-Infinity)).toBe(0)
	})

	it('supports a custom significant-figure count', () => {
		expect(roundToSignificantFigures(118000 * 0.95, 2)).toBe(110000)
	})
})
