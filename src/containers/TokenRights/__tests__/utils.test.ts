import { describe, expect, it } from 'vitest'
import { getEquityPieTone } from '../utils'

describe('getEquityPieTone', () => {
	it('uses red when fundraising contains equity or equity captures revenue', () => {
		expect(getEquityPieTone(['Equity', 'Unknown'], null)).toBe('negative')
		expect(getEquityPieTone([], 'Yes')).toBe('negative')
	})

	it('uses yellow when fundraising is unknown or empty', () => {
		expect(getEquityPieTone(['Unknown'], 'No')).toBe('warning')
		expect(getEquityPieTone([], 'No')).toBe('warning')
	})

	it('uses green for known non-equity fundraising without equity revenue capture', () => {
		expect(getEquityPieTone(['Token Sale'], 'No')).toBe('positive')
		expect(getEquityPieTone(['Token Sale', 'Unknown'], 'No')).toBe('positive')
	})
})
