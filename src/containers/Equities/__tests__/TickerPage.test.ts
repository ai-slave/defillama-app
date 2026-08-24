import { describe, expect, it } from 'vitest'
import { getAvailableEquityTabs } from '../tickerPageState'

describe('EquityTickerPage availability', () => {
	it('keeps successful empty optional sources visible', () => {
		expect(getAvailableEquityTabs({ hasFilings: true, hasOnchain: true, hasUnlocks: false })).toEqual([
			'financials',
			'overview',
			'filings',
			'tokens',
			'markets'
		])
	})

	it('hides only unavailable optional sources', () => {
		expect(getAvailableEquityTabs({ hasFilings: false, hasOnchain: false, hasUnlocks: true })).toEqual([
			'financials',
			'overview',
			'unlocks'
		])
	})
})
