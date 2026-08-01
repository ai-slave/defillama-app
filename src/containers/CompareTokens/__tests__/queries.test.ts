import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdapterChainProtocol, IAdapterChainMetrics } from '~/containers/AdapterMetrics/api.types'
import type { ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'

const mocks = vi.hoisted(() => ({
	fetchCoinGeckoTokensListFromDataset: vi.fn(),
	fetchAdapterChainMetrics: vi.fn(),
	fetchProtocols: vi.fn()
}))

vi.mock('~/api/coingecko', () => ({
	fetchCoinGeckoTokensListFromDataset: mocks.fetchCoinGeckoTokensListFromDataset
}))
vi.mock('~/containers/AdapterMetrics/api', () => ({ fetchAdapterChainMetrics: mocks.fetchAdapterChainMetrics }))
vi.mock('~/containers/ProtocolLists/api', () => ({ fetchProtocols: mocks.fetchProtocols }))

import { getCompareTokensPageData } from '../queries'

function protocol({
	name,
	id,
	tvl,
	chainTvls = {},
	deprecated
}: {
	name: string
	id: string
	tvl: number | null
	chainTvls?: ProtocolLite['chainTvls']
	deprecated?: true
}): ProtocolLite {
	return {
		name,
		symbol: name,
		logo: null,
		url: '',
		category: 'Lending',
		chains: ['Ethereum'],
		chainTvls,
		tvl,
		tvlPrevDay: null,
		tvlPrevWeek: null,
		tvlPrevMonth: null,
		mcap: null,
		defillamaId: id,
		geckoId: null,
		parentProtocol: 'parent#suite',
		...(deprecated ? { deprecated: true } : {})
	}
}

function adapterMetrics(protocols: IAdapterChainMetrics['protocols']): IAdapterChainMetrics {
	return {
		breakdown24h: null,
		breakdown30d: null,
		chain: null,
		allChains: [],
		total24h: 0,
		total48hto24h: 0,
		total7d: 0,
		total14dto7d: 0,
		total60dto30d: 0,
		total30d: 0,
		total1y: 0,
		change_1d: 0,
		change_7d: 0,
		change_1m: 0,
		change_7dover7d: 0,
		change_30dover30d: 0,
		total7DaysAgo: 0,
		total30DaysAgo: 0,
		totalAllTime: 0,
		protocols
	}
}

function adapterProtocol(defillamaId: string, total24h: number | null): AdapterChainProtocol {
	return {
		defillamaId,
		name: defillamaId,
		displayName: defillamaId,
		module: defillamaId,
		category: 'Lending',
		logo: '',
		chains: ['Ethereum'],
		protocolType: 'protocol',
		methodologyURL: null,
		methodology: null,
		slug: defillamaId,
		id: defillamaId,
		breakdown24h: null,
		breakdown30d: null,
		total24h
	}
}

beforeEach(() => {
	const protocolsResponse = {
		protocols: [
			protocol({ name: 'Known Child', id: 'known-child', tvl: 100 }),
			protocol({ name: 'Null Child', id: 'null-child', tvl: null, deprecated: true })
		],
		chains: ['Ethereum'],
		parentProtocols: [
			{
				id: 'parent#suite',
				name: 'Suite',
				chains: ['Ethereum'],
				gecko_id: null,
				mcap: null,
				logo: ''
			}
		],
		protocolCategories: ['Lending']
	} satisfies ProtocolsResponse
	mocks.fetchCoinGeckoTokensListFromDataset.mockResolvedValue([])
	mocks.fetchProtocols.mockResolvedValue(protocolsResponse)
	mocks.fetchAdapterChainMetrics.mockImplementation(async ({ dataType }) => {
		if (dataType === 'dailyRevenue') throw new Error('revenue unavailable')
		return adapterMetrics([adapterProtocol('known-child', null)])
	})
})

describe('getCompareTokensPageData', () => {
	it('separates adapter failure from successful zero activity and skips no-TVL children in parent TVL', async () => {
		const result = await getCompareTokensPageData()
		const knownChild = result.protocols.find((row) => row.name === 'Known Child')
		const nullChild = result.protocols.find((row) => row.name === 'Null Child')
		const parent = result.protocols.find((row) => row.name === 'Suite')

		expect(knownChild).toMatchObject({ tvl: 100, fees: 0, revenue: null })
		expect(nullChild).toMatchObject({ tvl: null, fees: 0, revenue: null })
		expect(parent).toMatchObject({ tvl: 100, fees: 0, revenue: null })
	})

	it('keeps a parent without any measured child TVL unavailable', async () => {
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [protocol({ name: 'Null Child', id: 'null-child', tvl: null, deprecated: true })],
			chains: ['Ethereum'],
			parentProtocols: [
				{ id: 'parent#suite', name: 'Suite', chains: ['Ethereum'], gecko_id: null, mcap: null, logo: '' }
			],
			protocolCategories: ['Lending']
		} satisfies ProtocolsResponse)

		const result = await getCompareTokensPageData()

		expect(result.protocols.find((row) => row.name === 'Suite')?.tvl).toBeNull()
	})

	it('subtracts each child TVL excluded from its synthetic parent', async () => {
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [
				protocol({
					name: 'Excluded Child',
					id: 'excluded-child',
					tvl: 100,
					chainTvls: {
						excludeParent: { tvl: 30, tvlPrevDay: 0, tvlPrevWeek: 0, tvlPrevMonth: 0 }
					}
				})
			],
			chains: ['Ethereum'],
			parentProtocols: [
				{ id: 'parent#suite', name: 'Suite', chains: ['Ethereum'], gecko_id: null, mcap: null, logo: '' }
			],
			protocolCategories: ['Lending']
		} satisfies ProtocolsResponse)

		const result = await getCompareTokensPageData()

		expect(result.protocols.find((row) => row.name === 'Suite')?.tvl).toBe(70)
	})

	it('keeps synthetic parent TVL unavailable when a required exclusion is unavailable', async () => {
		mocks.fetchProtocols.mockResolvedValue({
			protocols: [
				protocol({
					name: 'Excluded Child',
					id: 'excluded-child',
					tvl: 100,
					chainTvls: {
						excludeParent: { tvl: null, tvlPrevDay: 0, tvlPrevWeek: 0, tvlPrevMonth: 0 }
					}
				})
			],
			chains: ['Ethereum'],
			parentProtocols: [
				{ id: 'parent#suite', name: 'Suite', chains: ['Ethereum'], gecko_id: null, mcap: null, logo: '' }
			],
			protocolCategories: ['Lending']
		} satisfies ProtocolsResponse)

		const result = await getCompareTokensPageData()

		expect(result.protocols.find((row) => row.name === 'Suite')?.tvl).toBeNull()
	})
})
