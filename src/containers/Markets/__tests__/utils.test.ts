import { describe, expect, test } from 'vitest'
import { materialChange, pctChange } from '../utils'

describe('pctChange', () => {
	test('computes a fractional change', () => {
		expect(pctChange(120, 100)).toBeCloseTo(0.2)
	})

	test('returns null on missing or non-positive previous values', () => {
		expect(pctChange(120, null)).toBeNull()
		expect(pctChange(120, 0)).toBeNull()
		expect(pctChange(120, -1)).toBeNull()
	})
})

describe('materialChange', () => {
	test('marks a material current value with no previous value as new', () => {
		expect(materialChange(1_000_000, null)).toEqual({ kind: 'new' })
	})

	test('reports extreme changes from a tiny baseline as insufficient', () => {
		expect(materialChange(20_000, 1000)).toEqual({ kind: 'insufficient-baseline' })
	})

	test('preserves percentage changes when the previous value is material', () => {
		const change = materialChange(1_200_000, 1_000_000)
		expect(change.kind).toBe('change')
		if (change.kind === 'change') {
			expect(change.fraction).toBeCloseTo(0.2)
		}
	})

	test('reports a missing current value as unavailable', () => {
		expect(materialChange(null, 1_000_000)).toEqual({ kind: 'unavailable' })
	})
})
