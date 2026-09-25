import { describe, expect, test } from 'vitest'
import {
	formatExposureBreakdown,
	formatMinBadDebtValue,
	formatProtocolChains,
	formatProtocolExposureSummary,
	getAtRiskExposureUsd,
	getTokenRiskScopeLabel
} from '../TokenRisksSection.utils'

const chain = (chainDisplayName: string) => ({
	chain: chainDisplayName.toLowerCase(),
	chainDisplayName,
	totalCurrentMaxBorrowUsd: 100,
	totalMinBadDebtAtPriceZeroUsd: null,
	minBadDebtAtPriceZeroCoverage: 'unavailable' as const
})

describe('token risk display', () => {
	test('maximum possible exposure adds known bad debt to what can still be borrowed', () => {
		const totals = { totalCurrentMaxBorrowUsd: 1500, totalMinBadDebtAtPriceZeroUsd: 400 }

		expect(getAtRiskExposureUsd(totals)).toBe(1900)
		expect(formatExposureBreakdown(totals, 'USDC')).toBe(
			'$1,500 (max additional borrows against USDC) + $400 (bad debt if USDC was hacked now)'
		)
	})

	test('drops the bad-debt half of the breakdown when no market reports it', () => {
		const totals = { totalCurrentMaxBorrowUsd: 1500, totalMinBadDebtAtPriceZeroUsd: null }

		expect(getAtRiskExposureUsd(totals)).toBe(1500)
		expect(formatExposureBreakdown(totals, 'USDC')).toBe('$1,500 (max additional borrows against USDC)')
	})

	test('describes each protocol as bad debt plus additional borrowable, with -- for unknown bad debt', () => {
		expect(
			formatProtocolExposureSummary({ totalCurrentMaxBorrowUsd: 1000, totalMinBadDebtAtPriceZeroUsd: 400 }, 'USDC')
		).toBe('$1,400 at-risk exposure = $400 bad debt if hacked + $1,000 additional borrowable against USDC')
		expect(
			formatProtocolExposureSummary({ totalCurrentMaxBorrowUsd: 500, totalMinBadDebtAtPriceZeroUsd: null }, 'USDC')
		).toBe('$500 at-risk exposure = -- bad debt if hacked + $500 additional borrowable against USDC')
	})

	test('labels bad debt as partial or unavailable from its coverage', () => {
		expect(formatMinBadDebtValue(50, 'known')).toBe('$50')
		expect(formatMinBadDebtValue(50, 'partial')).toBe('$50 (partial)')
		expect(formatMinBadDebtValue(50, 'unavailable')).toBe('—')
		expect(formatMinBadDebtValue(null, 'known')).toBe('—')
	})

	test('names a single chain and counts several', () => {
		expect(formatProtocolChains([])).toBe('')
		expect(formatProtocolChains([chain('Ethereum')])).toBe('Ethereum')
		expect(formatProtocolChains([chain('Ethereum'), chain('Base')])).toBe('2 chains')
	})

	test('scopes the methodology copy to one chain, or onchain across several', () => {
		const ethereum = { key: 'ethereum:0x1', chain: 'ethereum', address: '0x1', displayName: 'Ethereum' }
		const base = { key: 'base:0x2', chain: 'base', address: '0x2', displayName: 'Base' }

		expect(getTokenRiskScopeLabel([ethereum])).toBe('Ethereum')
		expect(getTokenRiskScopeLabel([ethereum, base])).toBe('onchain')
	})
})
