import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildProDashboardProtocolRelations, type ProDashboardProtocolCatalog } from './protocolCatalog'

const { protocolCharts } = vi.hoisted(() => ({
	protocolCharts: {
		tvl: vi.fn(),
		volume: vi.fn(),
		fees: vi.fn(),
		revenue: vi.fn(),
		holdersRevenue: vi.fn(),
		perps: vi.fn(),
		openInterest: vi.fn(),
		aggregators: vi.fn(),
		perpsAggregators: vi.fn(),
		bridgeAggregators: vi.fn(),
		optionsPremium: vi.fn(),
		optionsNotional: vi.fn(),
		liquidity: vi.fn(),
		treasury: vi.fn(),
		incentives: vi.fn(),
		unlocks: vi.fn(),
		tokenMcap: vi.fn(),
		tokenPrice: vi.fn(),
		tokenVolume: vi.fn(),
		medianApy: vi.fn(),
		borrowed: vi.fn()
	}
}))

vi.mock('./services/ProtocolCharts', () => ({ default: protocolCharts }))
vi.mock('./services/ChainCharts', () => ({ default: { getData: vi.fn() } }))
vi.mock('./server/pfPsQueries', () => ({
	fetchPfPsChartData: vi.fn().mockResolvedValue([]),
	fetchPfPsProtocols: vi.fn().mockResolvedValue({ pf: [], ps: [] })
}))

import { fetchSingleChartData } from './queries.server'

const catalog: ProDashboardProtocolCatalog = {
	protocols: [
		{ id: 'parent#aave', name: 'Aave', slug: 'aave', tvl: 30 },
		{ id: '1', name: 'Aave V2', slug: 'aave-v2', symbol: 'AAVE', tvl: 10, parentProtocol: 'parent#aave' },
		{ id: '2', name: 'Aave V3', slug: 'aave-v3', symbol: 'AAVE', tvl: 20, parentProtocol: 'parent#aave' }
	],
	chains: []
}
const protocolRelations = buildProDashboardProtocolRelations(catalog)

describe('fetchSingleChartData parent fallback', () => {
	beforeEach(() => {
		for (const mock of Object.values(protocolCharts)) mock.mockReset()
	})

	it('sums child series when a parent has no direct adapter chart', async () => {
		protocolCharts.fees.mockImplementation(async (protocol: string) => {
			if (protocol === 'aave') return []
			if (protocol === 'aave-v2') return [[1, 10]]
			return [
				[1, 20],
				[2, 5]
			]
		})

		await expect(
			fetchSingleChartData({ type: 'fees', protocol: 'aave', chain: '' }, 'all', null, protocolRelations)
		).resolves.toEqual([
			[1, 30],
			[2, 5]
		])
	})

	it('uses each child symbol for parent liquidity fallback', async () => {
		protocolCharts.liquidity.mockImplementation(async (protocol: string) =>
			protocol === 'aave' ? [] : [[1, protocol === 'aave-v2' ? 10 : 20]]
		)

		await fetchSingleChartData({ type: 'liquidity', protocol: 'aave', chain: '' }, 'all', null, protocolRelations)

		expect(protocolCharts.liquidity).toHaveBeenCalledWith('aave-v2', 'AAVE')
		expect(protocolCharts.liquidity).toHaveBeenCalledWith('aave-v3', 'AAVE')
	})

	it('does not turn a standalone source failure into a successful empty result', async () => {
		protocolCharts.fees.mockRejectedValue(new Error('upstream failed'))

		await expect(
			fetchSingleChartData({ type: 'fees', protocol: 'standalone', chain: '' }, 'all', null, protocolRelations)
		).rejects.toThrow('upstream failed')
	})

	it('rejects unknown saved chart types without invoking a chart service', async () => {
		await expect(
			fetchSingleChartData({ type: 'legacy-unknown', protocol: 'aave', chain: '' }, 'all', null, protocolRelations)
		).resolves.toEqual([])

		for (const mock of Object.values(protocolCharts)) expect(mock).not.toHaveBeenCalled()
	})
})
