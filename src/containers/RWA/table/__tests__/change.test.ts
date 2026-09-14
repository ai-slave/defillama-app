import { describe, expect, test } from 'vitest'
import { percentChange, sumValuesWithPrior, toValueWithPrior } from '../change'

describe('percentChange', () => {
	test('returns the change in percent', () => {
		expect(percentChange(110, 100)).toBe(10)
		expect(percentChange(50, 100)).toBe(-50)
	})

	test('is unavailable without a usable prior', () => {
		expect(percentChange(110, null)).toBeNull()
		expect(percentChange(null, 100)).toBeNull()
		expect(percentChange(110, 0)).toBeNull()
	})
})

describe('sumValuesWithPrior', () => {
	test('sums current and prior over the rows that have both', () => {
		expect(
			sumValuesWithPrior([
				{ current: 100, prior: 90 },
				{ current: 50, prior: 60 }
			])
		).toEqual({ current: 150, prior: 150 })
	})

	test('leaves a row without a prior out of both sides', () => {
		expect(
			sumValuesWithPrior([
				{ current: 100, prior: 90 },
				{ current: 50, prior: null }
			])
		).toEqual({ current: 100, prior: 90 })
	})

	test('leaves a row without a current value out of both sides', () => {
		expect(
			sumValuesWithPrior([
				{ current: 100, prior: 90 },
				{ current: null, prior: 60 }
			])
		).toEqual({ current: 100, prior: 90 })
	})

	test('is unavailable when no row has both', () => {
		expect(sumValuesWithPrior([{ current: 5, prior: null }])).toEqual({ current: null, prior: null })
	})
})

describe('toValueWithPrior', () => {
	test('keeps the pair only when both sides exist', () => {
		expect(toValueWithPrior(10, 8)).toEqual({ current: 10, prior: 8 })
		expect(toValueWithPrior(10, null)).toEqual({ current: null, prior: null })
		expect(toValueWithPrior(null, 8)).toEqual({ current: null, prior: null })
	})
})
