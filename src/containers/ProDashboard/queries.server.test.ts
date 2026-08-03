import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildProDashboardProtocolRelations, type ProDashboardProtocolCatalog } from './protocolCatalog'

const { getProtocolDataMock } = vi.hoisted(() => ({ getProtocolDataMock: vi.fn() }))

vi.mock('./services/ProtocolCharts', () => ({ fetchProProtocolChartData: getProtocolDataMock }))
vi.mock('./services/ChainCharts', () => ({ fetchProChainChartData: vi.fn() }))
vi.mock('./server/pfPsQueries', () => ({
	fetchPfPsChartData: vi.fn().mockResolvedValue([]),
	fetchPfPsProtocols: vi.fn().mockResolvedValue({ pf: [], ps: [] })
}))

import { fetchSingleChartData } from './queries.server'

const catalog: ProDashboardProtocolCatalog = {
	protocols: [
		{ id: 'parent#aave', name: 'Aave', slug: 'aave', tvl: 30, chains: [] },
		{
			id: '1',
			name: 'Aave V2',
			slug: 'aave-v2',
			symbol: 'AAVE',
			tvl: 10,
			chains: [],
			parentProtocol: 'parent#aave'
		},
		{
			id: '2',
			name: 'Aave V3',
			slug: 'aave-v3',
			symbol: 'AAVE',
			tvl: 20,
			chains: [],
			parentProtocol: 'parent#aave'
		}
	],
	chains: []
}
const protocolRelations = buildProDashboardProtocolRelations(catalog)

describe('fetchSingleChartData parent fallback', () => {
	beforeEach(() => {
		getProtocolDataMock.mockReset()
		getProtocolDataMock.mockResolvedValue([])
	})

	it('sums child series when a parent has no direct adapter chart', async () => {
		getProtocolDataMock.mockImplementation(async (_type: string, protocol: string) => {
			if (protocol === 'aave') return []
			if (protocol === 'aave-v2') return [[1, 10]]
			return [
				[1, 20],
				[2, 5]
			]
		})

		await expect(
			fetchSingleChartData({ type: 'fees', subjectType: 'protocol', protocol: 'aave' }, 'all', null, protocolRelations)
		).resolves.toEqual([
			[1, 30],
			[2, 5]
		])
	})

	it('uses each child symbol for parent liquidity fallback', async () => {
		getProtocolDataMock.mockImplementation(async (_type: string, protocol: string) =>
			protocol === 'aave' ? [] : [[1, protocol === 'aave-v2' ? 10 : 20]]
		)

		await fetchSingleChartData(
			{ type: 'liquidity', subjectType: 'protocol', protocol: 'aave' },
			'all',
			null,
			protocolRelations
		)

		expect(getProtocolDataMock).toHaveBeenCalledWith(
			'liquidity',
			'aave-v2',
			expect.objectContaining({ protocolSymbol: 'AAVE' })
		)
		expect(getProtocolDataMock).toHaveBeenCalledWith(
			'liquidity',
			'aave-v3',
			expect.objectContaining({ protocolSymbol: 'AAVE' })
		)
	})

	it('rejects a partial child set instead of caching an understated parent total', async () => {
		getProtocolDataMock.mockImplementation(async (_type: string, protocol: string) => {
			if (protocol === 'aave') return []
			if (protocol === 'aave-v2') return [[1, 10]]
			throw new Error('child source failed')
		})

		await expect(
			fetchSingleChartData({ type: 'fees', subjectType: 'protocol', protocol: 'aave' }, 'all', null, protocolRelations)
		).rejects.toThrow('child source failed')
	})

	it('does not turn a standalone source failure into a successful empty result', async () => {
		getProtocolDataMock.mockRejectedValue(new Error('upstream failed'))

		await expect(
			fetchSingleChartData(
				{ type: 'fees', subjectType: 'protocol', protocol: 'standalone' },
				'all',
				null,
				protocolRelations
			)
		).rejects.toThrow('upstream failed')
	})

	it('rejects unknown saved chart types without invoking a chart service', async () => {
		await expect(
			fetchSingleChartData(
				{ type: 'legacy-unknown', subjectType: 'protocol', protocol: 'aave' },
				'all',
				null,
				protocolRelations
			)
		).resolves.toEqual([])

		expect(getProtocolDataMock).not.toHaveBeenCalled()
	})
})
