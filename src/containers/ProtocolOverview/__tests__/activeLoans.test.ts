import { expect, test } from 'vitest'
import { getActiveLoansPanel } from '../activeLoans'

const noBreakdown = {
	isLoading: false,
	errorCount: 0,
	chainBreakdown: null,
	chainsUnique: [],
	tokenBreakdownUSD: null,
	tokensUnique: [],
	tokenBreakdownPieSeries: { peers: [], upstreamOthersValue: 0 },
	tokenRawBreakdown: null,
	rawTokensUnique: []
}

test('reports a failed breakdown request instead of calling the missing data unavailable', () => {
	expect(getActiveLoansPanel({ ...noBreakdown, errorCount: 1 })).toBe('none')
	expect(getActiveLoansPanel(noBreakdown)).toBe('empty')
})

test('shows charts once any breakdown has data, even when another request failed', () => {
	const pie = { peers: [{ name: 'USDC', value: 10 }], upstreamOthersValue: 0 }
	expect(getActiveLoansPanel({ ...noBreakdown, errorCount: 1, tokenBreakdownPieSeries: pie })).toBe('charts')
	expect(getActiveLoansPanel({ ...noBreakdown, tokenBreakdownUSD: [], tokensUnique: ['USDC'] })).toBe('charts')
})

test('a single-chain breakdown alone is not worth a chart', () => {
	expect(getActiveLoansPanel({ ...noBreakdown, chainBreakdown: [], chainsUnique: ['Ethereum'] })).toBe('empty')
	expect(getActiveLoansPanel({ ...noBreakdown, chainBreakdown: [], chainsUnique: ['Ethereum', 'Base'] })).toBe('charts')
})

test('shows loading while the breakdown loads', () => {
	expect(getActiveLoansPanel({ ...noBreakdown, isLoading: true, errorCount: 1 })).toBe('loading')
})
