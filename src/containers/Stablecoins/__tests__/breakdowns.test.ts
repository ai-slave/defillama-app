import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StablecoinChartPoint } from '~/containers/Stablecoins/api.types'
import { resultBody } from '~/server/api/__tests__/resultBody'

const mocks = vi.hoisted(() => ({
	fetchStablecoinChartAllApi: vi.fn(),
	fetchStablecoinDominanceAllApi: vi.fn(),
	fetchChainsByCategory: vi.fn()
}))

vi.mock('~/containers/Stablecoins/api', () => ({
	fetchStablecoinChartAllApi: mocks.fetchStablecoinChartAllApi,
	fetchStablecoinDominanceAllApi: mocks.fetchStablecoinDominanceAllApi
}))

vi.mock('~/containers/Chains/api', () => ({
	fetchChainsByCategory: mocks.fetchChainsByCategory
}))

beforeEach(() => {
	vi.resetModules()
	vi.clearAllMocks()
})

const point = (date: number, value: number): StablecoinChartPoint => ({
	date: String(date),
	totalCirculatingUSD: { peggedUSD: value }
})

function mockAggregate(value = 1_000) {
	mocks.fetchStablecoinChartAllApi.mockResolvedValue({
		aggregated: [point(86_400, value), point(172_800, value)],
		breakdown: {},
		doublecountedIds: []
	})
}

function mockDominance(values: Record<string, number>) {
	mocks.fetchStablecoinDominanceAllApi.mockResolvedValue({
		chainChartMap: Object.fromEntries(
			Object.entries(values).map(([chain, value]) => [chain, [point(86_400, value / 2), point(172_800, value)]])
		)
	})
}

async function fetchBreakdown(query: Record<string, string>) {
	const { stablecoinByChainBreakdown } = await import('~/containers/ProDashboard/server/chartBuilder/stablecoins')
	const result = await stablecoinByChainBreakdown.handle({
		method: 'GET',
		url: '',
		headers: {},
		query
	})

	expect(result.status).toBe(200)
	return resultBody(result)
}

describe('stablecoin breakdown routes', () => {
	it('starts the aggregate chart fetch before waiting on dominance data', async () => {
		let resolveDominance: (value: unknown) => void = () => {}
		mocks.fetchStablecoinDominanceAllApi.mockReturnValue(
			new Promise((resolve) => {
				resolveDominance = resolve
			})
		)
		mocks.fetchStablecoinChartAllApi.mockResolvedValue({
			aggregated: [point(1, 10), point(2, 20)],
			breakdown: {},
			doublecountedIds: []
		})
		const { stablecoinByChainBreakdown } = await import('~/containers/ProDashboard/server/chartBuilder/stablecoins')

		const resultPromise = stablecoinByChainBreakdown.handle({
			method: 'GET',
			url: '',
			headers: {},
			query: { limit: '1' }
		})

		await vi.waitFor(() => {
			expect(mocks.fetchStablecoinChartAllApi).toHaveBeenCalledTimes(1)
		})
		resolveDominance({
			chainChartMap: {
				Ethereum: [point(1, 10), point(2, 20)]
			}
		})

		const result = await resultPromise
		expect(result.status).toBe(200)
		expect(resultBody(result)).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['Ethereum']
			})
		})
	})

	it('filters stablecoin dominance chains by exact display names', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			Ethereum: 20
		})

		const body = await fetchBreakdown({
			limit: '5',
			chains: 'Gnosis,OP Mainnet'
		})

		expect(body).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['Gnosis', 'OP Mainnet'],
				totalChains: 2
			})
		})
	})

	it('keeps stablecoin chain-id aliases working for saved chart-builder configs', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			'ZKsync Era': 20
		})

		const body = await fetchBreakdown({
			limit: '5',
			chains: 'xdai,optimism,era'
		})

		expect(body).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['Gnosis', 'OP Mainnet', 'ZKsync Era'],
				totalChains: 3
			})
		})
	})

	it('excludes stablecoin dominance chains by exact display name', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			Ethereum: 20
		})

		const body = await fetchBreakdown({
			limit: '5',
			chains: 'Gnosis',
			chainFilterMode: 'exclude'
		})

		expect(body).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['OP Mainnet', 'Ethereum'],
				totalChains: 2
			})
		})
	})

	it('applies stablecoin dominance category filters with display names', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			Ethereum: 20
		})
		mocks.fetchChainsByCategory.mockResolvedValue({ chainsUnique: ['Gnosis', 'Ethereum'] })

		const body = await fetchBreakdown({
			limit: '5',
			chainCategories: 'EVM'
		})

		expect(body).toMatchObject({
			metadata: expect.objectContaining({
				chains: ['Gnosis', 'Ethereum'],
				totalChains: 2
			})
		})
	})

	it('calculates filtered Others from the filtered chains only', async () => {
		mockAggregate()
		mockDominance({
			Gnosis: 40,
			'OP Mainnet': 30,
			Ethereum: 20
		})
		mocks.fetchChainsByCategory.mockResolvedValue({ chainsUnique: ['Gnosis', 'Ethereum'] })

		const body = await fetchBreakdown({
			limit: '1',
			chainCategories: 'EVM'
		})

		expect(body).toMatchObject({
			series: [
				{
					name: 'Gnosis',
					data: [
						[86_400, 20],
						[172_800, 40]
					]
				},
				{
					name: 'Others (1 chains)',
					data: [
						[86_400, 10],
						[172_800, 20]
					]
				}
			]
		})
	})

	it('keeps the last stablecoin supply snapshot when multiple points share a UTC day', async () => {
		mocks.fetchStablecoinChartAllApi.mockResolvedValue({
			aggregated: [point(86_401, 70), point(86_402, 90)],
			breakdown: {},
			doublecountedIds: []
		})
		mocks.fetchStablecoinDominanceAllApi.mockResolvedValue({
			chainChartMap: {
				Ethereum: [point(86_401, 40), point(86_402, 50)],
				Base: [point(86_401, 30), point(86_402, 40)]
			}
		})

		const body = await fetchBreakdown({ limit: '1' })

		expect(body).toMatchObject({
			series: [
				{ name: 'Ethereum', data: [[86_400, 50]] },
				{ name: 'Others (1 chains)', data: [[86_400, 40]] }
			]
		})
	})
})
