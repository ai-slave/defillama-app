import { describe, expect, test } from 'vitest'
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

	test('treats empty and all-empty exclusions as the omitted base request', () => {
		expect(canonicalizeTokensToExclude([])).toBeUndefined()
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
		).toBe('/api/public/protocols/charts?kind=tvl&protocol=aave&currency=raw&breakdownType=token-breakdown')
		expect(
			buildProtocolValueChartApiUrl({
				source: 'treasury',
				protocol: 'makerdao',
				breakdownType: 'token-breakdown',
				currency: 'usd'
			})
		).toBe('/api/public/protocols/charts?kind=treasury&protocol=makerdao&currency=usd&breakdownType=token-breakdown')
	})
})
