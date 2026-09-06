import { describe, expect, expectTypeOf, test } from 'vitest'
import type { ProtocolTvlKey } from '../api.types'
import type { PROTOCOL_EXTRA_TVL_KEYS, ProtocolExtraTvlKey } from '../tvlChart'
import type { ProtocolValueChartRequest } from '../valueChartSources'
import {
	buildProtocolValueChartApiUrl,
	buildProtocolValueChartQueryKey,
	canonicalizeTokensToExclude
} from '../valueChartSources'

describe('ProtocolOverview value chart sources', () => {
	test('uses one canonical exclusion value for URL and cache identity', () => {
		const tokenExclusions = canonicalizeTokensToExclude(['', 'GT', ''])
		if (!tokenExclusions) throw new Error('Expected canonical token exclusions')
		const request = { source: 'tvl', protocol: 'gate', tokenExclusions } satisfies ProtocolValueChartRequest
		const reorderedExclusions = canonicalizeTokensToExclude(['GT'])
		if (!reorderedExclusions) throw new Error('Expected reordered token exclusions')
		const reorderedRequest = {
			source: 'tvl',
			protocol: 'gate',
			tokenExclusions: reorderedExclusions
		} satisfies ProtocolValueChartRequest

		expect(buildProtocolValueChartQueryKey(request).at(-1)).toBe('GT')
		expect(buildProtocolValueChartQueryKey(request)).toEqual(buildProtocolValueChartQueryKey(reorderedRequest))
		expect(buildProtocolValueChartApiUrl(request)).toBe(
			'/api/public/protocols/charts?kind=tvl&protocol=gate&tokensToExclude=GT'
		)
		expect(buildProtocolValueChartApiUrl(request)).toBe(buildProtocolValueChartApiUrl(reorderedRequest))
	})

	test('treats all-empty exclusions as the omitted base request', () => {
		const tokenExclusions = canonicalizeTokensToExclude(['', ''])
		const baseRequest = { source: 'tvl', protocol: 'gate' } satisfies ProtocolValueChartRequest
		const allEmptyRequest = {
			...baseRequest,
			...(tokenExclusions ? { tokenExclusions } : {})
		} satisfies ProtocolValueChartRequest

		expect(tokenExclusions).toBeUndefined()
		expect(buildProtocolValueChartQueryKey(allEmptyRequest)).toEqual(buildProtocolValueChartQueryKey(baseRequest))
		expect(buildProtocolValueChartApiUrl(allEmptyRequest)).toBe(buildProtocolValueChartApiUrl(baseRequest))
	})

	test('keeps raw and USD currency modes on token breakdown requests', () => {
		expect(
			buildProtocolValueChartApiUrl({
				source: 'tvl',
				protocol: 'aave',
				breakdownType: 'token-breakdown',
				currency: 'raw'
			})
		).toContain('breakdownType=token-breakdown')
		expect(
			buildProtocolValueChartApiUrl({
				source: 'treasury',
				protocol: 'makerdao',
				breakdownType: 'token-breakdown',
				currency: 'usd'
			})
		).toContain('currency=usd')
	})

	type CurrencyWithoutTokenBreakdown = {
		source: 'tvl'
		protocol: 'aave'
		currency: 'raw'
	} extends ProtocolValueChartRequest
		? true
		: false
	type TreasuryRequest = Extract<ProtocolValueChartRequest, { source: 'treasury' }>
	type TreasuryHasExclusions = 'tokenExclusions' extends keyof TreasuryRequest ? true : false
	type ChainOnlyTvlKeyIsInternalRequest = {
		source: 'tvl'
		protocol: 'aave'
		key: 'doublecounted' | 'liquidstaking' | 'govtokens'
	} extends ProtocolValueChartRequest
		? true
		: false
	type TreasuryStakingRequest = {
		source: 'treasury'
		protocol: 'makerdao'
		key: 'staking'
	} extends ProtocolValueChartRequest
		? true
		: false
	type TvlOwnTokensRequest = {
		source: 'tvl'
		protocol: 'makerdao'
		key: 'OwnTokens'
	} extends ProtocolValueChartRequest
		? true
		: false

	test('does not type invalid source, currency, and breakdown combinations as requests', () => {
		expectTypeOf<CurrencyWithoutTokenBreakdown>().toEqualTypeOf<false>()
		expectTypeOf<TreasuryHasExclusions>().toEqualTypeOf<false>()
		expectTypeOf<ChainOnlyTvlKeyIsInternalRequest>().toEqualTypeOf<false>()
		expectTypeOf<TreasuryStakingRequest>().toEqualTypeOf<false>()
		expectTypeOf<TvlOwnTokensRequest>().toEqualTypeOf<false>()
	})

	test('keeps protocol TVL keys and the extra-key tuple exactly bounded', () => {
		type ChainOnlyTvlKey = 'doublecounted' | 'liquidstaking' | 'govtokens'
		expectTypeOf<Extract<ProtocolTvlKey, ChainOnlyTvlKey>>().toEqualTypeOf<never>()
		expectTypeOf<(typeof PROTOCOL_EXTRA_TVL_KEYS)[number]>().toEqualTypeOf<ProtocolExtraTvlKey>()
		expectTypeOf<ProtocolExtraTvlKey>().toEqualTypeOf<'staking' | 'borrowed' | 'pool2' | 'vesting'>()
	})
})
