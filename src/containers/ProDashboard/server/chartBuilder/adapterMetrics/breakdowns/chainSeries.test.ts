import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchAdapterChainChartDataByChainBreakdown } from '~/containers/AdapterMetrics/api'
import { getCompleteAdapterMetricChainSeries } from './chainSeries'

vi.mock('~/containers/AdapterMetrics/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/containers/AdapterMetrics/api')>()),
	fetchAdapterChainChartDataByChainBreakdown: vi.fn()
}))

describe('getCompleteAdapterMetricChainSeries', () => {
	beforeEach(() => {
		vi.mocked(fetchAdapterChainChartDataByChainBreakdown).mockReset()
	})

	test('aligns sparse historical chain series before returning the complete export universe', async () => {
		vi.mocked(fetchAdapterChainChartDataByChainBreakdown).mockResolvedValue([
			[86_400, { Ethereum: 5 }],
			[172_800, { Solana: 7 }]
		])

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
		vi.mocked(fetchAdapterChainChartDataByChainBreakdown).mockResolvedValue([
			[86_400 + 60, { Ethereum: 5 }],
			[86_400 + 120, { Ethereum: 9 }]
		])

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
