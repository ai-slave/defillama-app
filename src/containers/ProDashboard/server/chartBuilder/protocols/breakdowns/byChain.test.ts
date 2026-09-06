import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchChainChart, fetchChainsTvlOverview } from '~/containers/Chains/api'
import { getProtocolChainBreakdownData } from './byChain'

vi.mock('~/containers/Chains/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/Chains/api')>()),
	fetchChainChart: vi.fn(),
	fetchChainsTvlOverview: vi.fn()
}))

describe('all-protocol TVL by chain', () => {
	beforeEach(() => {
		vi.mocked(fetchChainChart).mockReset()
		vi.mocked(fetchChainsTvlOverview).mockReset()
	})

	test('keeps the last same-day TVL snapshot', async () => {
		vi.mocked(fetchChainsTvlOverview).mockResolvedValue([{ name: 'Ethereum', tvl: 20 }])
		vi.mocked(fetchChainChart).mockResolvedValue({
			tvl: [
				[86_400 + 60, 10],
				[86_400 + 120, 20]
			]
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
