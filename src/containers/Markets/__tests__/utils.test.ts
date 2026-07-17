import { describe, expect, it } from 'vitest'
import { materialChange, pctChange } from '../utils'

describe('pctChange', () => {
	it('computes a fractional change', () => {
		expect(pctChange(120, 100)).toBeCloseTo(0.2)
	})

	it('returns null on missing or non-positive previous values', () => {
		expect(pctChange(120, null)).toBeNull()
		expect(pctChange(120, 0)).toBeNull()
		expect(pctChange(120, -1)).toBeNull()
	})
})

describe('materialChange', () => {
	it('marks a material current value with no previous value as new', () => {
		expect(materialChange(1_000_000, null)).toEqual({ kind: 'new' })
	})

	it('reports extreme changes from a tiny baseline as insufficient', () => {
		expect(materialChange(20_000, 1_000)).toEqual({ kind: 'insufficient-baseline' })
	})

	it('preserves percentage changes when the previous value is material', () => {
		const change = materialChange(1_200_000, 1_000_000)
		expect(change.kind).toBe('change')
		if (change.kind === 'change') {
			expect(change.fraction).toBeCloseTo(0.2)
		}
	})

	it('reports a missing current value as unavailable', () => {
		expect(materialChange(null, 1_000_000)).toEqual({ kind: 'unavailable' })
	})
})
