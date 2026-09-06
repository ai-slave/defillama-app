import { describe, expect, test } from 'vitest'
import type { IRawTokenRightsEntry } from '../api.types'
import { getEquityPieTone, parseTokenRightsEntry } from '../utils'

describe('getEquityPieTone', () => {
	test('uses red when fundraising contains equity or equity captures revenue', () => {
		expect(getEquityPieTone(['Equity', 'Unknown'], null)).toBe('negative')
		expect(getEquityPieTone([], 'Yes')).toBe('negative')
	})

	test('uses yellow when fundraising is unknown or empty', () => {
		expect(getEquityPieTone(['Unknown'], 'No')).toBe('warning')
		expect(getEquityPieTone([], 'No')).toBe('warning')
	})

	test('uses green for known non-equity fundraising without equity revenue capture', () => {
		expect(getEquityPieTone(['Token Sale'], 'No')).toBe('positive')
		expect(getEquityPieTone(['Token Sale', 'Unknown'], 'No')).toBe('positive')
	})
})

describe('parseTokenRightsEntry', () => {
	test('treats omitted and null buybacks values as inactive', () => {
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
		expect(parseTokenRightsEntry(entry).overview).toMatchObject({
			lastUpdated: '2026-08-20',
			lastUpdatedLabel: 'Aug 20, 2026'
		})

		delete entry.Buybacks
		expect(parseTokenRightsEntry(entry).valueAccrual.buybacks).toMatchObject({
			tokens: [],
			displayTokens: [],
			fallbackToken: 'N/A'
		})
	})

	test('omits the updated label when the producer omits Last Updated', () => {
		const entry: IRawTokenRightsEntry = {
			'Protocol Name': 'Aave',
			Token: ['AAVE'],
			'Governance Decisions': ['AAVE'],
			'Treasury Decisions': ['AAVE'],
			'Revenue Decisions': ['AAVE'],
			'Fee Switch Status': 'OFF',
			Dividends: ['N/A'],
			Burns: 'N/A',
			'DefiLlama ID': 'parent#aave'
		}

		expect(parseTokenRightsEntry(entry).overview).toMatchObject({
			lastUpdated: null,
			lastUpdatedLabel: null
		})
	})
})
