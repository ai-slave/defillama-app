import { describe, expect, test } from 'vitest'
import type { ChartTimeGroupingWithCumulative } from '~/components/ECharts/MultiSeriesChart/types'
import {
	buildChainChartData,
	buildDenominationPriceHistory,
	type ChainChartSources,
	getChainChartGeckoIds
} from '../chainChartData'
import type { ChainChartLabels } from '../constants'

const noSources: ChainChartSources = {
	denominationPriceHistory: null,
	tokenPriceHistory: null,
	chainFees: null,
	chainRevenue: null,
	holdersRevenue: null,
	dexVolume: null,
	perpsVolume: null,
	appFees: null,
	appRevenue: null,
	inflows: null,
	stablecoins: null,
	activeAddresses: null,
	newAddresses: null,
	transactions: null,
	bridgedTvl: null,
	raises: null,
	incentives: null
}

function build({
	toggledCharts,
	denomination = 'USD',
	chainGeckoId = null,
	gasTokenGeckoId = chainGeckoId,
	tvlChart = [],
	groupBy = 'daily',
	loadingCharts = [],
	sources = {}
}: {
	toggledCharts: Array<ChainChartLabels>
	denomination?: string
	chainGeckoId?: string | null
	gasTokenGeckoId?: string | null
	tvlChart?: Array<[number, number]>
	groupBy?: ChartTimeGroupingWithCumulative
	loadingCharts?: Array<string>
	sources?: Partial<ChainChartSources>
}) {
	return buildChainChartData({
		denomination,
		...getChainChartGeckoIds({ denomination, gasTokenGeckoId, chainGeckoId, toggledCharts: new Set(toggledCharts) }),
		toggledCharts,
		groupBy,
		finalTvlChart: tvlChart,
		isGovTokensEnabled: false,
		loadingCharts,
		sources: { ...noSources, ...sources }
	})
}

const timestamp = Date.UTC(2024, 0, 1)
const usableEthHistory = {
	conversionPrices: { [timestamp]: 2000 },
	canConvert: true,
	priceChart: [[timestamp, 2000]] as Array<[number, number]>,
	mcaps: undefined,
	volumes: undefined
}

describe('chain chart data', () => {
	test('uses the chain-native burn series for holders revenue instead of chain revenue', () => {
		expect(
			build({
				toggledCharts: ['Holders Revenue'],
				sources: { chainRevenue: [[timestamp / 1e3, 900]], holdersRevenue: [[timestamp / 1e3, 250]] }
			}).finalCharts
		).toEqual({ 'Holders Revenue': [[timestamp, 250]] })
	})
	test('reports loading charts without building partial series', () => {
		expect(
			build({ toggledCharts: ['TVL', 'Chain Fees'], loadingCharts: ['Chain Fees', 'Token Price'], denomination: 'ETH' })
		).toEqual({ finalCharts: {}, valueSymbol: 'ETH', loadingCharts: ['Chain Fees', 'Token Price'], failedMetrics: [] })
	})

	test('averages grouped active addresses, leaves them out of cumulative, and keeps daily values', () => {
		// Mon Sep 14, 2026 in seconds; Sep 15 has no observation and Sep 16 is a real zero.
		const day = (offset: number) => Date.UTC(2026, 8, 14 + offset) / 1e3
		const activeAddresses: Array<[number, number]> = [
			[day(0), 90],
			[day(2), 0],
			[day(3), 30],
			[day(7), 50]
		]
		const byGroup = (groupBy: ChartTimeGroupingWithCumulative) =>
			build({ toggledCharts: ['Active Addresses'], groupBy, sources: { activeAddresses } })

		expect(byGroup('weekly').finalCharts['Active Addresses']).toEqual([
			[Date.UTC(2026, 8, 20), 40],
			[Date.UTC(2026, 8, 27), 50]
		])
		expect(byGroup('cumulative').finalCharts['Active Addresses']).toBeUndefined()
		expect(byGroup('daily').finalCharts['Active Addresses']).toEqual([
			[day(0) * 1e3, 90],
			[day(2) * 1e3, 0],
			[day(3) * 1e3, 30],
			[day(7) * 1e3, 50]
		])
	})

	test('uses the chain fee series directly and reports toggled charts without data as failed', () => {
		const result = build({
			toggledCharts: ['Chain Fees', 'DEXs Volume'],
			sources: { chainFees: [[timestamp / 1e3, 100]] }
		})

		expect(result.finalCharts).toEqual({ 'Chain Fees': [[timestamp, 100]] })
		expect(result.failedMetrics).toEqual(['DEXs Volume'])
	})

	test('keeps USD values and symbols when a requested denomination has no gas token id', () => {
		const result = build({
			toggledCharts: ['TVL', 'Token Price'],
			denomination: 'ETH',
			tvlChart: [[timestamp, 2000]],
			sources: { denominationPriceHistory: usableEthHistory }
		})

		expect(result.finalCharts.TVL).toEqual([[timestamp, 2000]])
		expect(result.valueSymbol).toBe('$')
		expect(result.failedMetrics).toEqual([])
	})

	test.each([
		['the denomination price query failed', null],
		[
			'the denomination price history is empty',
			{ conversionPrices: {}, canConvert: false, priceChart: [], mcaps: undefined, volumes: undefined }
		]
	])('keeps USD values and symbols when %s', (_, denominationPriceHistory) => {
		const result = build({
			toggledCharts: ['TVL'],
			denomination: 'ETH',
			chainGeckoId: 'ethereum',
			tvlChart: [[timestamp, 2000]],
			sources: { denominationPriceHistory }
		})

		expect(result.finalCharts.TVL).toEqual([[timestamp, 2000]])
		expect(result.valueSymbol).toBe('$')
	})

	test('keeps an all-zero token price chart in USD without enabling denomination conversion', () => {
		const zeroPriceHistory = buildDenominationPriceHistory({ prices: [[timestamp, 0]] })
		const result = build({
			toggledCharts: ['TVL', 'Token Price'],
			denomination: 'ETH',
			chainGeckoId: 'ethereum',
			tvlChart: [[timestamp, 2000]],
			sources: { denominationPriceHistory: zeroPriceHistory, tokenPriceHistory: zeroPriceHistory }
		})

		expect(result.finalCharts).toEqual({ TVL: [[timestamp, 2000]], 'Token Price': [[timestamp, 0]] })
		expect(result.valueSymbol).toBe('$')
	})

	test('converts denomination-aware values without converting intrinsically USD series', () => {
		const result = build({
			toggledCharts: ['TVL', 'Token Price', 'Token Mcap', 'Token Volume', 'Raises'],
			denomination: 'ETH',
			chainGeckoId: 'ethereum',
			tvlChart: [[timestamp, 2000]],
			sources: {
				denominationPriceHistory: usableEthHistory,
				tokenPriceHistory: { ...usableEthHistory, mcaps: [[timestamp, 3000]], volumes: [[timestamp, 4000]] },
				raises: [[timestamp, 5000]]
			}
		})

		expect(result.valueSymbol).toBe('ETH')
		expect(result.finalCharts).toEqual({
			TVL: [[timestamp, 1]],
			'Token Price': [[timestamp, 2000]],
			'Token Mcap': [[timestamp, 3000]],
			'Token Volume': [[timestamp, 4000]],
			Raises: [[timestamp, 5000]]
		})
	})

	test('keeps zero price observations while using only positive dates for conversion', () => {
		const positiveTimestamp = Date.UTC(2024, 0, 2)
		const priceHistory = buildDenominationPriceHistory({
			prices: [
				[timestamp, 0],
				[positiveTimestamp, 2000]
			]
		})
		const result = build({
			toggledCharts: ['TVL', 'Token Price'],
			denomination: 'ETH',
			chainGeckoId: 'ethereum',
			tvlChart: [
				[timestamp, 2000],
				[positiveTimestamp, 2000]
			],
			sources: { denominationPriceHistory: priceHistory, tokenPriceHistory: priceHistory }
		})

		expect(result.finalCharts).toEqual({
			TVL: [
				[timestamp, null],
				[positiveTimestamp, 1]
			],
			'Token Price': [
				[timestamp, 0],
				[positiveTimestamp, 2000]
			]
		})
		expect(result.valueSymbol).toBe('ETH')
	})

	test('keeps null gaps for dates missing from otherwise usable denomination history', () => {
		const result = build({
			toggledCharts: ['TVL'],
			denomination: 'ETH',
			chainGeckoId: 'ethereum',
			tvlChart: [[Date.UTC(2023, 11, 31), 2000]],
			sources: { denominationPriceHistory: usableEthHistory }
		})

		expect(result.finalCharts.TVL).toEqual([[Date.UTC(2023, 11, 31), null]])
		expect(result.valueSymbol).toBe('ETH')
	})
})

describe('chain chart price sources', () => {
	test('converts with the gas token and values official token series with the chain token', () => {
		expect(
			getChainChartGeckoIds({
				denomination: 'ETH',
				gasTokenGeckoId: 'ethereum',
				chainGeckoId: 'arbitrum',
				toggledCharts: new Set(['TVL', 'Token Price'])
			})
		).toEqual({ denominationGeckoId: 'ethereum', tokenGeckoId: 'arbitrum' })
	})

	test('fetches no price history for USD without token charts', () => {
		expect(
			getChainChartGeckoIds({
				denomination: 'USD',
				gasTokenGeckoId: 'ethereum',
				chainGeckoId: 'arbitrum',
				toggledCharts: new Set(['TVL'])
			})
		).toEqual({ denominationGeckoId: null, tokenGeckoId: null })
	})

	test('does not report token charts as failed for a tokenless chain', () => {
		const result = build({
			toggledCharts: ['TVL', 'Token Price'],
			denomination: 'ETH',
			chainGeckoId: null,
			gasTokenGeckoId: 'ethereum',
			tvlChart: [[timestamp, 4000]],
			sources: { denominationPriceHistory: buildDenominationPriceHistory({ prices: [[timestamp, 2000]] }) }
		})

		expect(result.finalCharts).toEqual({ TVL: [[timestamp, 2]] })
		expect(result.failedMetrics).toEqual([])
	})
})
