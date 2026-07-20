import { describe, expect, it } from 'vitest'
import type { ChainListItem } from '~/containers/Chains/api.types'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import {
	buildProDashboardParentMapping,
	buildProDashboardProtocolCatalog,
	buildProtocolSymbolMap
} from './protocolCatalog'

const protocol = (overrides: Partial<ProtocolsResponse['protocols'][number]> = {}) => ({
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
	...overrides
})

describe('buildProDashboardProtocolCatalog', () => {
	it('builds one canonical sorted catalog with parent totals and gecko fallbacks', () => {
		const protocolsData: ProtocolsResponse = {
			protocols: [
				protocol({ parentProtocol: 'parent#group', misrepresentedTokens: true }),
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
					logo: 'group.png'
				}
			]
		}
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
				parentProtocol: 'parent#group',
				misrepresentedTokens: true
			}),
			expect.objectContaining({
				id: '2',
				slug: 'standalone',
				tvl: 0,
				geckoId: 'standalone',
				parentProtocol: null
			}),
			expect.objectContaining({
				id: 'parent#group',
				slug: 'group',
				symbol: 'GROUP',
				tvl: 10,
				geckoId: 'group-token',
				misrepresentedTokens: true
			})
		])
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
				parentProtocols: [{ id: 'parent#group', name: 'Group', chains: [] }]
			},
			[]
		)

		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0].id).toBe('real')
	})
})
