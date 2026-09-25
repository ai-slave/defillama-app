import { describe, expect, test } from 'vitest'
import { buildProtocolValueChartQueryKey } from '~/containers/ProtocolOverview/valueChartSources'
import {
	getAdvancedTvlBreakdownSources,
	getBorrowedBreakdownSources,
	shouldSuppressAdvancedTvlTokenBreakdown,
	shouldSuppressBorrowedTokenBreakdown
} from '../protocolTvl'

function requireSource<T>(source: T | undefined): T {
	if (source === undefined) throw new Error('Expected protocol TVL source')
	return source
}

describe('borrowed TVL source selection', () => {
	test('shares one USD token source between line and pie cards', () => {
		const line = requireSource(getBorrowedBreakdownSources('aave', 'tokenBorrowedUsd')[0])
		const pie = requireSource(getBorrowedBreakdownSources('aave', 'tokensBorrowedPie')[0])

		expect(line).toEqual(pie)
		expect(buildProtocolValueChartQueryKey({ source: 'tvl', ...line.request })).toEqual(
			buildProtocolValueChartQueryKey({ source: 'tvl', ...pie.request })
		)
	})

	test('pairs the USD ranking source with the raw token source', () => {
		expect(getBorrowedBreakdownSources('aave', 'tokenBorrowedRaw')).toEqual([
			{
				kind: 'token-usd',
				request: { protocol: 'aave', key: 'borrowed', breakdownType: 'token-breakdown' }
			},
			{
				kind: 'token-raw',
				request: {
					protocol: 'aave',
					key: 'borrowed',
					breakdownType: 'token-breakdown',
					currency: 'token'
				}
			}
		])
	})

	test('keeps chain, USD token and raw token cache identities distinct', () => {
		const chainSource = requireSource(getBorrowedBreakdownSources('aave', 'chainsBorrowed')[0])
		const usdSource = requireSource(getBorrowedBreakdownSources('aave', 'tokenBorrowedUsd')[0])
		const rawSource = requireSource(getBorrowedBreakdownSources('aave', 'tokenBorrowedRaw')[1])
		const chain = buildProtocolValueChartQueryKey({ source: 'tvl', ...chainSource.request })
		const usd = buildProtocolValueChartQueryKey({ source: 'tvl', ...usdSource.request })
		const raw = buildProtocolValueChartQueryKey({ source: 'tvl', ...rawSource.request })

		expect(new Set([JSON.stringify(chain), JSON.stringify(usd), JSON.stringify(raw)])).toHaveLength(3)
	})

	test('suppresses borrowed token views but preserves the chain view for misrepresented protocols', () => {
		expect(shouldSuppressBorrowedTokenBreakdown('tokenBorrowedUsd', true)).toBe(true)
		expect(shouldSuppressBorrowedTokenBreakdown('tokensBorrowedPie', true)).toBe(true)
		expect(shouldSuppressBorrowedTokenBreakdown('tokenBorrowedRaw', true)).toBe(true)
		expect(shouldSuppressBorrowedTokenBreakdown('chainsBorrowed', true)).toBe(false)
		expect(shouldSuppressBorrowedTokenBreakdown('tokenBorrowedRaw', false)).toBe(false)
	})
})

describe('advanced TVL source selection', () => {
	test('requests only the breakdowns needed by a chain, USD or raw view', () => {
		expect(getAdvancedTvlBreakdownSources('aave', 'chainsTvl', {})).toEqual([
			{ kind: 'chain', request: { protocol: 'aave', key: undefined, breakdownType: 'chain-breakdown' } }
		])
		expect(getAdvancedTvlBreakdownSources('aave', 'tokenValuesUsd', {})).toEqual([
			{ kind: 'token-usd', request: { protocol: 'aave', key: undefined, breakdownType: 'token-breakdown' } }
		])
		expect(getAdvancedTvlBreakdownSources('aave', 'tokenBalances', {})).toEqual([
			{ kind: 'token-usd', request: { protocol: 'aave', key: undefined, breakdownType: 'token-breakdown' } },
			{
				kind: 'token-raw',
				request: { protocol: 'aave', key: undefined, breakdownType: 'token-breakdown', currency: 'token' }
			}
		])
	})

	test('requests both token currencies only for inflow views', () => {
		const sources = getAdvancedTvlBreakdownSources('aave', 'usdInflows', { staking: true })

		expect(sources.map((source) => [source.kind, source.request.key])).toEqual([
			['token-usd', undefined],
			['token-raw', undefined],
			['token-usd', 'staking'],
			['token-raw', 'staking']
		])
	})

	test('ignores aggregate TVL adjustment flags that are not protocol breakdowns', () => {
		const sources = getAdvancedTvlBreakdownSources('aave', 'chainsTvl', {
			doublecounted: true,
			liquidstaking: true,
			govtokens: true
		})

		expect(sources).toEqual([
			{ kind: 'chain', request: { protocol: 'aave', key: undefined, breakdownType: 'chain-breakdown' } }
		])
	})

	test('suppresses token breakdowns but preserves TVL and chain views for misrepresented protocols', () => {
		expect(shouldSuppressAdvancedTvlTokenBreakdown('tokenValuesUsd', true)).toBe(true)
		expect(shouldSuppressAdvancedTvlTokenBreakdown('tokenBalances', true)).toBe(true)
		expect(shouldSuppressAdvancedTvlTokenBreakdown('tvl', true)).toBe(false)
		expect(shouldSuppressAdvancedTvlTokenBreakdown('chainsTvl', true)).toBe(false)
		expect(shouldSuppressAdvancedTvlTokenBreakdown('tokenBalances', undefined)).toBe(false)
	})
})
