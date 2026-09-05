import { describe, expect, it } from 'vitest'
import { computeComparison } from '../comparison'

const base = { id: 'base', name: 'Base', symbol: 'B', market_cap: 100, max_supply: 100 }
const quote = { id: 'quote', name: 'Quote', symbol: 'Q', market_cap: 100, max_supply: 10 }

describe('token comparison prices', () => {
	it('keeps the base price when market caps are already equal despite different token prices', () => {
		expect(computeComparison({ value: 'mcap' }, [base, quote], [1, 10], new Map(), new Map())).toEqual({
			newPrice: 1,
			increase: 1
		})
	})
	it('scales the base price by the target metric ratio', () => {
		expect(
			computeComparison({ value: 'mcap' }, [base, { ...quote, market_cap: 300 }], [1, 10], new Map(), new Map())
		).toEqual({ newPrice: 3, increase: 3 })
	})
	it('preserves FDV target-price times target-supply divided by base-supply', () => {
		expect(computeComparison({ value: 'fdv' }, [base, quote], [2, 10], new Map(), new Map())).toEqual({
			newPrice: 1,
			increase: 0.5
		})
	})
	it('preserves zero target metrics and unavailable or zero base denominators', () => {
		expect(
			computeComparison({ value: 'mcap' }, [base, { ...quote, market_cap: 0 }], [1, 10], new Map(), new Map())
		).toEqual({ newPrice: 0, increase: 0 })
		for (const market_cap of [null, 0]) {
			expect(
				computeComparison({ value: 'mcap' }, [{ ...base, market_cap }, quote], [1, 10], new Map(), new Map())
			).toBeNull()
		}
		expect(computeComparison({ value: 'mcap' }, [base, undefined], [1, 10], new Map(), new Map())).toBeNull()
	})
})
