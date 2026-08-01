import { describe, expect, it } from 'vitest'
import type { ChainListItem } from '~/containers/Chains/api.types'
import type { ProtocolLite, ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import {
	buildProDashboardParentMapping,
	buildProDashboardProtocolCatalog,
	buildProtocolSymbolMap
} from './protocolCatalog'

const protocol = (overrides: Partial<ProtocolLite> = {}): ProtocolLite => ({
	name: 'Child',
	symbol: 'CHILD',
	logo: 'child.png',
	url: 'https://example.com',
	category: 'Lending',
	chains: ['Ethereum'],
	chainTvls: {},
	tvl: 10,
	tvlPrevDay: 9,
	tvlPrevWeek: 8,
	tvlPrevMonth: 7,
	mcap: null,
	defillamaId: '1',
	geckoId: null,
	...overrides
})

describe('buildProDashboardProtocolCatalog', () => {
	it('builds one canonical sorted catalog with parent totals and gecko fallbacks', () => {
		const protocolsData = {
			protocols: [
				protocol({ parentProtocol: 'parent#group' }),
				protocol({ name: 'Standalone', defillamaId: '2', tvl: null, geckoId: 'standalone' })
			],
			chains: ['Ethereum', 'Base'],
			parentProtocols: [
				{
					id: 'parent#group',
					name: 'Group',
					symbol: 'GROUP',
					chains: ['Ethereum'],
					gecko_id: 'group-token',
					logo: 'group.png',
					mcap: null
				}
			],
			protocolCategories: ['Lending']
		} satisfies ProtocolsResponse
		const chainsData: ChainListItem[] = [
			{
				name: 'Ethereum',
				tvl: 100,
				gecko_id: 'ethereum',
				tokenSymbol: 'ETH',
				cmcId: '1027',
				chainId: 1
			},
			{
				name: 'Base',
				tvl: 200,
				gecko_id: null,
				tokenSymbol: null,
				cmcId: null,
				chainId: 8453
			}
		]

		const result = buildProDashboardProtocolCatalog(protocolsData, chainsData)

		expect(result.chains.map((chain) => chain.name)).toEqual(['Base', 'Ethereum'])
		expect(result.protocols).toEqual([
			expect.objectContaining({
				id: '1',
				slug: 'child',
				symbol: 'CHILD',
				geckoId: 'group-token',
				parentProtocol: 'parent#group'
			}),
			expect.objectContaining({
				id: '2',
				slug: 'standalone',
				tvl: null,
				geckoId: 'standalone',
				parentProtocol: null
			}),
			expect.objectContaining({
				id: 'parent#group',
				slug: 'group',
				symbol: 'GROUP',
				tvl: 10,
				geckoId: 'group-token'
			})
		])
	})

	it('skips no-TVL children without erasing measured parent TVL', () => {
		const result = buildProDashboardProtocolCatalog(
			{
				protocols: [
					protocol({ defillamaId: 'known', parentProtocol: 'parent#group', tvl: 10 }),
					protocol({ defillamaId: 'unknown', parentProtocol: 'parent#group', tvl: null, deprecated: true })
				],
				chains: [],
				parentProtocols: [
					{
						id: 'parent#group',
						name: 'Group',
						chains: [],
						gecko_id: null,
						logo: 'group.png',
						mcap: null
					}
				],
				protocolCategories: []
			} satisfies ProtocolsResponse,
			[]
		)

		expect(result.protocols.find((entry) => entry.id === 'parent#group')?.tvl).toBe(10)
	})

	it('keeps a parent without a measured TVL child unavailable', () => {
		const result = buildProDashboardProtocolCatalog(
			{
				protocols: [protocol({ defillamaId: 'unknown', parentProtocol: 'parent#group', tvl: null })],
				chains: [],
				parentProtocols: [
					{
						id: 'parent#group',
						name: 'Group',
						chains: [],
						gecko_id: null,
						logo: 'group.png',
						mcap: null
					}
				],
				protocolCategories: []
			} satisfies ProtocolsResponse,
			[]
		)

		expect(result.protocols.find((entry) => entry.id === 'parent#group')?.tvl).toBeNull()
	})

	it('subtracts child TVL excluded from its synthetic parent', () => {
		const result = buildProDashboardProtocolCatalog(
			{
				protocols: [
					protocol({
						parentProtocol: 'parent#group',
						tvl: 100,
						chainTvls: {
							excludeParent: { tvl: 30, tvlPrevDay: 20, tvlPrevWeek: 10, tvlPrevMonth: 5 }
						}
					})
				],
				chains: [],
				parentProtocols: [
					{
						id: 'parent#group',
						name: 'Group',
						chains: [],
						gecko_id: null,
						logo: 'group.png',
						mcap: null
					}
				],
				protocolCategories: []
			} satisfies ProtocolsResponse,
			[]
		)

		expect(result.protocols.find((entry) => entry.id === 'parent#group')?.tvl).toBe(70)
	})

	it('keeps synthetic parent TVL unavailable when its required exclusion is unavailable', () => {
		const result = buildProDashboardProtocolCatalog(
			{
				protocols: [
					protocol({
						parentProtocol: 'parent#group',
						chainTvls: {
							excludeParent: { tvl: null, tvlPrevDay: 0, tvlPrevWeek: 0, tvlPrevMonth: 0 }
						}
					})
				],
				chains: [],
				parentProtocols: [
					{
						id: 'parent#group',
						name: 'Group',
						chains: [],
						gecko_id: null,
						logo: 'group.png',
						mcap: null
					}
				],
				protocolCategories: []
			} satisfies ProtocolsResponse,
			[]
		)

		expect(result.protocols.find((entry) => entry.id === 'parent#group')?.tvl).toBeNull()
	})

	it('preserves explicit zero TVL for children and parent totals', () => {
		const result = buildProDashboardProtocolCatalog(
			{
				protocols: [protocol({ defillamaId: 'zero', parentProtocol: 'parent#group', tvl: 0 })],
				chains: [],
				parentProtocols: [
					{
						id: 'parent#group',
						name: 'Group',
						chains: [],
						gecko_id: null,
						logo: 'group.png',
						mcap: null
					}
				],
				protocolCategories: []
			} satisfies ProtocolsResponse,
			[]
		)

		expect(result.protocols.find((entry) => entry.id === 'zero')?.tvl).toBe(0)
		expect(result.protocols.find((entry) => entry.id === 'parent#group')?.tvl).toBe(0)
	})

	it('builds reusable parent and symbol indexes regardless of catalog order', () => {
		const protocols = [
			{ id: 'child', name: 'Child', slug: 'child', symbol: 'CHILD', tvl: 1, parentProtocol: 'parent' },
			{ id: 'parent', name: 'Parent', slug: 'parent', symbol: 'PARENT', tvl: 2, parentProtocol: null }
		]

		expect(buildProDashboardParentMapping(protocols)).toEqual(new Map([['parent', ['child']]]))
		expect(buildProtocolSymbolMap(protocols)).toEqual(
			new Map([
				['child', 'CHILD'],
				['parent', 'PARENT']
			])
		)
	})

	it('keeps the API protocol when a synthetic parent has the same slug', () => {
		const result = buildProDashboardProtocolCatalog(
			{
				protocols: [protocol({ name: 'Group', defillamaId: 'real', tvl: 4 })],
				chains: [],
				parentProtocols: [
					{
						id: 'parent#group',
						name: 'Group',
						symbol: 'GROUP',
						chains: [],
						gecko_id: null,
						mcap: null,
						logo: ''
					}
				],
				protocolCategories: []
			} satisfies ProtocolsResponse,
			[]
		)

		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0]?.id).toBe('real')
	})
})
