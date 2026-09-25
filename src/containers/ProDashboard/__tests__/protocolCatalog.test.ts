import { describe, expect, test } from 'vitest'
import type { ChainListItem } from '~/containers/Chains/api.types'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { buildProDashboardParentMapping, buildProDashboardProtocolCatalog } from '../protocolCatalog'

const protocol = (
	overrides: Partial<ProtocolsResponse['protocols'][number]> = {}
): ProtocolsResponse['protocols'][number] => ({
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
	geckoId: null,
	defillamaId: '1',
	listedAt: 1_700_000_000,
	...overrides
})

const parentProtocol = (
	overrides: Partial<ProtocolsResponse['parentProtocols'][number]> = {}
): ProtocolsResponse['parentProtocols'][number] => ({
	id: 'parent#group',
	name: 'Group',
	chains: [] as Array<string>,
	gecko_id: null,
	mcap: null,
	logo: 'group.png',
	...overrides
})

describe('buildProDashboardProtocolCatalog', () => {
	test('uses Lens membership and metrics while Lite contributes display metadata only', () => {
		const protocolsData: ProtocolsResponse = {
			protocols: [
				protocol({ parentProtocol: 'parent#group', tvl: 999, geckoId: 'wrong' }),
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
					mcap: null,
					logo: 'group.png'
				}
			],
			protocolCategories: []
		}
		const chainsData: Array<ChainListItem> = [
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

		const result = buildProDashboardProtocolCatalog(
			[
				{
					slug: 'child',
					name: 'Child SQL',
					parentSlug: 'group',
					category: 'Dexes',
					tvl: 10,
					symbol: 'CHILD',
					geckoId: 'group-token',
					hasMisrepresentedTokens: true,
					excludeTvlFromParent: false
				},
				{
					slug: 'standalone',
					name: 'Standalone',
					parentSlug: 'standalone',
					category: null,
					tvl: null,
					symbol: null,
					geckoId: 'standalone',
					hasMisrepresentedTokens: false,
					excludeTvlFromParent: false
				}
			],
			protocolsData,
			chainsData
		)

		expect(result.chains.map((chain) => chain.name)).toEqual(['Base', 'Ethereum'])
		expect(result.protocols).toEqual([
			expect.objectContaining({
				id: 'child',
				slug: 'child',
				symbol: 'CHILD',
				geckoId: 'group-token',
				listedAt: 1_700_000_000,
				parentProtocol: 'group',
				misrepresentedTokens: true
			}),
			expect.objectContaining({
				id: 'standalone',
				slug: 'standalone',
				tvl: 0,
				geckoId: 'standalone',
				parentProtocol: null
			}),
			expect.objectContaining({
				id: 'group',
				slug: 'group',
				symbol: 'CHILD',
				tvl: 10,
				geckoId: 'group-token',
				misrepresentedTokens: true
			})
		])
	})

	test('builds reusable parent indexes regardless of catalog order', () => {
		const protocols = [
			{
				id: 'child',
				name: 'Child',
				slug: 'child',
				symbol: 'CHILD',
				tvl: 1,
				chains: [],
				parentProtocol: 'parent'
			},
			{
				id: 'parent',
				name: 'Parent',
				slug: 'parent',
				symbol: 'PARENT',
				tvl: 2,
				chains: [],
				parentProtocol: null
			}
		]

		expect(buildProDashboardParentMapping(protocols)).toEqual(new Map([['parent', ['child']]]))
	})

	test('keeps the canonical Lens protocol when its slug matches Lite parent metadata', () => {
		const result = buildProDashboardProtocolCatalog(
			[
				{
					slug: 'group',
					name: 'Group',
					parentSlug: 'group',
					category: null,
					tvl: 4,
					symbol: null,
					geckoId: null,
					hasMisrepresentedTokens: false,
					excludeTvlFromParent: false
				}
			],
			{
				protocols: [protocol({ name: 'Group', defillamaId: 'real', tvl: 4 })],
				chains: [],
				parentProtocols: [parentProtocol()],
				protocolCategories: []
			},
			[]
		)

		expect(result.protocols).toHaveLength(1)
		expect(result.protocols[0]).toMatchObject({ id: 'group', tvl: 4 })
	})

	test('keeps a zero-TVL parent when every child is excluded from its parent total', () => {
		const result = buildProDashboardProtocolCatalog(
			[
				{
					slug: 'excluded-child',
					name: 'Excluded Child',
					parentSlug: 'group',
					category: 'Dexes',
					tvl: 25,
					symbol: null,
					geckoId: null,
					hasMisrepresentedTokens: false,
					excludeTvlFromParent: true
				}
			],
			{ protocols: [], chains: [], parentProtocols: [parentProtocol()], protocolCategories: [] },
			[]
		)

		expect(result.protocols).toEqual([
			expect.objectContaining({ id: 'excluded-child', tvl: 25, parentProtocol: 'group' }),
			expect.objectContaining({ id: 'group', tvl: 0, parentProtocol: null })
		])
	})

	test('replaces a parent self row with the aggregate of its eligible children', () => {
		const result = buildProDashboardProtocolCatalog(
			[
				{
					slug: 'group',
					name: 'Group',
					parentSlug: 'group',
					category: 'Dexes',
					tvl: 999,
					symbol: null,
					geckoId: null,
					hasMisrepresentedTokens: false,
					excludeTvlFromParent: false
				},
				{
					slug: 'included-child',
					name: 'Included Child',
					parentSlug: 'group',
					category: 'Dexes',
					tvl: 40,
					symbol: null,
					geckoId: null,
					hasMisrepresentedTokens: false,
					excludeTvlFromParent: false
				},
				{
					slug: 'excluded-child',
					name: 'Excluded Child',
					parentSlug: 'group',
					category: 'Dexes',
					tvl: 25,
					symbol: null,
					geckoId: null,
					hasMisrepresentedTokens: false,
					excludeTvlFromParent: true
				}
			],
			{ protocols: [], chains: [], parentProtocols: [parentProtocol()], protocolCategories: [] },
			[]
		)

		expect(result.protocols.filter((item) => item.slug === 'group')).toEqual([
			expect.objectContaining({ tvl: 40, parentProtocol: null })
		])
	})
})
