import { describe, expect, test } from 'vitest'
import { SERVER_URL, V2_SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { getProtocolChainBreakdownData } from './byChain'
const http = installFixtureFetch()

describe('all-protocol TVL by chain', () => {
	test('keeps the last same-day TVL snapshot', async () => {
		http.serve({
			[`${V2_SERVER_URL}/chains`]: [{ name: 'Ethereum', tvl: 20 }],
			[`${SERVER_URL}/lite/charts/Ethereum`]: {
				tvl: [
					[86_400 + 60, 10],
					[86_400 + 120, 20]
				]
			}
		})

		const result = await getProtocolChainBreakdownData({
			protocol: 'All',
			metric: 'tvl',
			chains: ['Ethereum'],
			topN: 5,
			chainFilterMode: 'include',
			chainCategoryFilterMode: 'include',
			chainCategories: []
		})

		expect(result.series[0]?.data).toEqual([[86_400, 20]])
	})
})
