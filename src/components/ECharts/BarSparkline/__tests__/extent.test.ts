import { expect, test } from 'vitest'
import { sparklineAxisMax, sparklineAxisMin } from '../extent'

test('keeps negative bars inside a padded extent', () => {
	expect(sparklineAxisMin({ min: -10, max: -5 })).toBeCloseTo(-10.4)
	expect(sparklineAxisMax({ min: -10, max: -5 })).toBeCloseTo(-4.6)
})

test('keeps a zero floor under non-negative bars', () => {
	expect(sparklineAxisMin({ min: 0, max: 10 })).toBe(0)
	expect(sparklineAxisMin({ min: 1, max: 10 })).toBe(0.28)
	expect(sparklineAxisMax({ min: 0, max: 10 })).toBe(10.8)
})

test('pads a flat series so its bars stay visible', () => {
	expect([sparklineAxisMin({ min: 20, max: 20 }), sparklineAxisMax({ min: 20, max: 20 })]).toEqual([19, 21])
	expect([sparklineAxisMin({ min: 0, max: 0 }), sparklineAxisMax({ min: 0, max: 0 })]).toEqual([-1, 1])
})
