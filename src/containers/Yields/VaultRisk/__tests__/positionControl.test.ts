import { describe, expect, it } from 'vitest'
import { parseAmount } from '../components/PositionControl'

describe('parseAmount', () => {
	it('parses plain, formatted, and suffixed amounts', () => {
		expect(parseAmount('10000')).toBe(10_000)
		expect(parseAmount('10,000')).toBe(10_000)
		expect(parseAmount('$10,000')).toBe(10_000)
		expect(parseAmount('10k')).toBe(10_000)
		expect(parseAmount('1.5m')).toBe(1_500_000)
		expect(parseAmount(' $25K ')).toBe(25_000)
		expect(parseAmount('0.5k')).toBe(500)
	})

	it('rejects junk, zero, and negatives', () => {
		expect(parseAmount('')).toBeNull()
		expect(parseAmount('abc')).toBeNull()
		expect(parseAmount('10kk')).toBeNull()
		expect(parseAmount('-5')).toBeNull()
		expect(parseAmount('0')).toBeNull()
		expect(parseAmount('1e9')).toBeNull()
	})
})
