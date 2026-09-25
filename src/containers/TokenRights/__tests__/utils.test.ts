import { describe, expect, test } from 'vitest'
import type { IRawTokenRightsEntry } from '../api.types'
import {
	formatTokenRightsRaiseUsd,
	getEquityPieTone,
	getTokenRightsPieSegments,
	hasTokenRightsPrimaryValueAccrual,
	parseTokenRightsEntry
} from '../utils'

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

describe('primary value accrual', () => {
	const entry: IRawTokenRightsEntry = {
		'Protocol Name': 'Test Protocol',
		Token: ['N/A', 'TEST'],
		'Governance Decisions': ['TEST'],
		'Treasury Decisions': ['TEST'],
		'Revenue Decisions': ['TEST'],
		'Fee Switch Status': 'OFF',
		Dividends: ['N/A'],
		Burns: 'N/A',
		'DefiLlama ID': 'test-protocol'
	}

	test('shows the mechanism and its details, never N/A as the mechanism', () => {
		const parsed = parseTokenRightsEntry({
			...entry,
			'Value Accrual': 'N/A',
			'Value Accrual Details': 'No primary accrual mechanism.'
		})
		expect(parsed.valueAccrual).toMatchObject({ primary: null, details: 'No primary accrual mechanism.' })
		expect(hasTokenRightsPrimaryValueAccrual(parsed)).toBe(true)
		expect(parseTokenRightsEntry({ ...entry, 'Value Accrual': 'Buybacks' }).valueAccrual.primary).toBe('Buybacks')
	})

	test('shows the card when either the mechanism or its details exist, and hides it when neither does', () => {
		expect(hasTokenRightsPrimaryValueAccrual(parseTokenRightsEntry({ ...entry, 'Value Accrual': 'N/A' }))).toBe(false)
		expect(hasTokenRightsPrimaryValueAccrual(parseTokenRightsEntry(entry))).toBe(false)
		expect(hasTokenRightsPrimaryValueAccrual(parseTokenRightsEntry({ ...entry, 'Value Accrual': 'Buybacks' }))).toBe(
			true
		)
		expect(
			hasTokenRightsPrimaryValueAccrual(parseTokenRightsEntry({ ...entry, 'Value Accrual Details': 'Fees' }))
		).toBe(true)
	})

	test('drops inactive token labels from the identity pills', () => {
		expect(parseTokenRightsEntry(entry).overview.identityTokens).toEqual(['TEST'])
	})
})

test('shows a disclosed zero raise as $0 and only an unknown amount as a dash', () => {
	expect(formatTokenRightsRaiseUsd(0)).toBe('$0')
	expect(formatTokenRightsRaiseUsd(null)).toBe('—')
	expect(formatTokenRightsRaiseUsd(14_000_000)).toBe('$14m')
})

describe('getTokenRightsPieSegments', () => {
	const entry: IRawTokenRightsEntry = {
		'Protocol Name': 'Test Protocol',
		Token: ['TEST'],
		'Governance Decisions': ['TEST'],
		'Treasury Decisions': ['N/A'],
		'Revenue Decisions': ['TEST'],
		'Fee Switch Status': 'OFF',
		Buybacks: ['TEST'],
		Dividends: ['N/A'],
		Burns: 'N/A',
		'Value Accrual': 'Buybacks',
		Fundraising: ['Token Sale'],
		'Equity Revenue Capture': 'No',
		'Last Updated': '2026-04-15',
		'DefiLlama ID': 'test-protocol'
	}

	test('marks each right the token holds, with buybacks alone counting as value accrual', () => {
		expect(getTokenRightsPieSegments(parseTokenRightsEntry(entry))).toEqual([
			{ label: 'Treasury', tone: 'negative' },
			{ label: 'Revenue', tone: 'positive' },
			{ label: 'Burns', tone: 'negative' },
			{ label: 'Equity', tone: 'positive' },
			{ label: 'Value Accrual', tone: 'positive' },
			{ label: 'Governance', tone: 'positive' }
		])
	})

	test('keeps value accrual inactive when neither dividends nor buybacks accrue value', () => {
		const segments = getTokenRightsPieSegments(
			parseTokenRightsEntry({ ...entry, Buybacks: ['None'], Dividends: ['None'] })
		)
		expect(segments.find((segment) => segment.label === 'Value Accrual')?.tone).toBe('negative')
	})
})
