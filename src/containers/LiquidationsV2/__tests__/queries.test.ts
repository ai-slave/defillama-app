import { describe, expect, it } from 'vitest'
import type { BlockExplorersResponse } from '~/api/types'
import type { LiquidationPosition, RawAllLiquidationsResponse, RawProtocolsResponse } from '../api.types'
import { createProtocolMetadataLookup } from '../protocolMetadata'
import {
	buildLiquidationsChainPageData,
	buildLiquidationsDistributionChart,
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

	it('keeps deterministic multi-token breakdowns while excluding invalid and zero positions', () => {
		const response: RawAllLiquidationsResponse = {
			...allResponse,
			data: {
				'aave-v3': {
					...allResponse.data['aave-v3'],
					arbitrum: [
						...allResponse.data['aave-v3'].arbitrum,
						{
							owner: 'invalid',
							liqPrice: Number.NaN,
							collateral: 'ethereum:wsteth',
							collateralAmount: 0,
							collateralAmountUsd: 0
						}
					]
				},
				'compound-v3': {
					base: allResponse.data['compound-v3'].base.map((position) => ({
						...position,
						collateral: 'ethereum:wsteth'
					}))
				}
			}
		}

		const data = buildLiquidationsOverviewPageData(protocolsResponse, response, metadata)

		expect(data.distributionChart.tokens.map((token) => [token.label, token.totalUsd])).toEqual([
			['ethereum:wsteth', 4000],
			['ethereum:eth', 2000]
		])
		expect(data.distributionChart.tokens[0].breakdowns.protocol.series.map((series) => series.label)).toEqual([
			'Compound V3',
			'Aave V3'
		])
		expect(data.distributionChart.tokens[0].breakdowns.chain.series.map((series) => series.label)).toEqual([
			'Base',
			'Arbitrum One'
		])
		expect(data.distributionChart.tokens[0].breakdowns.total.bins).toHaveLength(60)
	})

	it('builds exact total, protocol, and chain series in one shared set of bins', () => {
		const position = (
			collateral: string,
			liqPrice: number,
			collateralAmount: number,
			collateralAmountUsd: number,
			protocolName: string,
			chainName: string
		): Pick<
			LiquidationPosition,
			'collateral' | 'liqPrice' | 'collateralAmount' | 'collateralAmountUsd' | 'protocolName' | 'chainName'
		> => ({ collateral, liqPrice, collateralAmount, collateralAmountUsd, protocolName, chainName })
		const input = [
			position('token-a', 0, 1, 100, 'Alpha', 'Chain Two'),
			position('token-a', 2, 2, 100, 'Beta', 'Chain One'),
			position('token-a', 1, 3, 50, 'Alpha', 'Chain One'),
			position('token-b', 1, 5, 250, 'Gamma', 'Chain Three')
		]
		const snapshot = structuredClone(input)

		const chart = buildLiquidationsDistributionChart(input, 2)
		const tokenA = chart.tokens[0]

		expect(chart.tokens.map((token) => token.label)).toEqual(['token-a', 'token-b'])
		expect(tokenA).toEqual({
			key: 'token-a',
			label: 'token-a',
			totalUsd: 250,
			breakdowns: {
				total: {
					bins: [0, 1],
					series: [{ key: 'token-a', label: 'token-a', usd: [100, 150], amount: [1, 5], totalUsd: 250 }]
				},
				protocol: {
					bins: [0, 1],
					series: [
						{ key: 'Alpha', label: 'Alpha', usd: [100, 50], amount: [1, 3], totalUsd: 150 },
						{ key: 'Beta', label: 'Beta', usd: [0, 100], amount: [0, 2], totalUsd: 100 }
					]
				},
				chain: {
					bins: [0, 1],
					series: [
						{ key: 'Chain One', label: 'Chain One', usd: [0, 150], amount: [0, 5], totalUsd: 150 },
						{ key: 'Chain Two', label: 'Chain Two', usd: [100, 0], amount: [1, 0], totalUsd: 100 }
					]
				}
			}
		})
		expect(tokenA.breakdowns.protocol.bins).toBe(tokenA.breakdowns.total.bins)
		expect(tokenA.breakdowns.chain.bins).toBe(tokenA.breakdowns.total.bins)
		expect(input).toEqual(snapshot)
	})

	it('uses alphabetical tie ordering and the last token label for a repeated token key', () => {
		const chart = buildLiquidationsDistributionChart(
			[
				{
					collateral: 'first',
					liqPrice: 1,
					collateralAmount: 1,
					collateralAmountUsd: 10,
					protocolName: 'Zulu',
					chainName: 'Zulu'
				},
				{
					collateral: 'second',
					liqPrice: 1,
					collateralAmount: 1,
					collateralAmountUsd: 10,
					protocolName: 'Alpha',
					chainName: 'Alpha'
				}
			],
			1,
			(position) => ({ key: 'shared', label: position.collateral })
		)

		expect(chart.tokens[0].label).toBe('second')
		expect(chart.tokens[0].breakdowns.protocol.series.map((series) => series.label)).toEqual(['Alpha', 'Zulu'])
		expect(chart.tokens[0].breakdowns.chain.series.map((series) => series.label)).toEqual(['Alpha', 'Zulu'])
	})

	it('applies the exact validity predicate and handles zero-price single-bin data', () => {
		const base = { collateral: 'token', protocolName: 'Protocol', chainName: 'Chain' }
		const chart = buildLiquidationsDistributionChart(
			[
				{ ...base, liqPrice: Number.NaN, collateralAmount: 1, collateralAmountUsd: 10 },
				{ ...base, liqPrice: -1, collateralAmount: 1, collateralAmountUsd: 10 },
				{ ...base, liqPrice: 0, collateralAmount: Number.POSITIVE_INFINITY, collateralAmountUsd: 10 },
				{ ...base, liqPrice: 0, collateralAmount: 1, collateralAmountUsd: Number.NEGATIVE_INFINITY },
				{ ...base, liqPrice: 0, collateralAmount: 0, collateralAmountUsd: 0 },
				{ ...base, liqPrice: 0, collateralAmount: 2, collateralAmountUsd: 0 },
				{ ...base, liqPrice: 0, collateralAmount: 0, collateralAmountUsd: 30 }
			],
			1
		)

		expect(chart).toEqual({
			tokens: [
				{
					key: 'token',
					label: 'token',
					totalUsd: 30,
					breakdowns: {
						total: {
							bins: [0],
							series: [{ key: 'token', label: 'token', usd: [30], amount: [2], totalUsd: 30 }]
						},
						protocol: {
							bins: [0],
							series: [{ key: 'Protocol', label: 'Protocol', usd: [30], amount: [2], totalUsd: 30 }]
						},
						chain: {
							bins: [0],
							series: [{ key: 'Chain', label: 'Chain', usd: [30], amount: [2], totalUsd: 30 }]
						}
					}
				}
			]
		})
		expect(buildLiquidationsDistributionChart([])).toEqual({ tokens: [] })
		expect(
			buildLiquidationsDistributionChart([
				{ ...base, liqPrice: Number.NaN, collateralAmount: 1, collateralAmountUsd: 10 },
				{ ...base, liqPrice: -1, collateralAmount: 1, collateralAmountUsd: 10 },
				{ ...base, liqPrice: 0, collateralAmount: 0, collateralAmountUsd: 0 }
			])
		).toEqual({ tokens: [] })
	})

	it('keeps raw page totals when a position is excluded only from the chart', () => {
		const invalidForChart = {
			owner: 'chart-invalid',
			liqPrice: -1,
			collateral: 'ethereum:wsteth',
			collateralAmount: 5,
			collateralAmountUsd: 500
		}
		const response: RawAllLiquidationsResponse = {
			...allResponse,
			data: {
				...allResponse.data,
				'aave-v3': {
					...allResponse.data['aave-v3'],
					arbitrum: [...allResponse.data['aave-v3'].arbitrum, invalidForChart]
				}
			}
		}

		const overview = buildLiquidationsOverviewPageData(protocolsResponse, response, metadata)
		const token = buildTokenLiquidationsSectionData('wsteth', protocolsResponse, response, metadata)
		const protocol = buildLiquidationsProtocolPageData(
			'aave-v3',
			protocolsResponse.protocols,
			response.data['aave-v3'],
			response.timestamp,
			blockExplorers,
			metadata
		)
		const chain = buildLiquidationsChainPageData(
			'aave-v3',
			'arbitrum',
			protocolsResponse.protocols,
			response.data['aave-v3'],
			response.timestamp,
			blockExplorers,
			metadata
		)

		expect([overview.positionCount, token?.positionCount, protocol.positionCount, chain.positionCount]).toEqual([
			4, 3, 3, 2
		])
		expect([
			overview.totalCollateralUsd,
			token?.totalCollateralUsd,
			protocol.totalCollateralUsd,
			chain.totalCollateralUsd
		]).toEqual([6500, 4500, 3500, 1500])
		expect(overview.distributionChart.tokens[0].totalUsd).toBe(3000)
		expect(token?.distributionChart.tokens[0].key).toBe('WSTETH')
		expect(protocol.distributionChart.tokens.find((entry) => entry.key === 'ethereum:wsteth')?.totalUsd).toBe(1000)
		expect(chain.distributionChart.tokens[0].totalUsd).toBe(1000)
	})
})
