import { describe, expect, test } from 'vitest'
import { createDatasetTableConfig } from '../datasetTableConfig'
import { migrateDashboardItemConfig } from '../migrate'

describe('dataset table runtime config', () => {
	test('drops retired NFT volume columns from saved chain tables and keeps other selections', () => {
		const config = createDatasetTableConfig({
			id: 'chains',
			datasetType: 'chains',
			columnOrder: ['name', 'nftVolume', 'tvl', 'nftVolume_share', 'totalVolume24h'],
			columnVisibility: { name: true, nftVolume: true, tvl: false, nftVolume_share: true, totalVolume24h: true }
		})
		expect(config.columnOrder).toEqual(['name', 'tvl', 'totalVolume24h'])
		expect(config.columnVisibility).toEqual({ name: true, tvl: false, totalVolume24h: true })
	})

	test('canonicalizes duplicate chains and the All selection before source planning', () => {
		expect(
			createDatasetTableConfig({
				id: 'yields',
				datasetType: 'yields',
				chains: [' Ethereum ', 'ethereum', 'Base']
			}).chains
		).toEqual(['Ethereum', 'Base'])
		expect(
			createDatasetTableConfig({
				id: 'yields-all',
				datasetType: 'yields',
				chains: ['Ethereum', 'All']
			}).chains
		).toEqual([])
	})

	test('migrates historical dimension aliases before deduplicating selected chains', () => {
		expect(
			createDatasetTableConfig({
				id: 'legacy-chains',
				datasetType: 'yields',
				chains: ['optimism', 'OP Mainnet', 'xdai', 'Gnosis', 'era', 'ZKsync Era', 'hyperliquid']
			}).chains
		).toEqual(['OP Mainnet', 'Gnosis', 'ZKsync Era', 'Hyperliquid L1'])
	})

	test('normalizes CEX Top N and token symbol limits at the config boundary', () => {
		const marketShare = createDatasetTableConfig({
			id: 'cex',
			datasetType: 'cex-analytics',
			cexAnalyticsView: 'market-share',
			cexAnalyticsMetric: 'spot',
			cexAnalyticsTopN: 99.8
		})
		const tokenUsage = createDatasetTableConfig({
			id: 'tokens',
			datasetType: 'token-usage',
			tokenSymbols: [' usdc ', 'USDC', 'usdt', 'dai', 'frax', 'lusd'],
			includeCex: false
		})

		expect(marketShare.cexAnalyticsTopN).toBe(12)
		expect(tokenUsage.tokenSymbols).toEqual(['USDC', 'USDT', 'DAI', 'FRAX'])
	})

	test('re-sanitizes already-current runtime configs on every dashboard read', () => {
		const current = createDatasetTableConfig({
			id: 'yields',
			datasetType: 'yields',
			chains: ['Base', 'base'],
			columnOrder: ['pool', 'removed-column'],
			columnVisibility: { pool: true, 'removed-column': false }
		})

		expect(migrateDashboardItemConfig(current)).toEqual({
			id: 'yields',
			kind: 'dataset-table',
			datasetType: 'yields',
			chains: ['Base'],
			columnOrder: ['pool'],
			columnVisibility: { pool: true }
		})
	})
})
