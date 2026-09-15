import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ParentProtocolLite, ProtocolLite, ProtocolsResponse } from '../api.types'

const mocks = vi.hoisted(() => ({
	fetchProtocols: vi.fn(),
	fetchRaises: vi.fn(),
	fetchChainChart: vi.fn(),
	fetchChainsByCategoryAll: vi.fn()
}))

vi.mock('../api', () => ({
	fetchProtocols: mocks.fetchProtocols
}))
vi.mock('~/containers/Raises/api', () => ({ fetchRaises: mocks.fetchRaises }))
vi.mock('~/containers/Chains/api', () => ({
	fetchChainChart: mocks.fetchChainChart,
	fetchChainsByCategoryAll: mocks.fetchChainsByCategoryAll
}))

import { getAirdropsProtocols, getRecentProtocols, getExtraTvlByChain, getProtocolsMarketCapsByChain } from '../queries'

const tvlEntry = (tvl: number | null, tvlPrevMonth: number | null = tvl) => ({
	tvl,
	tvlPrevDay: tvl,
	tvlPrevWeek: tvl,
	tvlPrevMonth
})

const liteProtocol = ({
	defillamaId,
	name,
	parentProtocol,
	mcap,
	borrowed
}: {
	defillamaId: string
	name: string
	parentProtocol?: string
	mcap: number | null
	borrowed: number | null
}): ProtocolLite => ({
	name,
	symbol: name,
	logo: null,
	url: 'https://example.com',
	category: 'Lending',
	chains: ['Ethereum'],
	chainTvls: { 'Ethereum-borrowed': tvlEntry(borrowed) },
	tvl: 1,
	tvlPrevDay: 1,
	tvlPrevWeek: 1,
	tvlPrevMonth: 1,
	mcap,
	defillamaId,
	geckoId: null,
	...(parentProtocol === undefined ? {} : { parentProtocol })
})

const parentProtocol = (id: string, name: string, mcap: number | null): ParentProtocolLite => ({
	id,
	name,
	logo: '',
	chains: ['Ethereum'],
	gecko_id: null,
	mcap
})

const response = ({
	protocols,
	parentProtocols
}: {
	protocols: Array<ProtocolLite>
	parentProtocols: Array<ParentProtocolLite>
}): ProtocolsResponse => ({
	protocols,
	parentProtocols,
	chains: ['Ethereum'],
	protocolCategories: ['Lending']
})

beforeEach(() => {
	mocks.fetchRaises.mockResolvedValue({ raises: [] })
	mocks.fetchChainChart.mockResolvedValue({
		borrowed: [
			[1, 100],
			[2, 100]
		]
	})
	mocks.fetchChainsByCategoryAll.mockResolvedValue({
		chainTvls: [
			{ name: 'Ethereum', extraTvl: { borrowed: 10 } },
			{ name: 'Zero Chain', extraTvl: { borrowed: 0 } },
			{ name: 'Missing Chain', extraTvl: {} }
		]
	})
})

describe('ProtocolLists queries', () => {
	test('keeps tokenless children only when neither explicit nor parent-token exclusions apply', async () => {
		const base = liteProtocol({ defillamaId: 'base', name: 'Eligible', mcap: null, borrowed: null })
		mocks.fetchProtocols.mockResolvedValue(
			response({
				protocols: [
					{ ...base, symbol: '-' },
					{ ...base, name: 'Has Token', symbol: 'TOKEN' },
					{ ...base, name: 'DeerFi', symbol: '-' },
					{ ...base, name: 'Token Parent Child', symbol: '-', parentProtocol: 'parent#token' },
					{ ...base, name: 'Tokenless Parent Child', defillamaId: 'child', symbol: '-', parentProtocol: 'parent#none' },
					{
						...base,
						name: 'Unknown Parent Child',
						defillamaId: 'unknown',
						symbol: '-',
						parentProtocol: 'parent#unknown'
					}
				],
				parentProtocols: [
					{ ...parentProtocol('parent#token', 'Token Parent', 1), gecko_id: 'token' },
					parentProtocol('parent#none', 'Tokenless Parent', null)
				]
			})
		)
		const result = await getAirdropsProtocols()
		expect(result.protocols.map((row) => row.name)).toEqual([
			'Eligible',
			'Tokenless Parent Child',
			'Unknown Parent Child'
		])
	})
	test('recent includes dated individual listings, preserving timestamps and newest-first order', async () => {
		const base = liteProtocol({ defillamaId: 'base', name: 'Undated', mcap: null, borrowed: null })
		mocks.fetchProtocols.mockResolvedValue(
			response({
				protocols: [
					base,
					{ ...base, name: 'Older', listedAt: 100 },
					{ ...base, name: 'Newer Child', parentProtocol: 'parent#one', listedAt: 200 },
					{ ...base, name: 'Epoch', listedAt: 0 }
				],
				parentProtocols: []
			})
		)
		const result = await getRecentProtocols()
		expect(result.protocols.map((row) => [row.name, row.listedAt])).toEqual([
			['Newer Child', 200],
			['Older', 100],
			['Epoch', 0]
		])
	})
	test.each([['funding rounds', () => mocks.fetchRaises.mockRejectedValueOnce(new Error('raises unavailable'))]])(
		'does not publish potential-airdrop membership when %s exclusions fail',
		async (_source, fail) => {
			mocks.fetchProtocols.mockResolvedValue(response({ protocols: [], parentProtocols: [] }))
			fail()

			await expect(getAirdropsProtocols()).rejects.toThrow('unavailable')
		}
	)

	test.each([false, true])('sums disclosed rounds regardless of order (reversed: %s)', async (reversed) => {
		mocks.fetchProtocols.mockResolvedValue(
			response({
				protocols: [
					{ ...liteProtocol({ defillamaId: 'partial', name: 'Partial', mcap: null, borrowed: null }), symbol: '-' },
					{ ...liteProtocol({ defillamaId: 'unknown', name: 'Unknown', mcap: null, borrowed: null }), symbol: '-' },
					{ ...liteProtocol({ defillamaId: 'zero', name: 'Zero', mcap: null, borrowed: null }), symbol: '-' },
					{ ...liteProtocol({ defillamaId: 'none', name: 'None', mcap: null, borrowed: null }), symbol: '-' }
				],
				parentProtocols: []
			})
		)
		const raises = [
			{ defillamaId: 'partial', amountUsd: 10 },
			{ defillamaId: 'partial', amountUsd: null },
			{ defillamaId: 'zero', amountUsd: 0 },
			{ defillamaId: 'zero', amountUsd: null },
			{ defillamaId: 'unknown', amountUsd: null }
		]
		mocks.fetchRaises.mockResolvedValue({ raises: reversed ? raises.toReversed() : raises })

		const result = await getAirdropsProtocols()
		expect(result.protocols.map(({ name, raiseSummary }) => [name, raiseSummary])).toEqual([
			['Partial', { totalUsd: 10, undisclosedCount: 1 }],
			['Unknown', { totalUsd: null, undisclosedCount: 1 }],
			['Zero', { totalUsd: 0, undisclosedCount: 1 }],
			['None', undefined]
		])
	})

	test('preserves null and zero extra TVL while grouping only canonical multi-child parents', async () => {
		mocks.fetchProtocols.mockResolvedValue(
			response({
				protocols: [
					liteProtocol({
						defillamaId: 'known-child',
						name: 'Known Child',
						parentProtocol: 'parent#multi',
						mcap: 1,
						borrowed: 10
					}),
					liteProtocol({
						defillamaId: 'null-child',
						name: 'Null Child',
						parentProtocol: 'parent#multi',
						mcap: 1,
						borrowed: null
					}),
					liteProtocol({
						defillamaId: 'single-child',
						name: 'Single Child',
						parentProtocol: 'parent#single',
						mcap: 2,
						borrowed: 4
					}),
					liteProtocol({
						defillamaId: 'orphan-child',
						name: 'Orphan Child',
						parentProtocol: 'parent#missing',
						mcap: 3,
						borrowed: 3
					}),
					liteProtocol({
						defillamaId: 'zero-protocol',
						name: 'Zero Protocol',
						mcap: 0,
						borrowed: 0
					})
				],
				parentProtocols: [
					parentProtocol('parent#multi', 'Multi Parent', 100),
					parentProtocol('parent#single', 'Single Parent', 200)
				]
			})
		)

		const result = await getExtraTvlByChain({ chain: 'Ethereum', metric: 'borrowed', protocolMetadata: {} })

		expect(result?.chains.map((chain) => chain.label)).toEqual(['All', 'Ethereum', 'Zero Chain'])
		expect(result?.protocols.find((protocol) => protocol.name === 'Multi Parent')).toMatchObject({
			value: null,
			subRows: [
				expect.objectContaining({ name: 'Known Child', value: 10 }),
				expect.objectContaining({ name: 'Null Child', value: null })
			]
		})
		expect(result?.protocols.find((protocol) => protocol.name === 'Single Child')?.value).toBe(4)
		expect(result?.protocols.find((protocol) => protocol.name === 'Single Parent')).toBeUndefined()
		expect(result?.protocols.find((protocol) => protocol.name === 'Orphan Child')?.value).toBe(3)
		expect(result?.protocols.find((protocol) => protocol.name === 'Zero Protocol')?.value).toBe(0)
	})

	test('uses exact parent IDs for token metrics and keeps unknown or sole children public', async () => {
		mocks.fetchProtocols.mockResolvedValue(
			response({
				protocols: [
					liteProtocol({
						defillamaId: 'multi-a',
						name: 'Multi A',
						parentProtocol: 'parent#multi',
						mcap: 10,
						borrowed: 0
					}),
					liteProtocol({
						defillamaId: 'multi-b',
						name: 'Multi B',
						parentProtocol: 'parent#multi',
						mcap: 20,
						borrowed: 0
					}),
					liteProtocol({
						defillamaId: 'single-child',
						name: 'Single Child',
						parentProtocol: 'parent#single',
						mcap: 30,
						borrowed: 0
					}),
					liteProtocol({
						defillamaId: 'orphan-child',
						name: 'Orphan Child',
						parentProtocol: 'parent#missing',
						mcap: 40,
						borrowed: 0
					})
				],
				parentProtocols: [
					parentProtocol('parent#multi', 'Multi Parent', 100),
					parentProtocol('parent#single', 'Single Parent', 200)
				]
			})
		)

		const result = await getProtocolsMarketCapsByChain({ chain: 'All', protocolMetadata: {} })

		expect(result?.protocols.map((protocol) => [protocol.name, protocol.value])).toEqual([
			['Multi Parent', 100],
			['Orphan Child', 40],
			['Single Child', 30]
		])
		expect(result?.protocols[0]?.subRows?.map((protocol) => protocol.name)).toEqual(['Multi A', 'Multi B'])
	})
})
