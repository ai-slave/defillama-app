import { describe, expect, test } from 'vitest'
import {
	buildDigitalAssetTreasuryRoutesMetadata,
	buildNarrativeCategoriesMetadata,
	buildOracleRoutesMetadata,
	buildStablecoinPeggedAssetSlugs
} from '../routeIndexes'

describe('metadata route indexes', () => {
	test('builds narrative category ids without slugging ids', () => {
		expect(
			buildNarrativeCategoriesMetadata([
				{ id: 'ai-agents', name: 'AI Agents', mcap: 1, volume1D: null, nbCoins: 1 },
				{ id: 'rwa', name: 'RWA', mcap: 1, volume1D: null, nbCoins: 1 }
			])
		).toEqual({
			ids: ['ai-agents', 'rwa'],
			nameById: {
				'ai-agents': 'AI Agents',
				rwa: 'RWA'
			}
		})
	})

	test('builds oracle route indexes from exact chain memberships in preferred chain order', () => {
		expect(
			buildOracleRoutesMetadata({
				oracles: {
					Chainlink: ['Aave'],
					'Pyth Network': ['Kamino']
				},
				chainsByOracle: {
					Chainlink: ['Ethereum', 'Stale Measurement'],
					'Pyth Network': ['Solana']
				},
				protocolsByOracleChain: {
					Chainlink: { Ethereum: ['Aave'], 'Arbitrum One': ['Aave'] },
					'Pyth Network': { Solana: ['Kamino'] }
				}
			})
		).toEqual({
			oracleNameBySlug: {
				chainlink: 'Chainlink',
				'pyth-network': 'Pyth Network'
			},
			chainNameBySlug: {
				ethereum: 'Ethereum',
				'arbitrum-one': 'Arbitrum One',
				solana: 'Solana'
			},
			chainSlugsByOracleSlug: {
				chainlink: ['ethereum', 'arbitrum-one'],
				'pyth-network': ['solana']
			}
		})
	})

	test('builds DAT asset and company slugs in API display order', () => {
		expect(
			buildDigitalAssetTreasuryRoutesMetadata({
				assetMetadata: {
					'Bitcoin Cash': {
						name: 'Bitcoin Cash',
						ticker: 'BCH',
						geckoId: 'bitcoin-cash',
						companies: 1,
						totalAmount: 1,
						totalUsdValue: 10,
						circSupplyPerc: 1
					},
					Ethereum: {
						name: 'Ethereum',
						ticker: 'ETH',
						geckoId: 'ethereum',
						companies: 1,
						totalAmount: 1,
						totalUsdValue: 100,
						circSupplyPerc: 1
					}
				},
				institutionMetadata: {
					1: {
						institutionId: 1,
						ticker: 'MSTR',
						name: 'Strategy',
						type: 'Public',
						price: 1,
						priceChange24h: null,
						volume24h: 1,
						mcapRealized: null,
						mcapRealistic: null,
						mcapMax: null,
						realized_mNAV: null,
						realistic_mNAV: null,
						max_mNAV: null,
						totalUsdValue: 1,
						totalCost: 1,
						holdings: {}
					},
					2: {
						institutionId: 2,
						ticker: 'BMNR',
						name: 'BitMine',
						type: 'Public',
						price: 1,
						priceChange24h: null,
						volume24h: 1,
						mcapRealized: null,
						mcapRealistic: null,
						mcapMax: null,
						realized_mNAV: null,
						realistic_mNAV: null,
						max_mNAV: null,
						totalUsdValue: 100,
						totalCost: 1,
						holdings: {}
					},
					3: {
						institutionId: 3,
						ticker: 'MARA',
						name: 'MARA',
						type: 'Public',
						price: 1,
						priceChange24h: null,
						volume24h: 1,
						mcapRealized: null,
						mcapRealistic: null,
						mcapMax: null,
						realized_mNAV: null,
						realistic_mNAV: null,
						max_mNAV: null,
						totalUsdValue: 50,
						totalCost: 1,
						holdings: {}
					}
				},
				institutions: [
					{ institutionId: 2, totalUsdValue: 100, totalCost: 1 },
					{ institutionId: 1, totalUsdValue: 1, totalCost: 1 }
				],
				assets: {},
				totalCompanies: 1,
				flows: {},
				mNAV: {}
			})
		).toEqual({
			assetSlugs: ['ethereum', 'bitcoin-cash'],
			companySlugs: ['BMNR', 'MSTR', 'MARA']
		})
	})

	test('dedupes DAT company routes by normalized ticker while preserving the first API value', () => {
		expect(
			buildDigitalAssetTreasuryRoutesMetadata({
				assetMetadata: {},
				institutionMetadata: {
					1: {
						institutionId: 1,
						ticker: 'MSTR',
						name: 'Strategy',
						type: 'Public',
						price: 1,
						priceChange24h: null,
						volume24h: 1,
						mcapRealized: null,
						mcapRealistic: null,
						mcapMax: null,
						realized_mNAV: null,
						realistic_mNAV: null,
						max_mNAV: null,
						totalUsdValue: 100,
						totalCost: 1,
						holdings: {}
					},
					2: {
						institutionId: 2,
						ticker: 'mstr',
						name: 'Strategy duplicate',
						type: 'Public',
						price: 1,
						priceChange24h: null,
						volume24h: 1,
						mcapRealized: null,
						mcapRealistic: null,
						mcapMax: null,
						realized_mNAV: null,
						realistic_mNAV: null,
						max_mNAV: null,
						totalUsdValue: 1,
						totalCost: 1,
						holdings: {}
					}
				},
				institutions: [
					{ institutionId: 1, totalUsdValue: 100, totalCost: 1 },
					{ institutionId: 2, totalUsdValue: 1, totalCost: 1 }
				],
				assets: {},
				totalCompanies: 2,
				flows: {},
				mNAV: {}
			})
		).toEqual({
			assetSlugs: [],
			companySlugs: ['MSTR']
		})
	})

	test('builds stablecoin pegged asset slugs from config keys', () => {
		expect(buildStablecoinPeggedAssetSlugs({ Tether: '1', 'Curve USD': '2' })).toEqual(['tether', 'curve-usd'])
	})
})
