import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resultBody } from '~/server/api/__tests__/resultBody'

const mocks = vi.hoisted(() => ({
	fetchWithPoolingOnServer: vi.fn(),
	fetchProtocols: vi.fn()
}))

vi.mock('~/utils/http-client', () => ({
	fetchWithPoolingOnServer: mocks.fetchWithPoolingOnServer
}))

vi.mock('~/containers/ProtocolLists/api', () => ({
	fetchProtocols: mocks.fetchProtocols
}))

function jsonResponse(value: unknown) {
	return new Response(JSON.stringify(value), { status: 200 })
}

beforeEach(() => {
	vi.clearAllMocks()
	mocks.fetchProtocols.mockResolvedValue({ protocols: [] })
})

describe('AdapterMetrics breakdown routes', () => {
	it('ranks protocols by their latest value within seven complete days', async () => {
		const today = Math.floor(Date.now() / 86_400_000) * 86_400
		const day = (daysAgo: number) => today - daysAgo * 86_400

		mocks.fetchWithPoolingOnServer.mockResolvedValue(
			jsonResponse({
				totalDataChartBreakdown: [
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
				]
			})
		)

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
		expect(body.series.slice(0, 3).map((series) => series.name)).toEqual(['Recent', 'Fresh', 'Competitor'])
		expect(body.series.find((series) => series.name === 'Recent')?.data).toContainEqual([day(1), 0])
		expect(body.series.map((series) => series.name)).not.toContain('Changing')
		expect(body.series.map((series) => series.name)).not.toContain('Expired')
		expect(body.series.map((series) => series.name)).not.toContain('Current')
		expect(body.metadata).toMatchObject({
			topN: 3,
			totalProtocols: 5,
			othersCount: 2
		})
	})

	it('filters protocol-specific chain summaries by display-name chain keys', async () => {
		mocks.fetchWithPoolingOnServer.mockResolvedValue(
			jsonResponse({
				totalDataChartBreakdown: [
					[1, { BSC: { v1: 10 }, Ethereum: { v1: 50 } }],
					[2, { BSC: { v1: 30 }, Ethereum: { v1: 60 } }]
				]
			})
		)
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
		expect(mocks.fetchWithPoolingOnServer).toHaveBeenCalledWith(expect.stringContaining('/fees/aave'))
	})

	it('normalizes saved legacy aliases for protocol-specific chain summary filters', async () => {
		mocks.fetchWithPoolingOnServer.mockResolvedValue(
			jsonResponse({
				totalDataChartBreakdown: [
					[1, { BSC: { v1: 10 }, Ethereum: { v1: 50 } }],
					[2, { BSC: { v1: 30 }, Ethereum: { v1: 60 } }]
				]
			})
		)
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
		mocks.fetchWithPoolingOnServer.mockImplementation(async (url: string) => {
			if (/\/(fees|revenue)\/[^/?]+\?/.test(url)) {
				return jsonResponse({
					totalDataChart: [
						[1, 10],
						[2, 20]
					]
				})
			}
			overviewCalls += 1
			return jsonResponse({
				protocols: [
					{
						displayName: 'Transient Protocol',
						category: overviewCalls === 1 ? 'Lending' : undefined,
						breakdown24h: { bsc: { v1: 10 } }
					}
				],
				allChains: ['BSC'],
				totalDataChart: [
					[1, 10],
					[2, 20]
				],
				totalDataChartBreakdown: [
					[1, { 'Transient Protocol': { v1: 10 } }],
					[2, { 'Transient Protocol': { v1: 20 } }]
				]
			})
		})
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
})
