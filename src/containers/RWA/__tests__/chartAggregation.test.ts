import { describe, expect, test } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import type { IRWAAssetsOverview } from '../api.types'
import {
	aggregateRwaMetricData,
	appendRwaChartDatasetTotal,
	buildRwaCanonicalMetricDataset,
	getRwaChartSeriesColorSlots,
	getRwaReservedSeriesColorSlot,
	mergeRwaChartDatasets,
	sortRwaChartSeriesLabels
} from '../chartAggregation'

describe('buildRwaCanonicalMetricDataset', () => {
	test('writes the final metric total directly while preserving sparse, zero, and negative series values', () => {
		expect(
			buildRwaCanonicalMetricDataset(
				{
					dimensions: ['timestamp', 'Alpha', 'Beta'],
					source: [
						{ timestamp: 1, Alpha: 0, Beta: -4 },
						{ timestamp: 2, Alpha: 5 }
					]
				},
				'activeMcap',
				false
			)
		).toEqual({
			dimensions: ['timestamp', 'Total Active Mcap', 'Alpha', 'Beta'],
			source: [
				[1, -4, 0, -4],
				[2, 5, 5, null]
			]
		})
	})

	test('produces a JSON-safe server-prop dataset for sparse aggregate series', () => {
		const result = buildRwaCanonicalMetricDataset(
			{
				dimensions: ['timestamp', 'Alpha', 'Beta'],
				source: [{ timestamp: 1, Alpha: 5 }]
			},
			'activeMcap',
			false
		)

		expect(JSON.parse(JSON.stringify(result))).toEqual(result)
	})
})

function createSpotAsset(
	overrides: Partial<Extract<IRWAAssetsOverview['assets'][number], { kind: 'spot' }>> = {}
): Extract<IRWAAssetsOverview['assets'][number], { kind: 'spot' }> {
	return {
		id: '1',
		kind: 'spot',
		detailHref: '/rwa/asset/ondo%2Fusdy',
		canonicalMarketId: 'ondo/usdy',
		ticker: 'AAA',
		assetName: 'Alpha',
		primaryChain: null,
		chain: null,
		price: null,
		openInterest: null,
		volume24h: null,
		volume30d: null,
		assetGroup: null,
		parentPlatform: null,
		category: null,
		assetClass: null,
		accessModel: 'Unknown',
		type: null,
		rwaClassification: null,
		issuer: null,
		redeemable: null,
		attestations: null,
		cexListed: null,
		kycForMintRedeem: null,
		kycAllowlistedWhitelistedToTransferHold: null,
		transferable: null,
		selfCustody: null,
		stablecoin: false,
		governance: false,
		trueRWA: false,
		suspicious: false,
		suspiciousReason: null,
		onChainMcap: null,
		activeMcap: null,
		defiActiveTvl: { total: 0, breakdown: [] },
		defiActiveTvlByChain: { total: 0, breakdown: [] },
		...overrides
	}
}

function createPerpsAsset(
	overrides: Partial<Extract<IRWAAssetsOverview['assets'][number], { kind: 'perps' }>> = {}
): Extract<IRWAAssetsOverview['assets'][number], { kind: 'perps' }> {
	return {
		id: 'perps-1',
		kind: 'perps',
		priceChange24h: null,
		venueType: 'DEX',
		detailHref: '/rwa/perps/contract/xyz%3Aalpha',
		contract: 'xyz:alpha',
		ticker: 'xyz:alpha',
		assetName: 'Alpha Perp',
		primaryChain: null,
		chain: null,
		price: 1,
		openInterest: 1,
		volume24h: 2,
		volume30d: 3,
		assetGroup: null,
		parentPlatform: null,
		category: null,
		assetClass: null,
		accessModel: null,
		type: 'Perp',
		rwaClassification: null,
		issuer: null,
		redeemable: null,
		attestations: null,
		cexListed: null,
		kycForMintRedeem: null,
		kycAllowlistedWhitelistedToTransferHold: null,
		transferable: null,
		selfCustody: null,
		stablecoin: null,
		governance: null,
		trueRWA: false,
		suspicious: false,
		suspiciousReason: null,
		onChainMcap: null,
		activeMcap: null,
		defiActiveTvl: null,
		...overrides
	}
}

const assets: IRWAAssetsOverview['assets'] = [
	createSpotAsset({ id: '1', canonicalMarketId: 'ondo/usdy', parentPlatform: 'Centrifuge' }),
	createSpotAsset({
		id: '2',
		canonicalMarketId: 'superstate/ustb',
		ticker: 'BBB',
		assetName: 'Beta',
		parentPlatform: 'Maple'
	}),
	createSpotAsset({
		id: '3',
		canonicalMarketId: 'blackrock/buidl',
		ticker: 'CCC',
		assetName: 'Gamma'
	})
]

describe('aggregateRwaMetricData', () => {
	test('aggregates all asset series into a single Total series when total mode is selected', () => {
		expect(
			aggregateRwaMetricData(
				assets,
				[
					{ timestamp: 1, 'ondo/usdy': 100, 'superstate/ustb': 90, 'blackrock/buidl': 50 },
					{ timestamp: 2, 'ondo/usdy': 120, 'superstate/ustb': 80, 'blackrock/buidl': 40 }
				],
				'total'
			)
		).toEqual({
			source: [
				{ timestamp: 1, Total: 240 },
				{ timestamp: 2, Total: 240 }
			],
			dimensions: ['timestamp', 'Total']
		})
	})

	test('aggregates platform series for scalar and missing parentPlatform values', () => {
		expect(
			aggregateRwaMetricData(
				assets,
				[
					{ timestamp: 1, 'ondo/usdy': 100, 'superstate/ustb': 90, 'blackrock/buidl': 50 },
					{ timestamp: 2, 'ondo/usdy': 120, 'superstate/ustb': 80, 'blackrock/buidl': 40 }
				],
				'platform'
			)
		).toEqual({
			source: [
				{ timestamp: 1, Centrifuge: 100, Maple: 90, Unknown: 50 },
				{ timestamp: 2, Centrifuge: 120, Maple: 80, Unknown: 40 }
			],
			dimensions: ['timestamp', 'Centrifuge', 'Maple', 'Unknown']
		})
	})

	test('preserves an explicitly measured zero in an asset series', () => {
		expect(aggregateRwaMetricData(assets, [{ timestamp: 1, 'ondo/usdy': 0 }], 'assetName')).toEqual({
			source: [{ timestamp: 1, Alpha: 0 }],
			dimensions: ['timestamp', 'Alpha']
		})
	})

	test('buckets missing assetGroup values into Unknown instead of dropping them', () => {
		expect(
			aggregateRwaMetricData(
				[
					createSpotAsset({
						id: '1',
						canonicalMarketId: 'circle/usdc',
						assetGroup: 'Stablecoins',
						parentPlatform: 'Centrifuge'
					}),
					createSpotAsset({
						id: '2',
						canonicalMarketId: 'unknown/asset',
						ticker: 'BBB',
						assetName: 'Beta',
						parentPlatform: 'Maple'
					}),
					createPerpsAsset({
						id: 'perps-2',
						contract: 'unknown/asset',
						assetGroup: 'Stablecoins'
					})
				],
				[{ timestamp: 1, 'circle/usdc': 100, 'unknown/asset': 50 }],
				'assetGroup'
			)
		).toEqual({
			source: [{ timestamp: 1, Stablecoins: 100, Unknown: 50 }],
			dimensions: ['timestamp', 'Stablecoins', 'Unknown']
		})
	})
})

describe('appendRwaChartDatasetTotal', () => {
	test('adds a Total column and promotes it to the first visible series dimension', () => {
		expect(
			appendRwaChartDatasetTotal({
				source: [
					{ timestamp: 1, Treasuries: 100, Credit: 40 },
					{ timestamp: 2, Treasuries: 90, Credit: 60 }
				],
				dimensions: ['timestamp', 'Treasuries', 'Credit']
			})
		).toEqual({
			source: [
				{ timestamp: 1, Treasuries: 100, Credit: 40, Total: 140 },
				{ timestamp: 2, Treasuries: 90, Credit: 60, Total: 150 }
			],
			dimensions: ['timestamp', 'Total', 'Treasuries', 'Credit']
		})
	})
})

describe('mergeRwaChartDatasets', () => {
	test('merges a spot chart dataset with the RWA Perps OI overlay line', () => {
		expect(
			mergeRwaChartDatasets(
				{
					source: [{ timestamp: 1, 'Total Active Mcap': 100, Treasuries: 100 }],
					dimensions: ['timestamp', 'Total Active Mcap', 'Treasuries']
				},
				{
					source: [{ timestamp: 1, 'RWA Perps OI': 25 }],
					dimensions: ['timestamp', 'RWA Perps OI']
				}
			)
		).toEqual({
			source: [{ timestamp: 1, 'Total Active Mcap': 100, Treasuries: 100, 'RWA Perps OI': 25 }],
			dimensions: ['timestamp', 'Total Active Mcap', 'Treasuries', 'RWA Perps OI']
		})
	})
})

describe('RWA chart series color reservation', () => {
	test('orders Total first and RWA Perps OI second', () => {
		expect(sortRwaChartSeriesLabels(['Treasuries', 'RWA Perps OI', 'Total Active Mcap', 'Credit'])).toEqual([
			'Total Active Mcap',
			'RWA Perps OI',
			'Treasuries',
			'Credit'
		])
	})

	test('keeps CHART_COLORS[0] and CHART_COLORS[1] reserved for Total and RWA Perps OI', () => {
		expect(CHART_COLORS[getRwaReservedSeriesColorSlot('Total Active Mcap') ?? -1]).toBe(CHART_COLORS[0])
		expect(CHART_COLORS[getRwaReservedSeriesColorSlot('RWA Perps OI') ?? -1]).toBe(CHART_COLORS[1])
		expect(getRwaReservedSeriesColorSlot('Treasuries')).toBeNull()
	})

	test('starts non-reserved series at CHART_COLORS[2] even when only RWA Perps OI is present', () => {
		expect(getRwaChartSeriesColorSlots(['Treasuries', 'RWA Perps OI'])).toEqual({
			'RWA Perps OI': 1,
			Treasuries: 2
		})
	})
})
