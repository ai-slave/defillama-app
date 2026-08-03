import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resultBody } from '~/server/api/__tests__/resultBody'

const mocks = vi.hoisted(() => ({
	fetchAdapterChainChartData: vi.fn(),
	fetchAdapterChainChartDataByProtocolBreakdown: vi.fn(),
	fetchAdapterChainMetrics: vi.fn(),
	fetchAdapterProtocolChartDataByBreakdownType: vi.fn(),
	fetchProtocols: vi.fn()
}))

vi.mock('~/containers/AdapterMetrics/api', () => ({
	fetchAdapterChainChartData: mocks.fetchAdapterChainChartData,
	fetchAdapterChainChartDataByProtocolBreakdown: mocks.fetchAdapterChainChartDataByProtocolBreakdown,
	fetchAdapterChainMetrics: mocks.fetchAdapterChainMetrics,
	fetchAdapterProtocolChartDataByBreakdownType: mocks.fetchAdapterProtocolChartDataByBreakdownType
}))

vi.mock('~/containers/ProtocolLists/api', () => ({
	fetchProtocols: mocks.fetchProtocols
}))

beforeEach(() => {
	vi.clearAllMocks()
	mocks.fetchProtocols.mockResolvedValue({ protocols: [] })
	mocks.fetchAdapterChainChartData.mockResolvedValue([])
	mocks.fetchAdapterChainChartDataByProtocolBreakdown.mockResolvedValue([])
})

describe('AdapterMetrics breakdown routes', () => {
	it('ranks protocols by their latest value within seven complete days', async () => {
		const today = Math.floor(Date.now() / 86_400_000) * 86_400
		const day = (daysAgo: number) => today - daysAgo * 86_400

		mocks.fetchAdapterChainChartDataByProtocolBreakdown.mockResolvedValue([
			[day(9), { Filler: 1 }],
			[day(8), { Expired: 1_000 }],
			[day(7), { Filler: 1 }],
			[day(6), { Filler: 1 }],
			[day(5), { Changing: 900, Filler: 1 }],
			[day(4), { Filler: 1 }],
			[day(3), { Recent: 600, Filler: 1 }],
			[day(2), { Changing: 400, Filler: 1 }],
			[day(1), { Fresh: 500, Competitor: 450, Filler: 1 }],
			[today, { Current: 2_000 }]
		])

		const { adapterMetricBreakdown } =
			await import('~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes')

		const result = await adapterMetricBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: {
				metric: 'dex-aggregators',
				limit: '3'
			}
		})

		expect(result.status).toBe(200)
		const body = resultBody(result)
		expect(body.series.slice(0, 3).map((series: { name: string }) => series.name)).toEqual([
			'Recent',
			'Fresh',
			'Competitor'
		])
		expect(
			body.series.find((series: { name: string; data: Array<[number, number]> }) => series.name === 'Recent')?.data
		).toContainEqual([day(1), 0])
		expect(body.series.map((series: { name: string }) => series.name)).not.toContain('Changing')
		expect(body.series.map((series: { name: string }) => series.name)).not.toContain('Expired')
		expect(body.series.map((series: { name: string }) => series.name)).not.toContain('Current')
		expect(body.metadata).toMatchObject({
			entityType: 'protocol',
			topN: 3,
			totalProtocols: 5,
			othersCount: 2
		})
	})

	it('labels and counts grouped protocol families without calling them protocols', async () => {
		vi.resetModules()
		const today = Math.floor(Date.now() / 86_400_000) * 86_400
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [
				{ name: 'Child A', category: 'Dexs', parentProtocol: 'parent#family' },
				{ name: 'Child B', category: 'Dexs', parentProtocol: 'parent#family' },
				{ name: 'Standalone', category: 'Dexs' }
			],
			parentProtocols: [{ id: 'parent#family', name: 'Family' }]
		})
		mocks.fetchAdapterChainChartDataByProtocolBreakdown.mockResolvedValue([
			[today - 2 * 86_400, { 'Child A': 40, 'Child B': 30, Standalone: 60 }],
			[today - 86_400, { 'Child A': 60, 'Child B': 50, Standalone: 100 }]
		])
		const { adapterMetricBreakdown } =
			await import('~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes')

		const result = await adapterMetricBreakdown.handle({
			method: 'GET',
			url: 'grouped-families',
			headers: {},
			query: { metric: 'volume', limit: '1', groupByParent: 'true' }
		})
		const body = resultBody(result)

		expect(body.series.map((series: { name: string }) => series.name)).toEqual(['Family', 'Others (1 protocol family)'])
		expect(body.metadata).toMatchObject({
			entityType: 'protocol-family',
			totalProtocolFamilies: 2,
			othersCount: 1
		})
		expect(body.metadata).not.toHaveProperty('totalProtocols')
	})

	it('filters protocol-specific chain summaries by display-name chain keys', async () => {
		mocks.fetchAdapterProtocolChartDataByBreakdownType.mockResolvedValue([
			[1, { BSC: 10, Ethereum: 50 }],
			[2, { BSC: 30, Ethereum: 60 }]
		])
		const { adapterMetricByChainBreakdown } =
			await import('~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes')

		const result = await adapterMetricByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: {
				metric: 'fees',
				protocol: 'aave',
				chains: 'BSC',
				limit: '5'
			}
		})

		expect(result.status).toBe(200)
		expect(resultBody(result)).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['BSC']
			})
		})
		expect(mocks.fetchAdapterProtocolChartDataByBreakdownType).toHaveBeenCalledWith({
			adapterType: 'fees',
			protocol: 'aave',
			type: 'chain'
		})
	})

	it('normalizes saved legacy aliases for protocol-specific chain summary filters', async () => {
		mocks.fetchAdapterProtocolChartDataByBreakdownType.mockResolvedValue([
			[1, { BSC: 10, Ethereum: 50 }],
			[2, { BSC: 30, Ethereum: 60 }]
		])
		const { adapterMetricByChainBreakdown } =
			await import('~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes')

		const result = await adapterMetricByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: {
				metric: 'fees',
				protocol: 'aave',
				chains: 'bsc',
				limit: '5'
			}
		})

		expect(result.status).toBe(200)
		expect(resultBody(result)).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['BSC']
			})
		})
	})

	it('does not mutate the cached protocol category lookup with overview protocol aliases', async () => {
		let overviewCalls = 0
		mocks.fetchAdapterChainMetrics.mockImplementation(async () => {
			overviewCalls += 1
			return {
				protocols: [
					{
						name: 'Transient Protocol',
						displayName: 'Transient Protocol',
						slug: 'transient-protocol',
						category: overviewCalls === 1 ? 'Lending' : null,
						breakdown24h: { bsc: { v1: 10 } }
					}
				],
				allChains: ['BSC']
			}
		})
		mocks.fetchAdapterChainChartDataByProtocolBreakdown.mockResolvedValue([
			[1, { 'Transient Protocol': 10 }],
			[2, { 'Transient Protocol': 20 }]
		])
		const { adapterMetricByChainBreakdown } =
			await import('~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes')

		const firstResult = await adapterMetricByChainBreakdown.handle({
			method: 'GET',
			url: 'limit-one',
			headers: {},
			query: {
				metric: 'fees',
				protocol: 'All',
				protocolCategories: 'lending',
				limit: '1'
			}
		})
		const secondResult = await adapterMetricByChainBreakdown.handle({
			method: 'GET',
			url: 'limit-two',
			headers: {},
			query: {
				metric: 'revenue',
				protocol: 'All',
				protocolCategories: 'lending',
				limit: '2'
			}
		})

		expect(resultBody(firstResult)).toMatchObject({ metadata: expect.objectContaining({ totalChains: 1 }) })
		expect(resultBody(secondResult)).toMatchObject({ metadata: expect.objectContaining({ totalChains: 0 }) })
		expect(overviewCalls).toBe(2)
	})

	it.each(['include', 'exclude'] as const)(
		'rejects a partial selected-chain protocol aggregate in %s mode',
		async (chainFilterMode) => {
			mocks.fetchAdapterChainChartDataByProtocolBreakdown.mockImplementation(async ({ chain }) => {
				if (chain === 'Base') throw new Error('Base unavailable')
				return []
			})
			const { adapterMetricBreakdown } =
				await import('~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes')

			const result = await adapterMetricBreakdown.handle({
				method: 'GET',
				url: `partial-${chainFilterMode}`,
				headers: {},
				query: {
					metric: 'volume',
					chains: 'Base,Ethereum',
					chainFilterMode
				}
			})

			expect(result.status).toBe(500)
		}
	)

	it('rejects an all-protocol chain chart when a ranked chain request fails', async () => {
		mocks.fetchAdapterChainMetrics.mockResolvedValue({
			protocols: [
				{
					name: 'Protocol',
					displayName: 'Protocol',
					slug: 'protocol',
					category: null,
					breakdown24h: { bsc: { v1: 10 } }
				}
			],
			allChains: ['BSC']
		})
		mocks.fetchAdapterChainChartData.mockImplementation(async ({ chain }) => {
			if (chain === 'BSC') throw new Error('BSC unavailable')
			return []
		})
		const { adapterMetricByChainBreakdown } =
			await import('~/containers/ProDashboard/server/chartBuilder/adapterMetrics/routes')

		const result = await adapterMetricByChainBreakdown.handle({
			method: 'GET',
			url: 'ranked-chain-failure',
			headers: {},
			query: { metric: 'perps', protocol: 'All' }
		})

		expect(result.status).toBe(500)
	})
})
