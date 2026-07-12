import { describe, expect, it } from 'vitest'
import type { BlockExplorersResponse } from '~/api/types'
import type { RawAllLiquidationsResponse, RawProtocolsResponse } from '../api.types'
import { createProtocolMetadataLookup } from '../protocolMetadata'
import {
	buildLiquidationsChainPageData,
	buildLiquidationsOverviewPageData,
	buildLiquidationsProtocolPageData,
	buildTokenLiquidationsSectionData,
	hasTokenLiquidationsData,
	resolveChainId,
	resolveProtocolId
} from '../queries'

const metadata = {
	protocolMetadata: {
		'118': { name: 'maker', displayName: 'Sky' },
		'1599': { name: 'aave-v3', displayName: 'Aave V3' },
		'2088': { name: 'compound-v3', displayName: 'Compound V3' }
	},
	chainMetadata: {
		arbitrum: { id: 'arbitrum', name: 'Arbitrum One' },
		ethereum: { id: 'ethereum', name: 'Ethereum' },
		base: { id: 'base', name: 'Base' }
	}
}

const blockExplorers: BlockExplorersResponse = [
	{
		displayName: 'Arbitrum',
		llamaChainId: 'arbitrum',
		evmChainId: 42161,
		blockExplorers: [{ name: 'Arbiscan', url: 'https://arbiscan.io' }]
	},
	{
		displayName: 'Ethereum',
		llamaChainId: 'ethereum',
		evmChainId: 1,
		blockExplorers: [{ name: 'Etherscan', url: 'https://etherscan.io' }]
	}
]

const protocolsResponse: RawProtocolsResponse = { protocols: ['aave-v3', 'compound-v3'] }
const allResponse: RawAllLiquidationsResponse = {
	timestamp: 400,
	validThresholds: ['all'],
	tokens: {
		arbitrum: {
			'ethereum:wsteth': { symbol: 'wstETH', decimals: 18 }
		},
		ethereum: {
			'ethereum:wsteth': { symbol: 'wstETH', decimals: 18 },
			'ethereum:eth': { symbol: 'ETH', decimals: 18 }
		},
		base: { 'base:wsteth': { symbol: 'WSTETH', decimals: 18 } }
	},
	data: {
		'aave-v3': {
			arbitrum: [
				{
					owner: '0x1',
					liqPrice: 1,
					collateral: 'ethereum:wsteth',
					collateralAmount: 10,
					collateralAmountUsd: 1000,
					extra: { displayName: 'alice', url: 'https://example.com/1' }
				}
			],
			ethereum: [
				{
					owner: '0x2',
					liqPrice: 2,
					collateral: 'ethereum:eth',
					collateralAmount: 20,
					collateralAmountUsd: 2000
				}
			]
		},
		'compound-v3': {
			base: [
				{
					owner: '0x3',
					liqPrice: 3,
					collateral: 'base:wsteth',
					collateralAmount: 30,
					collateralAmountUsd: 3000
				}
			]
		}
	}
}

describe('LiquidationsV2 pure queries', () => {
	it('builds overview data from snapshot values', () => {
		const data = buildLiquidationsOverviewPageData(protocolsResponse, allResponse, metadata)

		expect(data.protocolCount).toBe(2)
		expect(data.chainCount).toBe(3)
		expect(data.positionCount).toBe(3)
		expect(data.totalCollateralUsd).toBe(6000)
	})

	it('resolves route params and builds protocol and chain data', () => {
		const lookup = createProtocolMetadataLookup(metadata.protocolMetadata)
		const protocolId = resolveProtocolId('aave-v3', protocolsResponse.protocols, lookup)
		expect(protocolId).toBe('aave-v3')
		if (!protocolId) throw new Error('Expected protocol id')

		const protocolData = buildLiquidationsProtocolPageData(
			protocolId,
			protocolsResponse.protocols,
			allResponse.data[protocolId],
			allResponse.timestamp,
			blockExplorers,
			metadata
		)
		const chainId = resolveChainId('arbitrum-one', Object.keys(allResponse.data[protocolId]), metadata.chainMetadata)
		expect(chainId).toBe('arbitrum')
		if (!chainId) throw new Error('Expected chain id')

		const chainData = buildLiquidationsChainPageData(
			protocolId,
			chainId,
			protocolsResponse.protocols,
			allResponse.data[protocolId],
			allResponse.timestamp,
			blockExplorers,
			metadata
		)

		expect(protocolData.positionCount).toBe(2)
		expect(protocolData.ownerBlockExplorers.map((entry) => entry.llamaChainId)).toEqual(['arbitrum', 'ethereum'])
		expect(chainData.positionCount).toBe(1)
		expect(chainData.positions[0]?.ownerName).toBe('alice')
	})

	it('returns null for route params absent from snapshot data', () => {
		const lookup = createProtocolMetadataLookup(metadata.protocolMetadata)
		expect(resolveProtocolId('missing', protocolsResponse.protocols, lookup)).toBeNull()
		expect(resolveChainId('missing', ['arbitrum'], metadata.chainMetadata)).toBeNull()
	})

	it('builds token-scoped data and checks current snapshot availability', () => {
		const data = buildTokenLiquidationsSectionData('wsteth', protocolsResponse, allResponse, metadata)

		expect(data?.tokenSymbol).toBe('WSTETH')
		expect(data?.positionCount).toBe(2)
		expect(data?.protocolCount).toBe(2)
		expect(data?.chainCount).toBe(2)
		expect(data?.totalCollateralUsd).toBe(4000)
		expect(hasTokenLiquidationsData('wsteth', protocolsResponse, allResponse)).toBe(true)
		expect(hasTokenLiquidationsData('ldo', protocolsResponse, allResponse)).toBe(false)
	})
})
