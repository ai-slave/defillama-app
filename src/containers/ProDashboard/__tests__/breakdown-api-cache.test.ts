import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	getTvlBreakdownData: vi.fn(),
	getProtocolChainBreakdownData: vi.fn(),
	fetchAdapterChainMetrics: vi.fn(),
	fetchAdapterProtocolChartData: vi.fn()
}))

vi.mock('~/containers/ProDashboard/server/chartBuilder/protocols/breakdowns/tvl', () => ({
	getTvlBreakdownData: mocks.getTvlBreakdownData
}))

vi.mock('~/containers/ProDashboard/server/chartBuilder/protocols/breakdowns/byChain', () => ({
	getProtocolChainBreakdownData: mocks.getProtocolChainBreakdownData
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainMetrics: mocks.fetchAdapterChainMetrics,
	fetchAdapterProtocolChartData: mocks.fetchAdapterProtocolChartData
}))

import { chainNativeByChainBreakdown } from '../server/chartBuilder/chains'
import { protocolTvlBreakdown, protocolTvlByChainBreakdown } from '../server/chartBuilder/protocols'

beforeEach(() => {
	vi.clearAllMocks()
})

describe('Pro Dashboard final breakdown response caches', () => {
	it('serializes and reuses the protocol TVL breakdown', async () => {
		mocks.getTvlBreakdownData.mockResolvedValue({ series: [{ name: 'Aave', data: [[1, 2]] }] })
		const request = {
			method: 'GET',
			url: '/api/public/pro-dashboard/chart-builder/protocols/breakdowns/tvl?categories=serialized-cache',
			query: { categories: 'serialized-cache' },
			headers: {}
		}

		const first = await protocolTvlBreakdown.handle(request)
		const second = await protocolTvlBreakdown.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: expect.any(String) })
		expect(second).toEqual(first)
		expect(mocks.getTvlBreakdownData).toHaveBeenCalledTimes(1)
	})

	it('serializes and reuses the protocol TVL by-chain breakdown', async () => {
		mocks.getProtocolChainBreakdownData.mockResolvedValue({ series: [{ name: 'Ethereum', data: [[1, 2]] }] })
		const request = {
			method: 'GET',
			url: '/api/public/pro-dashboard/chart-builder/protocols/breakdowns/by-chain/tvl?protocol=serialized-cache',
			query: { protocol: 'serialized-cache' },
			headers: {}
		}

		const first = await protocolTvlByChainBreakdown.handle(request)
		const second = await protocolTvlByChainBreakdown.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: expect.any(String) })
		expect(second).toEqual(first)
		expect(mocks.getProtocolChainBreakdownData).toHaveBeenCalledTimes(1)
	})

	it('serializes and reuses the chain-native by-chain breakdown', async () => {
		mocks.fetchAdapterChainMetrics.mockResolvedValue({
			protocols: [
				{
					name: 'Serialized Cache Chain',
					slug: 'serialized-cache-chain',
					protocolType: 'chain',
					total24h: 2
				}
			],
			allChains: []
		})
		mocks.fetchAdapterProtocolChartData.mockResolvedValue([[1, 2]])
		const request = {
			method: 'GET',
			url: '/api/public/pro-dashboard/chart-builder/chains/breakdowns/by-chain/chain-fees?chains=Serialized%20Cache%20Chain',
			query: { metric: 'chain-fees', chains: 'Serialized Cache Chain' },
			headers: {}
		}

		const first = await chainNativeByChainBreakdown.handle(request)
		const second = await chainNativeByChainBreakdown.handle(request)

		expect(first).toMatchObject({ status: 200, serializedJson: expect.any(String) })
		expect(second).toEqual(first)
		expect(mocks.fetchAdapterChainMetrics).toHaveBeenCalledTimes(1)
		expect(mocks.fetchAdapterProtocolChartData).toHaveBeenCalledTimes(1)
	})
})
