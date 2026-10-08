import { describe, expect, test } from 'vitest'
import { getRwaCsvFileName } from '../csv'

describe('getRwaCsvFileName', () => {
	test('an overview names only its tree and the part', () => {
		expect(getRwaCsvFileName('overview', null, 'table')).toBe('rwa-table.csv')
		expect(getRwaCsvFileName('perpsOverview', null, 'chart')).toBe('rwa-perps-chart.csv')
	})

	test('a scope page names its kind and its slug', () => {
		expect(getRwaCsvFileName('venue', 'binance', 'key-metrics')).toBe('rwa-perps-venue-binance-key-metrics.csv')
		expect(getRwaCsvFileName('chain', 'ethereum', 'table')).toBe('rwa-chain-ethereum-table.csv')
		expect(getRwaCsvFileName('assetGroup', 'tokenized-gold', 'chart')).toBe('rwa-asset-group-tokenized-gold-chart.csv')
		expect(getRwaCsvFileName('perpsAssetGroup', 'precious-metals', 'table')).toBe(
			'rwa-perps-asset-group-precious-metals-table.csv'
		)
		expect(getRwaCsvFileName('perpsAsset', 'gold', 'table')).toBe('rwa-perps-asset-gold-table.csv')
		expect(getRwaCsvFileName('platform', 'ondo', 'table')).toBe('rwa-platform-ondo-table.csv')
		expect(getRwaCsvFileName('category', 'private-credit', 'table')).toBe('rwa-category-private-credit-table.csv')
		expect(getRwaCsvFileName('platform', 'ondo', 'compliance')).toBe('rwa-platform-ondo-compliance.csv')
	})

	test('a scope page without a slug falls back to its tree name', () => {
		expect(getRwaCsvFileName('venue', undefined, 'table')).toBe('rwa-perps-table.csv')
	})
})
