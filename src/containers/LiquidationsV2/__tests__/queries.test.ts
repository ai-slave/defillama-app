import { describe, expect, test } from 'vitest'
import type { BlockExplorersResponse } from '~/api/types'
import type {
	LiquidationPosition,
	RawAllLiquidationsResponse,
	RawLiquidationPosition,
	RawProtocolsResponse
} from '../api.types'
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
		evmChainId: 42_161,
		blockExplorers: [{ name: 'Arbiscan', url: 'https://arbiscan.io' }]
	},
	{
		displayName: 'Ethereum',
		llamaChainId: 'ethereum',
		evmChainId: 1,
		blockExplorers: [{ name: 'Etherscan', url: 'https://etherscan.io' }]
	}
]

const rawPosition = (
	owner: string,
	liqPrice: number,
	collateral: string,
	collateralId: string,
	collateralAmount: number,
	collateralAmountUsd: number
): RawLiquidationPosition => ({ owner, liqPrice, collateral, collateralId, collateralAmount, collateralAmountUsd })

const protocolsResponse: RawProtocolsResponse = { protocols: ['aave-v3', 'compound-v3'] }
const allResponse: RawAllLiquidationsResponse = {
	timestamp: 400,
	validThresholds: ['100k', '10k', 'all'],
	tokens: {
		arbitrum: { wstETH: { symbol: 'wstETH', decimals: 18, price: 100 } },
		ethereum: { ETH: { symbol: 'ETH', decimals: 18, price: 100 } },
		base: { WSTETH: { symbol: 'WSTETH', decimals: 18, price: 100 } }
	},
	data: {
		'aave-v3': {
			arbitrum: [rawPosition('0x1', 1, 'wstETH', '0xwsteth', 10, 1000)],
			ethereum: [rawPosition('0x2', 2, 'ETH', '0xeth', 20, 2000)]
		},
		'compound-v3': { base: [rawPosition('0x3', 3, 'WSTETH', '0xwsteth', 30, 3000)] }
	}
}

const chartPosition = (
	collateral: string,
	liqPrice: number,
	collateralAmount: number,
	collateralAmountUsd: number,
	protocolId: string,
	protocolName: string,
	chainId: string,
	chainName: string
): Pick<
	LiquidationPosition,
	| 'collateral'
	| 'liqPrice'
	| 'collateralAmount'
	| 'collateralAmountUsd'
	| 'protocolId'
	| 'protocolName'
	| 'chainId'
	| 'chainName'
> => ({
	collateral,
	liqPrice,
	collateralAmount,
	collateralAmountUsd,
	protocolId,
	protocolName,
	chainId,
	chainName
})

describe('LiquidationsV2 pure queries', () => {
	test('builds overview data and preserves the approved partial snapshot projection', () => {
		const data = buildLiquidationsOverviewPageData(protocolsResponse, allResponse, metadata)
		expect(data).toMatchObject({ protocolCount: 2, chainCount: 3, positionCount: 3, totalCollateralUsd: 6000 })

		const partial = buildLiquidationsOverviewPageData(
			protocolsResponse,
			{ ...allResponse, data: { 'aave-v3': allResponse.data['aave-v3'] } },
			metadata
		)
		expect(partial.protocolRows.find((row) => row.id === 'compound-v3')).toMatchObject({
			positionCount: 0,
			chainCount: 0,
			totalCollateralUsd: 0
		})
	})

	test('uses producer ids as canonical routes and accepts display aliases', () => {
		const lookup = createProtocolMetadataLookup(metadata.protocolMetadata)
		expect(resolveProtocolId('aave-v3', protocolsResponse.protocols, lookup)).toBe('aave-v3')
		expect(resolveProtocolId('Aave V3', protocolsResponse.protocols, lookup)).toBe('aave-v3')
		expect(resolveChainId('arbitrum', ['arbitrum'], metadata.chainMetadata)).toBe('arbitrum')
		expect(resolveChainId('arbitrum-one', ['arbitrum'], metadata.chainMetadata)).toBe('arbitrum')
		expect(resolveProtocolId('missing', protocolsResponse.protocols, lookup)).toBeNull()
		expect(resolveChainId('missing', ['arbitrum'], metadata.chainMetadata)).toBeNull()

		const protocolData = allResponse.data['aave-v3']!
		const protocol = buildLiquidationsProtocolPageData(
			'aave-v3',
			protocolsResponse.protocols,
			protocolData,
			allResponse.timestamp,
			blockExplorers,
			metadata
		)
		const chain = buildLiquidationsChainPageData(
			'aave-v3',
			'arbitrum',
			protocolsResponse.protocols,
			protocolData,
			allResponse.timestamp,
			blockExplorers,
			metadata
		)

		expect(protocol.protocolSlug).toBe('aave-v3')
		expect(protocol.chainLinks).toContainEqual({ label: 'Arbitrum One', to: '/liquidations/aave-v3/arbitrum' })
		expect(chain.chainSlug).toBe('arbitrum')
		expect(chain.positions[0]).toMatchObject({ owner: '0x1', collateral: 'wstETH', collateralId: '0xwsteth' })
		expect(protocol.ownerBlockExplorers.map((entry) => entry.llamaChainId)).toEqual(['arbitrum', 'ethereum'])
	})

	test('aggregates a token alias family in one snapshot while keeping exact visibility', () => {
		const response: RawAllLiquidationsResponse = {
			...allResponse,
			tokens: {
				...allResponse.tokens,
				arbitrum: {
					WBTC: { symbol: 'WBTC', decimals: 8, price: 100 },
					BTC: { symbol: 'BTC', decimals: 8, price: 100 }
				}
			},
			data: {
				'aave-v3': {
					arbitrum: [rawPosition('0x1', 1, 'WBTC', '0xwbtc', 1, 100), rawPosition('0x2', 2, 'BTC', 'btc', 2, 200)]
				}
			}
		}

		const data = buildTokenLiquidationsSectionData('WBTC', protocolsResponse, response, metadata)
		expect(data).toMatchObject({ tokenSymbol: 'WBTC', positionCount: 2, totalCollateralUsd: 300 })
		expect(data?.distributionChart.tokens.map((token) => token.key)).toEqual(['BTC', 'WBTC'])
		expect(hasTokenLiquidationsData('WBTC', protocolsResponse, response)).toBe(true)
		expect(hasTokenLiquidationsData('ETH', protocolsResponse, response)).toBe(false)

		const btcOnly: RawAllLiquidationsResponse = {
			...response,
			data: { 'aave-v3': { arbitrum: [rawPosition('0x2', 2, 'BTC', 'btc', 2, 200)] } }
		}
		expect(hasTokenLiquidationsData('BTC', protocolsResponse, btcOnly)).toBe(true)
		expect(hasTokenLiquidationsData('WBTC', protocolsResponse, btcOnly)).toBe(false)
	})

	test('requires the exact Token-page symbol before expanding its alias family', () => {
		const data = buildTokenLiquidationsSectionData('wstETH', protocolsResponse, allResponse, metadata)

		expect(data).toMatchObject({ tokenSymbol: 'wstETH', positionCount: 3, totalCollateralUsd: 6000 })
		expect(data?.distributionChart.tokens.map((token) => token.key)).toEqual(['WSTETH', 'ETH', 'wstETH'])
		expect(hasTokenLiquidationsData('wstETH', protocolsResponse, allResponse)).toBe(true)
		expect(hasTokenLiquidationsData('wsteth', protocolsResponse, allResponse)).toBe(false)
		expect(buildTokenLiquidationsSectionData('wsteth', protocolsResponse, allResponse, metadata)).toBeNull()
	})

	test('preserves alias-merge row order and maximum dimension counts', () => {
		const response: RawAllLiquidationsResponse = {
			...allResponse,
			tokens: {
				arbitrum: {
					WBTC: { symbol: 'WBTC', decimals: 8, price: 100 },
					BTC: { symbol: 'BTC', decimals: 8, price: 100 }
				},
				ethereum: { BTC: { symbol: 'BTC', decimals: 8, price: 100 } }
			},
			data: {
				'aave-v3': {
					arbitrum: [rawPosition('0x1', 1, 'WBTC', '0xwbtc', 1, 100)],
					ethereum: [rawPosition('0x2', 2, 'BTC', 'btc', 2, 200)]
				},
				'compound-v3': {
					arbitrum: [rawPosition('0x3', 3, 'BTC', 'btc', 3, 300)]
				}
			}
		}
		const data = buildTokenLiquidationsSectionData(
			'WBTC',
			{ protocols: ['compound-v3', 'aave-v3'] },
			response,
			metadata
		)

		expect(data?.protocolRows.map((row) => row.id)).toEqual(['aave-v3', 'compound-v3'])
		expect(data?.protocolRows.find((row) => row.id === 'aave-v3')?.chainCount).toBe(1)
		expect(data?.chainRows.find((row) => row.id === 'arbitrum')?.protocolCount).toBe(1)
	})

	test('preserves producer casing as distinct Liquidations-page identity', () => {
		const response: RawAllLiquidationsResponse = {
			...allResponse,
			data: {
				'aave-v3': {
					arbitrum: [rawPosition('0x1', 1, 'USDT', '0x1', 1, 100), rawPosition('0x2', 2, 'usdt', '0x2', 2, 200)]
				}
			}
		}
		const data = buildLiquidationsOverviewPageData(protocolsResponse, response, metadata)
		expect(data.positionCount).toBe(2)
		expect(data.totalCollateralUsd).toBe(300)
		expect(data.protocolRows.find((row) => row.id === 'aave-v3')?.collateralCount).toBe(2)
		expect(data.distributionChart.tokens.map((token) => token.key)).toEqual(['usdt', 'USDT'])
	})

	test('builds exact id-keyed chart series and keeps zero liquidation price', () => {
		const input = [
			chartPosition('TOKEN-A', 0, 1, 100, 'alpha', 'Alpha', 'chain-two', 'Chain Two'),
			chartPosition('TOKEN-A', 2, 2, 100, 'beta', 'Beta', 'chain-one', 'Chain One'),
			chartPosition('TOKEN-A', 1, 3, 50, 'alpha', 'Alpha', 'chain-one', 'Chain One')
		]
		const snapshot = structuredClone(input)
		const chart = buildLiquidationsDistributionChart(input, 2)

		expect(chart.tokens[0]).toEqual({
			key: 'TOKEN-A',
			label: 'TOKEN-A',
			totalUsd: 250,
			breakdowns: {
				total: {
					bins: [0, 1],
					series: [{ key: 'TOKEN-A', label: 'TOKEN-A', usd: [100, 150], amount: [1, 5], totalUsd: 250 }]
				},
				protocol: {
					bins: [0, 1],
					series: [
						{ key: 'alpha', label: 'Alpha', usd: [100, 50], amount: [1, 3], totalUsd: 150 },
						{ key: 'beta', label: 'Beta', usd: [0, 100], amount: [0, 2], totalUsd: 100 }
					]
				},
				chain: {
					bins: [0, 1],
					series: [
						{ key: 'chain-one', label: 'Chain One', usd: [0, 150], amount: [0, 5], totalUsd: 150 },
						{ key: 'chain-two', label: 'Chain Two', usd: [100, 0], amount: [1, 0], totalUsd: 100 }
					]
				}
			}
		})
		expect(input).toEqual(snapshot)
	})
})
