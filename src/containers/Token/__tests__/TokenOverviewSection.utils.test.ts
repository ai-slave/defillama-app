import { describe, expect, test } from 'vitest'
import { roundToSignificantFigures } from '../TokenOverviewSection.utils'

describe('roundToSignificantFigures', () => {
	test('rounds a BTC-sized price down to 4 significant figures', () => {
		expect(roundToSignificantFigures(118_000 * 0.95)).toBe(112_100)
	})

	test('rounds a sub-cent memecoin price down to 4 significant figures', () => {
		expect(roundToSignificantFigures(0.00004521 * 0.95)).toBe(0.00004295)
	})

	test('keeps a mid-range price at 4 significant figures', () => {
		expect(roundToSignificantFigures(4521.789)).toBe(4522)
	})

	test('preserves sign for negative input', () => {
		expect(roundToSignificantFigures(-4521.789)).toBe(-4522)
	})

	test('returns 0 for a 0 input', () => {
		expect(roundToSignificantFigures(0)).toBe(0)
	})

	test('returns 0 for non-finite input instead of throwing', () => {
		expect(roundToSignificantFigures(NaN)).toBe(0)
		expect(roundToSignificantFigures(Infinity)).toBe(0)
		expect(roundToSignificantFigures(-Infinity)).toBe(0)
	})

	test('supports a custom significant-figure count', () => {
		expect(roundToSignificantFigures(118_000 * 0.95, 2)).toBe(110_000)
	})
})
