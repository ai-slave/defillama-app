import { describe, expect, test } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { getCompleteAdapterMetricChainSeries } from '../chainSeries'
const http = installFixtureFetch()
const metadata = installMetadataSeeder()

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

	test("sums a parent's perp open interest by chain from its flagged children", async () => {
		metadata.seed({
			protocolRouteIdBySlug: { derive: 'parent#lyra' },
			protocolMetadata: {
				'parent#lyra': { displayName: 'Derive', openInterest: true, optionsOpenInterest: true },
				'3923': { displayName: 'Derive V2', openInterest: true },
				'100': { displayName: 'Derive V1', openInterest: true },
				'5060': { displayName: 'Derive Options', optionsOpenInterest: true }
			}
		})
		const chainBreakdown = (protocol: string) =>
			`${V2_SERVER_URL}/chart/open-interest/protocol/${protocol}/chain-breakdown?dataType=openInterestAtEnd`
		http.serve({
			[`${V2_SERVER_URL}/metrics/open-interest/protocol/derive?dataType=openInterestAtEnd`]: {
				childProtocols: [
					{ name: 'Derive V2', displayName: 'Derive V2', defillamaId: '3923' },
					{ name: 'Derive V1', displayName: 'Derive V1', defillamaId: '100' },
					{ name: 'Derive Options', displayName: 'Derive Options', defillamaId: '5060' }
				]
			},
			// The parent's own breakdown adds perp and options open interest together.
			[chainBreakdown('derive')]: [[86_400, { 'Derive Chain': 1683, Ethereum: 5 }]],
			[chainBreakdown('derive-v2')]: [[86_400, { 'Derive Chain': 80 }]],
			[chainBreakdown('derive-v1')]: [[86_400, { 'Derive Chain': 3, Ethereum: 5 }]],
			[chainBreakdown('derive-options')]: [[86_400, { 'Derive Chain': 1600 }]]
		})

		const result = await getCompleteAdapterMetricChainSeries({
			metric: 'open-interest',
			protocol: 'derive',
			chains: [],
			chainFilterMode: 'include',
			chainCategoryFilterMode: 'include',
			protocolCategoryFilterMode: 'include',
			chainCategories: [],
			protocolCategories: []
		})

		expect(result.series.map(({ name, data }) => ({ name, data }))).toEqual([
			{ name: 'Derive Chain', data: [[86_400, 83]] },
			{ name: 'Ethereum', data: [[86_400, 5]] }
		])
	})
})
