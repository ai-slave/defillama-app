import { describe, expect, it } from 'vitest'
import type { IRawTokenRightsEntry } from '../api.types'
import { getEquityPieTone, parseTokenRightsEntry } from '../utils'

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

describe('parseTokenRightsEntry', () => {
	it('treats a null buybacks value from the upstream dataset as inactive', () => {
		const entry: IRawTokenRightsEntry = {
			'Protocol Name': 'Aave',
			Token: ['AAVE'],
			'Governance Decisions': ['AAVE'],
			'Treasury Decisions': ['AAVE'],
			'Revenue Decisions': ['AAVE'],
			'Fee Switch Status': 'OFF',
			Buybacks: null,
			Dividends: ['N/A'],
			Burns: 'N/A',
			'Last Updated': '2026-08-20',
			'DefiLlama ID': 'parent#aave'
		}

		expect(parseTokenRightsEntry(entry).valueAccrual.buybacks).toMatchObject({
			tokens: [],
			displayTokens: [],
			fallbackToken: 'N/A'
		})
	})
})
