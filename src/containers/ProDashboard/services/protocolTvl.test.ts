import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
	IProtocolChainBreakdownChart,
	IProtocolTokenBreakdownChart,
	IProtocolValueChart
} from '~/containers/ProtocolOverview/api.types'
import {
	fetchProtocolTvlBreakdownForDashboard,
	fetchProtocolTvlValueForDashboard,
	getAdvancedTvlBreakdownSources,
	getBorrowedBreakdownQueryKey,
	getBorrowedBreakdownSources,
	getProtocolTvlValueQueryKey,
	shouldSuppressAdvancedTvlTokenBreakdown,
	shouldSuppressBorrowedTokenBreakdown,
	type ProtocolTvlBreakdownSource
} from './protocolTvl'

type ChainBreakdownSource = Extract<ProtocolTvlBreakdownSource, { kind: 'chain' }>
type TokenUsdBreakdownSource = Extract<ProtocolTvlBreakdownSource, { kind: 'token-usd' }>
type TokenRawBreakdownSource = Extract<ProtocolTvlBreakdownSource, { kind: 'token-raw' }>

describe('protocol TVL service contracts', () => {
	it('correlates source kinds with exact request modes and non-null successes', () => {
		expectTypeOf<ChainBreakdownSource['request']['breakdownType']>().toEqualTypeOf<'chain-breakdown'>()
		expectTypeOf<TokenUsdBreakdownSource['request']>().toMatchTypeOf<{
			breakdownType: 'token-breakdown'
			currency?: never
		}>()
		expectTypeOf<TokenRawBreakdownSource['request']['currency']>().toEqualTypeOf<'token'>()
		expectTypeOf(fetchProtocolTvlValueForDashboard).returns.toEqualTypeOf<Promise<IProtocolValueChart>>()
		expectTypeOf(fetchProtocolTvlBreakdownForDashboard).toMatchTypeOf<
			(request: ChainBreakdownSource['request']) => Promise<IProtocolChainBreakdownChart>
		>()
		expectTypeOf(fetchProtocolTvlBreakdownForDashboard).toMatchTypeOf<
			(request: TokenUsdBreakdownSource['request']) => Promise<IProtocolTokenBreakdownChart>
		>()
		expectTypeOf(fetchProtocolTvlBreakdownForDashboard).toMatchTypeOf<
			(request: TokenRawBreakdownSource['request']) => Promise<IProtocolTokenBreakdownChart>
		>()
	})
})

describe('borrowed TVL source selection', () => {
	it('shares one USD token source between line and pie cards', () => {
		const [line] = getBorrowedBreakdownSources('aave', 'tokenBorrowedUsd')
		const [pie] = getBorrowedBreakdownSources('aave', 'tokensBorrowedPie')

		expect(line).toEqual(pie)
		if (!line || !pie) throw new Error('Expected borrowed token breakdown sources')
		expect(getBorrowedBreakdownQueryKey(line.request)).toEqual(getBorrowedBreakdownQueryKey(pie.request))
	})

	it('pairs the USD ranking source with the raw token source', () => {
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

	it('keeps chain, USD token and raw token cache identities distinct', () => {
		const [chainSource] = getBorrowedBreakdownSources('aave', 'chainsBorrowed')
		const [usdSource] = getBorrowedBreakdownSources('aave', 'tokenBorrowedUsd')
		const [, rawSource] = getBorrowedBreakdownSources('aave', 'tokenBorrowedRaw')
		if (!chainSource || !usdSource || !rawSource) throw new Error('Expected all borrowed breakdown source modes')
		const chain = getBorrowedBreakdownQueryKey(chainSource.request)
		const usd = getBorrowedBreakdownQueryKey(usdSource.request)
		const raw = getBorrowedBreakdownQueryKey(rawSource.request)

		expect(new Set([JSON.stringify(chain), JSON.stringify(usd), JSON.stringify(raw)])).toHaveLength(3)
	})

	it('suppresses borrowed token views but preserves the chain view for misrepresented protocols', () => {
		expect(shouldSuppressBorrowedTokenBreakdown('tokenBorrowedUsd', true)).toBe(true)
		expect(shouldSuppressBorrowedTokenBreakdown('tokensBorrowedPie', true)).toBe(true)
		expect(shouldSuppressBorrowedTokenBreakdown('tokenBorrowedRaw', true)).toBe(true)
		expect(shouldSuppressBorrowedTokenBreakdown('chainsBorrowed', true)).toBe(false)
		expect(shouldSuppressBorrowedTokenBreakdown('tokenBorrowedRaw', false)).toBe(false)
	})
})

describe('advanced TVL source selection', () => {
	it('uses the canonical Protocol Overview cache key for base TVL', () => {
		expect(getProtocolTvlValueQueryKey('aave')).toEqual([
			'protocol-overview',
			'tvl-chart',
			'aave',
			undefined,
			undefined,
			undefined,
			undefined
		])
	})

	it('requests only the breakdowns needed by a chain, USD or raw view', () => {
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

	it('uses USD token values to keep huge low-value raw quantities off the chart', () => {
		const sources = getAdvancedTvlBreakdownSources('aave', 'tokenBalances', {})

		expect(sources.map((source) => source.kind)).toEqual(['token-usd', 'token-raw'])
	})

	it('requests both token currencies only for inflow views', () => {
		const sources = getAdvancedTvlBreakdownSources('aave', 'usdInflows', { staking: true })

		expect(sources.map((source) => [source.kind, source.request.key])).toEqual([
			['token-usd', undefined],
			['token-raw', undefined],
			['token-usd', 'staking'],
			['token-raw', 'staking']
		])
	})

	it('ignores aggregate TVL adjustment flags that are not protocol breakdowns', () => {
		const sources = getAdvancedTvlBreakdownSources('aave', 'chainsTvl', {
			doublecounted: true,
			liquidstaking: true,
			govtokens: true
		})

		expect(sources).toEqual([
			{ kind: 'chain', request: { protocol: 'aave', key: undefined, breakdownType: 'chain-breakdown' } }
		])
	})

	it('suppresses token breakdowns but preserves TVL and chain views for misrepresented protocols', () => {
		expect(shouldSuppressAdvancedTvlTokenBreakdown('tokenValuesUsd', true)).toBe(true)
		expect(shouldSuppressAdvancedTvlTokenBreakdown('tokenBalances', true)).toBe(true)
		expect(shouldSuppressAdvancedTvlTokenBreakdown('tvl', true)).toBe(false)
		expect(shouldSuppressAdvancedTvlTokenBreakdown('chainsTvl', true)).toBe(false)
		expect(shouldSuppressAdvancedTvlTokenBreakdown('tokenBalances', undefined)).toBe(false)
	})
})
