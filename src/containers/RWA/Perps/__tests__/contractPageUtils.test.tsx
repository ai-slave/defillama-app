import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { chartColor } from '~/constants/colors'
import type { IRWAPerpsMarketChartPoint } from '../api.types'
import { RWAPerpsContractSummaryMetrics } from '../Contract'
import {
	buildRWAPerpsContractChartSpec,
	buildRWAPerpsContractMetricSections,
	buildRWAPerpsContractInfoRows
} from '../contractPageUtils'
import type { IRWAPerpsContractData, IRWAPerpsContractFundingHistoryPoint } from '../types'

function defined<T>(value: T | undefined): T {
	if (value === undefined) throw new Error('Expected test value')
	return value
}

const baseContract: IRWAPerpsContractData = {
	contract: {
		contract: 'xyz:META',
		displayName: 'Meta',
		venue: 'xyz',
		baseAsset: 'Meta',
		baseAssetGroup: 'Equities',
		assetClass: 'Stock Perp',
		rwaClassification: 'Programmable Finance',
		accessModel: 'Permissionless',
		parentPlatform: 'trade[XYZ]',
		issuer: 'XYZ',
		website: 'https://trade.xyz/',
		link: null,
		oracleProvider: 'Pyth equity feed',
		description: null,
		categories: ['RWA Perps']
	},
	market: {
		id: 'xyz:meta',
		timestamp: 1_775_011_512,
		contract: 'xyz:META',
		venue: 'xyz',
		venueType: 'DEX',
		openInterest: 100,
		openInterestChange24h: null,
		volume24h: 50,
		volume24hChange24h: null,
		price: 500,
		priceChange24h: 5,
		fundingRate: 0.00001,
		premium: 0.0002,
		cumulativeFunding: 10,
		referenceAsset: 'Meta',
		referenceAssetGroup: 'Equities',
		assetClass: ['Stock Perp'],
		parentPlatform: 'trade[XYZ]',
		pair: 'META-USD',
		marginAsset: 'USDC',
		settlementAsset: 'USDC',
		category: ['RWA Perps'],
		issuer: 'XYZ',
		website: ['https://trade.xyz/'],
		link: null,
		oracleProvider: 'Pyth equity feed',
		description: null,
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
	},
	marketChart: null,
	fundingHistory: null
}

const chartPoints: [IRWAPerpsMarketChartPoint, IRWAPerpsMarketChartPoint, IRWAPerpsMarketChartPoint] = [
	{
		timestamp: Date.UTC(2026, 2, 1),
		openInterest: 100,
		volume24h: 10,
		price: 10,
		priceChange24h: 1,
		fundingRate: 0.01,
		premium: 0.02,
		cumulativeFunding: 1
	},
	{
		timestamp: Date.UTC(2026, 2, 15),
		openInterest: 120,
		volume24h: 20,
		price: 12,
		priceChange24h: 2,
		fundingRate: 0.02,
		premium: 0.03,
		cumulativeFunding: 2
	},
	{
		timestamp: Date.UTC(2026, 3, 1),
		openInterest: 140,
		volume24h: 30,
		price: 14,
		priceChange24h: 3,
		fundingRate: 0.03,
		premium: 0.04,
		cumulativeFunding: 3
	}
]

const fundingHistoryPoints: [IRWAPerpsContractFundingHistoryPoint, IRWAPerpsContractFundingHistoryPoint] = [
	{
		timestamp: Date.UTC(2026, 2, 1),
		fundingRate: 0.001,
		premium: 0.01,
		openInterest: 100,
		fundingPayment: 1
	},
	{
		timestamp: Date.UTC(2026, 2, 2),
		fundingRate: 0.002,
		premium: 0.02,
		openInterest: 110,
		fundingPayment: 2
	}
]

describe('RWAPerpsContractSummaryMetrics', () => {
	test('renders the price with its inline 24h change', () => {
		const html = renderToStaticMarkup(<RWAPerpsContractSummaryMetrics contract={baseContract} />)
		expect(html).toContain('+5.00%')
	})
})

describe('buildRWAPerpsContractInfoRows', () => {
	test('omits duplicate reference assets and empty website rows', () => {
		const rows = buildRWAPerpsContractInfoRows({
			...baseContract,
			contract: {
				...baseContract.contract,
				baseAsset: 'meta',
				website: null
			}
		})

		expect(rows.some((row) => row.label === 'Base Asset')).toBe(false)
		expect(rows.some((row) => row.label === 'Website')).toBe(false)
	})

	test('includes the reference asset when it differs from the contract symbol suffix', () => {
		const rows = buildRWAPerpsContractInfoRows({
			...baseContract,
			contract: {
				...baseContract.contract,
				baseAsset: 'Meta Platforms'
			}
		})
		expect(rows.find((row) => row.label === 'Base Asset')).toEqual({
			label: 'Base Asset',
			tooltip: 'Reference asset, fund, index, or benchmark the perpetual contract tracks.',
			value: 'Meta Platforms'
		})
	})
})

describe('buildRWAPerpsContractMetricSections', () => {
	test('shows unavailable max leverage as "-"', () => {
		const sections = buildRWAPerpsContractMetricSections({
			...baseContract,
			market: {
				...baseContract.market,
				maxLeverage: null
			}
		})

		expect(sections.tradingParameters.value).toBe('-')
		expect(sections.tradingParameters.children).toEqual(
			expect.arrayContaining([expect.objectContaining({ label: 'Max Leverage', value: '-' })])
		)
	})
})

describe('buildRWAPerpsContractChartSpec', () => {
	test('uses summed buckets for volume and last-value buckets for line metrics', () => {
		const spec = buildRWAPerpsContractChartSpec({
			marketPoints: chartPoints,
			fundingHistory: null,
			groupBy: 'monthly',
			enabledMetrics: ['openInterest', 'volume24h', 'price']
		})

		expect(spec.charts.map((chart) => [chart.name, chart.type, chart.color])).toEqual([
			['Open Interest', 'line', chartColor(0)],
			['Volume 24h', 'bar', chartColor(1)],
			['Price', 'line', chartColor(2)]
		])

		expect(spec.charts.map((chart) => chart.data)).toEqual([
			[
				[Date.UTC(2026, 2, 1), 120],
				[Date.UTC(2026, 3, 1), 140]
			],
			[
				[Date.UTC(2026, 2, 1), 30],
				[Date.UTC(2026, 3, 1), 30]
			],
			[
				[Date.UTC(2026, 2, 1), 12],
				[Date.UTC(2026, 3, 1), 14]
			]
		])
		expect(spec.dataset.source).toEqual([])
	})

	test('overwrites exact daily duplicates but sums every point in coarser volume buckets', () => {
		const duplicateTimestampPoints = [
			chartPoints[0],
			{
				...chartPoints[0],
				openInterest: 110,
				volume24h: 15,
				price: 11
			},
			chartPoints[1]
		]

		const daily = buildRWAPerpsContractChartSpec({
			marketPoints: duplicateTimestampPoints,
			fundingHistory: null,
			groupBy: 'daily',
			enabledMetrics: ['openInterest', 'volume24h', 'price']
		})
		const monthly = buildRWAPerpsContractChartSpec({
			marketPoints: duplicateTimestampPoints,
			fundingHistory: null,
			groupBy: 'monthly',
			enabledMetrics: ['openInterest', 'volume24h', 'price']
		})

		expect(daily.charts.map((chart) => chart.data)).toEqual([
			[
				[Date.UTC(2026, 2, 1), 110],
				[Date.UTC(2026, 2, 15), 120]
			],
			[
				[Date.UTC(2026, 2, 1), 15],
				[Date.UTC(2026, 2, 15), 20]
			],
			[
				[Date.UTC(2026, 2, 1), 11],
				[Date.UTC(2026, 2, 15), 12]
			]
		])
		expect(monthly.charts.map((chart) => chart.data)).toEqual([
			[[Date.UTC(2026, 2, 1), 120]],
			[[Date.UTC(2026, 2, 1), 45]],
			[[Date.UTC(2026, 2, 1), 12]]
		])
	})

	test('keeps grouped volume as a bar series without offering cumulative accumulation', () => {
		const spec = buildRWAPerpsContractChartSpec({
			marketPoints: chartPoints,
			fundingHistory: null,
			groupBy: 'monthly',
			enabledMetrics: ['volume24h', 'price', 'fundingRate']
		})

		expect(spec.charts.map((chart) => [chart.name, chart.type])).toEqual([
			['Volume 24h', 'bar'],
			['Price', 'line'],
			['Funding Rate', 'line']
		])

		expect(spec.charts.map((chart) => chart.data)).toEqual([
			[
				[Date.UTC(2026, 2, 1), 30],
				[Date.UTC(2026, 3, 1), 30]
			],
			[
				[Date.UTC(2026, 2, 1), 12],
				[Date.UTC(2026, 3, 1), 14]
			],
			[
				[Date.UTC(2026, 2, 1), 2],
				[Date.UTC(2026, 3, 1), 3]
			]
		])
	})

	test('puts each metric on its axis with its unit, in selection order', () => {
		const spec = buildRWAPerpsContractChartSpec({
			marketPoints: chartPoints,
			fundingHistory: fundingHistoryPoints,
			groupBy: 'monthly',
			enabledMetrics: ['premium', 'volume24h', 'openInterest', 'price', 'fundingRate']
		})

		expect(spec.charts.map(({ name, yAxisIndex, valueSymbol }) => [name, yAxisIndex, valueSymbol])).toEqual([
			['Premium', 2, '%'],
			['Volume 24h', undefined, '$'],
			['Open Interest', undefined, '$'],
			['Price', 1, '$'],
			['Funding Rate', 2, '%']
		])
		expect(spec.dataset.dimensions).toEqual([
			'timestamp',
			'Premium',
			'Volume 24h',
			'Open Interest',
			'Price',
			'Funding Rate'
		])
	})

	test('keeps market and funding lines on their independent timestamp calendars', () => {
		const spec = buildRWAPerpsContractChartSpec({
			marketPoints: [chartPoints[0], chartPoints[2]],
			fundingHistory: [fundingHistoryPoints[0]],
			groupBy: 'daily',
			enabledMetrics: ['openInterest', 'fundingRate']
		})

		expect(spec.charts.map((chart) => chart.data)).toEqual([
			[
				[Date.UTC(2026, 2, 1), 100],
				[Date.UTC(2026, 3, 1), 140]
			],
			[[Date.UTC(2026, 2, 1), 0.1]]
		])
	})

	test('falls back to market funding fields only when funding history is empty', () => {
		const fallbackSpec = buildRWAPerpsContractChartSpec({
			marketPoints: [chartPoints[0]],
			fundingHistory: [],
			groupBy: 'daily',
			enabledMetrics: ['fundingRate', 'premium']
		})
		const historySpec = buildRWAPerpsContractChartSpec({
			marketPoints: chartPoints,
			fundingHistory: fundingHistoryPoints,
			groupBy: 'daily',
			enabledMetrics: ['fundingRate', 'premium']
		})

		expect(fallbackSpec.charts.map((chart) => chart.data)).toEqual([
			[[Date.UTC(2026, 2, 1), 1]],
			[[Date.UTC(2026, 2, 1), 2]]
		])
		expect(historySpec.charts.map((chart) => chart.data)).toEqual([
			[
				[Date.UTC(2026, 2, 1), 0.1],
				[Date.UTC(2026, 2, 2), 0.2]
			],
			[
				[Date.UTC(2026, 2, 1), 1],
				[Date.UTC(2026, 2, 2), 2]
			]
		])
	})

	test('omits metrics whose selected source is empty and keeps rows sparse', () => {
		const spec = buildRWAPerpsContractChartSpec({
			marketPoints: null,
			fundingHistory: fundingHistoryPoints,
			groupBy: 'daily',
			enabledMetrics: ['openInterest', 'price', 'fundingRate']
		})

		expect(spec.charts.map((chart) => chart.name)).toEqual(['Funding Rate'])
		expect(spec.dataset.dimensions).toEqual(['timestamp', 'Funding Rate'])
		expect(defined(spec.charts[0]).data).toEqual([
			[Date.UTC(2026, 2, 1), 0.1],
			[Date.UTC(2026, 2, 2), 0.2]
		])
	})

	test('reads the last funding value of each monthly bucket', () => {
		const spec = buildRWAPerpsContractChartSpec({
			marketPoints: chartPoints,
			fundingHistory: fundingHistoryPoints,
			groupBy: 'monthly',
			enabledMetrics: ['fundingRate']
		})

		expect(defined(spec.charts[0]).data).toEqual([[Date.UTC(2026, 2, 1), 0.2]])
	})
})
