import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { getCompleteAdapterMetricChainSeries } from './chainSeries'
const http = installFixtureFetch()

describe('getCompleteAdapterMetricChainSeries', () => {
	test('aligns sparse historical chain series before returning the complete export universe', async () => {
		http.serve({
			[`${V2_SERVER_URL}/chart/derivatives/chain-breakdown`]: [
				[86_400, { Ethereum: 5 }],
				[172_800, { Solana: 7 }]
			]
		})

		const result = await getCompleteAdapterMetricChainSeries({
			metric: 'perps',
			chains: [],
			chainFilterMode: 'include',
			chainCategoryFilterMode: 'include',
			protocolCategoryFilterMode: 'include',
			chainCategories: [],
			protocolCategories: []
		})

		expect(result.series.map(({ name, data }) => ({ name, data }))).toEqual([
			{
				name: 'Ethereum',
				data: [
					[86_400, 5],
					[172_800, 0]
				]
			},
			{
				name: 'Solana',
				data: [
					[86_400, 0],
					[172_800, 7]
				]
			}
		])
	})

	test.each([
		['perps', 14],
		['open-interest', 9]
	] as const)('uses the %s metric daily aggregation contract', async (metric, expected) => {
		http.serve({
			[`${V2_SERVER_URL}/chart/${metric === 'perps' ? 'derivatives' : 'open-interest'}/chain-breakdown`]: [
				[86_400 + 60, { Ethereum: 5 }],
				[86_400 + 120, { Ethereum: 9 }]
			]
		})

		const result = await getCompleteAdapterMetricChainSeries({
			metric,
			chains: [],
			chainFilterMode: 'include',
			chainCategoryFilterMode: 'include',
			protocolCategoryFilterMode: 'include',
			chainCategories: [],
			protocolCategories: []
		})

		expect(result.series[0]?.data).toEqual([[86_400, expected]])
	})
})
