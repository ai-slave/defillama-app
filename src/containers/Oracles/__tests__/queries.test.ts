import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'

const mocks = vi.hoisted(() => ({
	fetchProtocols: vi.fn(),
	fetchOracleMetrics: vi.fn(),
	fetchOracleProtocolBreakdownChart: vi.fn(),
	fetchOracleProtocolChart: vi.fn(),
	fetchOracleProtocolChainBreakdownChart: vi.fn(),
	fetchOracleChainProtocolBreakdownChart: vi.fn()
}))

vi.mock('~/containers/ProtocolLists/api', () => ({ fetchProtocols: mocks.fetchProtocols }))
vi.mock('../api', () => ({
	fetchOracleMetrics: mocks.fetchOracleMetrics,
	fetchOracleProtocolBreakdownChart: mocks.fetchOracleProtocolBreakdownChart,
	fetchOracleProtocolChart: mocks.fetchOracleProtocolChart,
	fetchOracleProtocolChainBreakdownChart: mocks.fetchOracleProtocolChainBreakdownChart,
	fetchOracleChainProtocolBreakdownChart: mocks.fetchOracleChainProtocolBreakdownChart
}))

import { getOracleDetailPageData, getOraclesListPageData } from '../queries'

function protocol(name: string, tvl: number | null): ProtocolLite {
	return {
		name,
		symbol: name.slice(0, 3),
		logo: null,
		url: 'https://example.com',
		category: 'Lending',
		tags: ['Private Credit'],
		chains: [],
		chainTvls: {},
		tvl,
		tvlPrevDay: null,
		tvlPrevWeek: null,
		tvlPrevMonth: null,
		mcap: null,
		defillamaId: name.toLowerCase().replaceAll(' ', '-'),
		geckoId: null
	}
}

const protocolsResponse = {
	protocols: [
		protocol('Null TVL Protocol', null),
		protocol('Zero Protocol', 0),
		protocol('Metadata Only', 100),
		protocol('Hyphen Chain Protocol', 42),
		protocol('Extra Only Protocol', 5)
	],
	chains: [],
	parentProtocols: [],
	protocolCategories: ['Lending']
} satisfies ProtocolsResponse

beforeEach(() => {
	mocks.fetchProtocols.mockResolvedValue(protocolsResponse)
	mocks.fetchOracleMetrics.mockResolvedValue({
		oracles: {
			Chainlink: [
				'Null TVL Protocol',
				'Zero Protocol',
				'Metadata Only',
				'Missing Lite Metadata',
				'Hyphen Chain Protocol',
				'Extra Only Protocol'
			],
			'Unmeasured Oracle': ['Metadata Only']
		},
		chainsByOracle: { Chainlink: ['Ethereum', 'X-Layer'], 'Unmeasured Oracle': ['Ethereum'] },
		protocolsByOracleChain: {
			Chainlink: {
				Ethereum: [
					'Null TVL Protocol',
					'Zero Protocol',
					'Metadata Only',
					'Missing Lite Metadata',
					'Extra Only Protocol'
				],
				'X-Layer': ['Hyphen Chain Protocol']
			},
			'Unmeasured Oracle': { Ethereum: ['Metadata Only'] }
		},
		oraclesTVS: {
			Chainlink: {
				'Null TVL Protocol': { Ethereum: 0 },
				'Zero Protocol': { Ethereum: 0 },
				'Missing Lite Metadata': { Ethereum: 50 },
				'Hyphen Chain Protocol': { 'X-Layer': 42, 'X-Layer-staking': 3 },
				'Extra Only Protocol': { 'Ethereum-staking': 5 }
			},
			'Unmeasured Oracle': {},
			'Legacy Ghost': { 'Zero Protocol': { Ethereum: 999 } }
		}
	})
	mocks.fetchOracleProtocolBreakdownChart.mockResolvedValue([])
	mocks.fetchOracleProtocolChart.mockResolvedValue([])
	mocks.fetchOracleProtocolChainBreakdownChart.mockResolvedValue([])
	mocks.fetchOracleChainProtocolBreakdownChart.mockResolvedValue([])
})

describe('Oracle queries', () => {
	it('takes canonical oracle membership, order, and counts from metrics.oracles', async () => {
		const data = await getOraclesListPageData()

		expect(data?.oracles).toEqual(['Chainlink', 'Unmeasured Oracle'])
		expect(data?.tableData).toEqual([
			expect.objectContaining({ name: 'Chainlink', protocolsSecured: 6, tvl: 92 }),
			expect.objectContaining({ name: 'Unmeasured Oracle', protocolsSecured: 1, tvl: 0 })
		])
		expect(await getOracleDetailPageData({ oracle: 'legacy-ghost' })).toBeNull()
	})

	it('treats omitted successful member measurements as zero and omits unsafe rows', async () => {
		const data = await getOracleDetailPageData({ oracle: 'chainlink' })

		expect(data?.tvl).toBe(92)
		expect(data?.protocolTableData.map((row) => [row.name, row.tvl])).toEqual([
			['Null TVL Protocol', 0],
			['Zero Protocol', 0],
			['Metadata Only', 0],
			['Hyphen Chain Protocol', 42],
			['Extra Only Protocol', 0]
		])
		expect(data?.protocolTableData).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ name: 'Missing Lite Metadata' })])
		)
	})

	it('uses exact selected-chain membership while summing available measurements', async () => {
		const data = await getOracleDetailPageData({ oracle: 'chainlink', chain: 'ethereum' })
		const listData = await getOraclesListPageData({ chain: 'ethereum' })

		expect(data?.tvl).toBe(50)
		expect(data?.extraTvl).toEqual({ staking: 5 })
		expect(data?.protocolTableData.map((row) => [row.name, row.tvl])).toEqual([
			['Null TVL Protocol', 0],
			['Zero Protocol', 0],
			['Metadata Only', 0],
			['Extra Only Protocol', 0]
		])
		expect(listData?.tableData).toEqual([
			expect.objectContaining({ name: 'Chainlink', protocolsSecured: 5, tvl: 50, extraTvl: { staking: 5 } }),
			expect.objectContaining({ name: 'Unmeasured Oracle', protocolsSecured: 1, tvl: 0 })
		])
	})

	it('orders successful omitted and explicit zero measurements together', async () => {
		mocks.fetchOracleMetrics.mockResolvedValueOnce({
			oracles: { Unknown: ['Unknown'], Zero: ['Zero'], Positive: ['Positive'] },
			chainsByOracle: { Unknown: [], Zero: ['Ethereum'], Positive: ['Ethereum'] },
			protocolsByOracleChain: {
				Unknown: {},
				Zero: { Ethereum: ['Zero'] },
				Positive: { Ethereum: ['Positive'] }
			},
			oraclesTVS: {
				Unknown: {},
				Zero: { Zero: { Ethereum: 0 } },
				Positive: { Positive: { Ethereum: 10 } }
			}
		})

		const data = await getOraclesListPageData()
		expect(data?.oracles).toEqual(['Positive', 'Unknown', 'Zero'])
		expect(data?.tableData.map(({ name, tvl }) => [name, tvl])).toEqual([
			['Positive', 10],
			['Unknown', 0],
			['Zero', 0]
		])
	})

	it('groups only matching Oracle children under their parent', async () => {
		const aaveV2 = { ...protocol('Aave V2', 10), parentProtocol: 'parent#aave' }
		const aaveV3 = { ...protocol('Aave V3', 20), parentProtocol: 'parent#aave' }
		const aaveV4 = { ...protocol('Aave V4', 30), parentProtocol: 'parent#aave' }
		mocks.fetchProtocols.mockResolvedValueOnce({
			...protocolsResponse,
			protocols: [aaveV2, aaveV3, aaveV4],
			parentProtocols: [
				{
					id: 'parent#aave',
					name: 'Aave',
					chains: ['Ethereum'],
					gecko_id: null,
					mcap: null,
					logo: ''
				}
			]
		})
		mocks.fetchOracleMetrics.mockResolvedValueOnce({
			oracles: { Chainlink: ['Aave V2', 'Aave V3'], Pyth: ['Aave V2'] },
			chainsByOracle: { Chainlink: ['Ethereum'], Pyth: ['Ethereum'] },
			protocolsByOracleChain: {
				Chainlink: { Ethereum: ['Aave V2', 'Aave V3'] },
				Pyth: { Ethereum: ['Aave V2'] }
			},
			oraclesTVS: {
				Chainlink: {
					'Aave V2': { Ethereum: 10, 'Ethereum-staking': 1 },
					'Aave V3': { Ethereum: 20, 'Ethereum-staking': 2 }
				},
				Pyth: { 'Aave V2': { Ethereum: 10 } }
			}
		})

		const chainlink = await getOracleDetailPageData({ oracle: 'chainlink' })
		expect(chainlink?.protocolTableData).toEqual([
			expect.objectContaining({
				name: 'Aave',
				tvl: 30,
				extraTvl: { staking: 3 },
				childProtocols: [expect.objectContaining({ name: 'Aave V2' }), expect.objectContaining({ name: 'Aave V3' })]
			})
		])

		mocks.fetchOracleMetrics.mockResolvedValueOnce({
			oracles: { Pyth: ['Aave V2'] },
			chainsByOracle: { Pyth: ['Ethereum'] },
			protocolsByOracleChain: { Pyth: { Ethereum: ['Aave V2'] } },
			oraclesTVS: { Pyth: { 'Aave V2': { Ethereum: 10 } } }
		})
		mocks.fetchProtocols.mockResolvedValueOnce({
			...protocolsResponse,
			protocols: [aaveV2, aaveV3, aaveV4],
			parentProtocols: [{ id: 'parent#aave', name: 'Aave', chains: ['Ethereum'], gecko_id: null, mcap: null, logo: '' }]
		})
		const pyth = await getOracleDetailPageData({ oracle: 'pyth' })
		expect(pyth?.protocolTableData).toEqual([expect.objectContaining({ name: 'Aave V2' })])
		expect(pyth?.protocolTableData[0]).not.toHaveProperty('childProtocols')
	})

	it('recognizes only known extra suffixes so hyphenated base chains remain measurements', async () => {
		const data = await getOracleDetailPageData({ oracle: 'chainlink', chain: 'x-layer' })

		expect(data?.tvl).toBe(42)
		expect(data?.extraTvl).toEqual({ staking: 3 })
		expect(data?.protocolTableData).toEqual([
			expect.objectContaining({ name: 'Hyphen Chain Protocol', tvl: 42, extraTvl: { staking: 3 } })
		])
	})
})
