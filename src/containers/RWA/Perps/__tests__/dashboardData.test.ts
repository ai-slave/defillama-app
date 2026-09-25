import { describe, expect, test } from 'vitest'
import { CHART_COLORS } from '~/constants/colors'
import type { IRWAPerpsMarket } from '../api.types'
import {
	buildRWAPerpsTimeSeriesCharts,
	buildRWAPerpsTimeSeriesDatasetForRows,
	getRWAPerpsIncludedRows
} from '../dashboardData'
import type { IRWAPerpsOverviewPageData } from '../types'

const overviewMarket: IRWAPerpsMarket = {
	id: 'xyz:meta',
	timestamp: 1_775_011_512,
	contract: 'xyz:META',
	venue: 'xyz',
	venueType: 'DEX',
	openInterest: 100,
	openInterestChange24h: 25,
	volume24h: 50,
	volume24hChange24h: -10,
	price: 500,
	priceChange24h: 5,
	fundingRate: 0.00001,
	premium: 0.0002,
	cumulativeFunding: 10,
	referenceAsset: 'Meta',
	referenceAssetGroup: 'Equities',
	assetClass: ['Stock Perp'],
	parentPlatform: 'trade[XYZ]',
	pair: '',
	marginAsset: 'USDC',
	settlementAsset: 'USDC',
	category: ['RWA Perps'],
	issuer: 'XYZ',
	website: ['https://trade.xyz/'],
	link: null,
	oracleProvider: 'Pyth equity feed',
	description: 'Perpetual market',
	accessModel: 'Permissionless',
	rwaClassification: 'Programmable Finance',
	makerFeeRate: 0.0002,
	takerFeeRate: 0.0005,
	deployerFeeShare: 0.5,
	oraclePx: 501,
	midPx: 500.5,
	prevDayPx: 480,
	maxLeverage: 10,
	szDecimals: 2,
	fundingIntervalHours: 1,
	volume7d: 300,
	volume30d: 1000,
	volumeAllTime: 5000,
	estimatedProtocolFees24h: 1,
	estimatedProtocolFees7d: 3,
	estimatedProtocolFees30d: 10,
	estimatedProtocolFeesAllTime: 50,
	suspicious: false
}

const overviewData = {
	markets: [overviewMarket],
	initialChartDataset: { source: [], dimensions: ['timestamp'] },
	totals: {
		openInterest: 100,
		openInterestChange24h: 25,
		volume24h: 50,
		volume24hChange24h: -10,
		markets: 1,
		protocolFees24h: 1,
		cumulativeFunding: 10
	}
} satisfies IRWAPerpsOverviewPageData

const multiBaseAssetOverviewData = {
	...overviewData,
	markets: [
		overviewMarket,
		{
			...overviewMarket,
			id: 'xyz:nvda',
			contract: 'xyz:NVDA',
			referenceAsset: 'NVIDIA',
			openInterest: 80,
			openInterestChange24h: 25,
			volume24h: 40,
			volume24hChange24h: -10,
			estimatedProtocolFees24h: 2
		},
		{
			...overviewMarket,
			id: 'flx:gold',
			contract: 'flx:GOLD',
			venue: 'flx',
			referenceAsset: 'Gold',
			referenceAssetGroup: 'Commodities',
			assetClass: ['Commodity Perp'],
			openInterest: 50,
			openInterestChange24h: 25,
			volume24h: 20,
			volume24hChange24h: -10,
			estimatedProtocolFees24h: 3
		}
	],
	totals: {
		...overviewData.totals,
		openInterest: 230,
		volume24h: 110,
		markets: 3,
		protocolFees24h: 6
	}
} satisfies IRWAPerpsOverviewPageData

describe('getRWAPerpsIncludedRows', () => {
	const suspiciousMarket: IRWAPerpsMarket = {
		...overviewMarket,
		id: 'parcl:nyc',
		venue: 'Parcl',
		suspicious: true
	}
	const markets = [overviewMarket, suspiciousMarket]

	test('excludes suspicious markets from cross-venue charts', () => {
		expect(getRWAPerpsIncludedRows(markets, 'overview')).toEqual([overviewMarket])
		expect(getRWAPerpsIncludedRows(markets, 'assetGroup')).toEqual([overviewMarket])
	})

	test('keeps suspicious markets in venue totals and charts', () => {
		expect(getRWAPerpsIncludedRows(markets, 'venue')).toBe(markets)
	})
})

describe('RWA perps dashboard time-series data', () => {
	test('regroups fetched contract time-series data by the selected breakdown for Base Asset filters', () => {
		const dataset = buildRWAPerpsTimeSeriesDatasetForRows({
			dataset: {
				source: [
					{ timestamp: 1_774_396_800_000, 'flx:GOLD': 4 },
					{
						timestamp: 1_774_483_200_000,
						'xyz:META': 10,
						'xyz:NVDA': 20,
						'flx:GOLD': 5
					},
					{ timestamp: 1_774_526_400_000, 'flx:GOLD': 5.5 },
					{
						timestamp: 1_774_569_600_000,
						'xyz:META': 12,
						'xyz:NVDA': 22,
						'flx:GOLD': 6
					}
				],
				dimensions: ['timestamp', 'xyz:META', 'xyz:NVDA', 'flx:GOLD']
			},
			rows: multiBaseAssetOverviewData.markets.slice(0, 2),
			breakdown: 'assetGroup'
		})

		expect(dataset).toEqual({
			source: [
				{ timestamp: 1_774_483_200_000, Equities: 30 },
				{ timestamp: 1_774_569_600_000, Equities: 34 }
			],
			dimensions: ['timestamp', 'Equities']
		})
	})

	test('regroups fetched market-id time-series data by selected market ids', () => {
		const dataset = buildRWAPerpsTimeSeriesDatasetForRows({
			dataset: {
				source: [
					{
						timestamp: 1_774_483_200_000,
						'alpha:aapl': 10,
						'beta:aapl': 20,
						'fx:eurusd': 5
					},
					{
						timestamp: 1_774_569_600_000,
						'alpha:aapl': 12,
						'beta:aapl': 22,
						'fx:eurusd': 6
					}
				],
				dimensions: ['timestamp', 'alpha:aapl', 'beta:aapl', 'fx:eurusd']
			},
			rows: [
				{
					...overviewMarket,
					id: 'alpha:aapl',
					contract: 'AAPL',
					venue: 'Alpha',
					referenceAssetGroup: 'Equities'
				},
				{
					...overviewMarket,
					id: 'beta:aapl',
					contract: 'AAPL',
					venue: 'Beta',
					referenceAssetGroup: 'Equities'
				}
			],
			breakdown: 'venue',
			seriesKey: 'id'
		})

		expect(dataset).toEqual({
			source: [
				{ timestamp: 1_774_483_200_000, Alpha: 10, Beta: 20 },
				{ timestamp: 1_774_569_600_000, Alpha: 12, Beta: 22 }
			],
			dimensions: ['timestamp', 'Beta', 'Alpha']
		})
	})

	test('builds a grouped time-series series for total mode', () => {
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'openInterest',
				dimensions: ['timestamp', 'Total'],
				timeSeriesMode: 'grouped'
			})
		).toEqual([
			{
				name: 'Total',
				type: 'line',
				encode: { x: 'timestamp', y: 'Total' },
				color: CHART_COLORS[0]
			}
		])
	})

	test('adds a plain total overlay line for breakdown line charts', () => {
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'openInterest',
				dimensions: ['timestamp', 'Total', 'Meta', 'NVIDIA'],
				timeSeriesMode: 'breakdown'
			})
		).toEqual([
			{
				name: 'Meta',
				type: 'line',
				encode: { x: 'timestamp', y: 'Meta' },
				color: CHART_COLORS[1]
			},
			{
				name: 'NVIDIA',
				type: 'line',
				encode: { x: 'timestamp', y: 'NVIDIA' },
				color: CHART_COLORS[2]
			},
			{
				name: 'Total',
				type: 'line',
				encode: { x: 'timestamp', y: 'Total' },
				color: CHART_COLORS[0],
				hideAreaStyle: true,
				excludeFromTooltipTotal: true
			}
		])
	})

	test('does not add a total overlay line for breakdown bar charts', () => {
		expect(
			buildRWAPerpsTimeSeriesCharts({
				metric: 'volume24h',
				dimensions: ['timestamp', 'Total', 'Meta', 'NVIDIA'],
				timeSeriesMode: 'breakdown'
			})
		).toEqual([
			{
				name: 'Total',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'Total' },
				color: CHART_COLORS[0]
			},
			{
				name: 'Meta',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'Meta' },
				color: CHART_COLORS[1]
			},
			{
				name: 'NVIDIA',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'NVIDIA' },
				color: CHART_COLORS[2]
			}
		])
	})
})
