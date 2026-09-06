import { describe, expect, test } from 'vitest'
import type { StablecoinListAsset } from '../api.types'
import { buildTotalMcapPayload } from '../chartSeries'
import {
	buildOverviewChartInputs,
	buildStablecoinChainsChartSeries,
	buildStablecoinChainsChartSource,
	buildStablecoinChainsPageSummary,
	normalizeStablecoinBridges
} from '../queries.server'
import type { StablecoinChainsPageInput } from '../types'

const NOW = Date.parse('2026-07-14T12:00:00Z')
const daysAgo = (days: number) => String(Math.floor((NOW - days * 86_400_000) / 1e3))

const chainPoint = (
	days: number,
	mcap: Record<string, number> | undefined,
	extra: Partial<NonNullable<StablecoinChainsPageInput['chainChartMap'][string]>[number]> = {}
) => ({
	date: daysAgo(days),
	...(mcap === undefined ? {} : { totalCirculatingUSD: mcap }),
	...extra
})

const aggregatePoint = (days: number, Mcap: number) => ({ date: daysAgo(days), Mcap })

const chainsRawFixture = (): StablecoinChainsPageInput => ({
	peggedAssets: [],
	chains: [
		{ name: 'Base', totalCirculatingUSD: { peggedUSD: 100 } },
		{ name: 'Arbitrum', totalCirculatingUSD: { peggedUSD: 200 } },
		{ name: 'Ethereum', totalCirculatingUSD: { peggedUSD: 300 } },
		{ name: 'Empty', totalCirculatingUSD: { peggedUSD: 50 } }
	],
	chainCoingeckoIds: {
		Arbitrum: { parent: { chain: 'Ethereum', types: ['L2'] } },
		Base: { parent: { chain: 'Ethereum', types: ['L2'] } }
	},
	aggregatedChart: [aggregatePoint(30, 700), aggregatePoint(7, 800), aggregatePoint(1, 900), aggregatePoint(0, 1000)],
	dominanceMap: {
		Ethereum: [
			{
				date: daysAgo(1),
				totalCirculatingUSD: { peggedUSD: 90 },
				greatestMcap: { gecko_id: 'dai', symbol: 'DAI', mcap: 90 }
			},
			{
				date: daysAgo(0),
				totalCirculatingUSD: { peggedUSD: 100 },
				greatestMcap: { gecko_id: 'usd-coin', symbol: 'USDC', mcap: 80 }
			}
		],
		Arbitrum: [{ date: daysAgo(0), totalCirculatingUSD: { peggedUSD: 80 } }]
	},
	chainChartMap: {
		Ethereum: [
			chainPoint(30, { peggedUSD: 70 }),
			chainPoint(7, { peggedUSD: 80 }),
			chainPoint(1, { peggedUSD: 90 }),
			chainPoint(
				0,
				{ peggedUSD: 100 },
				{
					totalCirculating: { peggedUSD: 100 },
					totalUnreleased: { peggedUSD: 10 },
					totalBridgedToUSD: { peggedUSD: 20 },
					totalMintedUSD: { peggedUSD: 30 }
				}
			)
		],
		Arbitrum: [chainPoint(30, { peggedUSD: 40 }), chainPoint(7, { peggedUSD: 50 }), chainPoint(0, { peggedUSD: 80 })],
		Base: [
			chainPoint(30, { peggedUSD: 0 }),
			chainPoint(7, {}),
			chainPoint(1, undefined),
			chainPoint(0, { peggedUSD: 300 })
		]
	}
})

describe('stablecoin server query helpers', () => {
	test('normalizes measured bridge payloads and ignores source-only metadata', () => {
		expect(
			normalizeStablecoinBridges({
				celer: {
					Ethereum: { amount: '10' }
				},
				layerzero: {
					source: 'Arbitrum',
					amount: 0
				},
				sourceOnly: { source: 'Base' },
				nomad: 25
			})
		).toEqual({
			celer: [{ amount: 10, sourceChain: 'Ethereum' }],
			layerzero: [{ amount: 0, sourceChain: 'Arbitrum' }],
			nomad: [{ amount: 25, sourceChain: null }]
		})
	})

	test('keeps duplicate display names as distinct asset-ID chart histories', () => {
		const baseAsset = {
			name: 'USDA',
			symbol: 'USDA',
			gecko_id: null,
			chains: ['Ethereum'],
			pegType: 'peggedUSD',
			pegMechanism: 'fiat-backed',
			price: 1,
			circulating: { peggedUSD: 1 },
			circulatingPrevDay: { peggedUSD: 1 },
			circulatingPrevWeek: { peggedUSD: 1 },
			circulatingPrevMonth: { peggedUSD: 1 },
			chainCirculating: {}
		} satisfies Omit<StablecoinListAsset, 'id'>
		const inputs = buildOverviewChartInputs({
			peggedAssets: [
				{ ...baseAsset, id: '405' },
				{ ...baseAsset, id: '192' }
			],
			doublecountedSourceIds: [],
			breakdown: {
				'405': [{ date: '1', totalCirculatingUSD: { peggedUSD: 40 } }],
				'192': [{ date: '1', totalCirculatingUSD: { peggedUSD: 85 } }]
			}
		})

		expect(inputs.peggedAssetIdToChartDataIndex).toEqual({ '192': 1, '405': 0 })
		expect(inputs.peggedAssetNames).toEqual(['USDA', 'USDA (192)'])
		expect(
			inputs.chartDataByPeggedAsset.map((history) => {
				const firstPoint = history[0]
				if (!firstPoint) throw new Error('Expected each asset history to contain a point')
				return firstPoint.mcap.peggedUSD
			})
		).toEqual([40, 85])
		expect(
			buildTotalMcapPayload({
				chartDataByAssetOrChain: inputs.chartDataByPeggedAsset,
				assetsOrChainsList: inputs.peggedAssetNames,
				filteredIndexes: inputs.chartDataByPeggedAsset.map((_, index) => index),
				issuanceType: 'mcap',
				selectedChain: 'All'
			}).dataset.source
		).toEqual([[1000, 125]])
	})

	test('keeps producer-supplied histories compact without extending stale series', () => {
		const asset = (id: string, name: string): StablecoinListAsset => ({
			id,
			name,
			symbol: name,
			gecko_id: null,
			chains: ['Ethereum'],
			pegType: 'peggedUSD',
			pegMechanism: 'fiat-backed',
			price: 1,
			circulating: { peggedUSD: 1 },
			circulatingPrevDay: { peggedUSD: 1 },
			circulatingPrevWeek: { peggedUSD: 1 },
			circulatingPrevMonth: { peggedUSD: 1 },
			chainCirculating: {}
		})
		const inputs = buildOverviewChartInputs({
			peggedAssets: [asset('stale', 'Stale'), asset('current', 'Current')],
			doublecountedSourceIds: [],
			breakdown: {
				stale: [{ date: '1', totalCirculatingUSD: { peggedUSD: 10 } }],
				current: [
					{ date: '1', totalCirculatingUSD: { peggedUSD: 20 } },
					{ date: '86401', totalCirculatingUSD: { peggedUSD: 30 } }
				]
			}
		})

		expect(inputs.chartDataByPeggedAsset.map((series) => series.length)).toEqual([1, 2])
		expect(
			buildTotalMcapPayload({
				chartDataByAssetOrChain: inputs.chartDataByPeggedAsset,
				assetsOrChainsList: inputs.peggedAssetNames,
				issuanceType: 'mcap',
				selectedChain: 'All'
			}).dataset.source
		).toEqual([
			[1000, 30],
			[86_401_000, 30]
		])
	})

	test('preserves sparse chronology and missing-versus-zero points', () => {
		const asset = (id: string): StablecoinListAsset => ({
			id,
			name: id,
			symbol: id,
			gecko_id: null,
			chains: ['Ethereum'],
			pegType: 'peggedUSD',
			pegMechanism: 'fiat-backed',
			price: 1,
			circulating: { peggedUSD: 0 },
			circulatingPrevDay: {},
			circulatingPrevWeek: {},
			circulatingPrevMonth: {},
			chainCirculating: {}
		})
		const inputs = buildOverviewChartInputs({
			peggedAssets: [asset('Sparse'), asset('Zero'), asset('PrunedZero'), asset('Absent')],
			doublecountedSourceIds: [],
			breakdown: {
				Sparse: [
					{ date: '3', totalCirculatingUSD: { peggedUSD: 30 } },
					{ date: '7', totalCirculatingUSD: { peggedUSD: 70 } }
				],
				Zero: [
					{ date: '3', totalCirculatingUSD: { peggedUSD: 0 } },
					{ date: '5', totalCirculatingUSD: { peggedUSD: 5 } }
				],
				PrunedZero: [{ date: '3', totalCirculating: { peggedUSD: 10 } }]
			}
		})

		expect(inputs.chartDataByPeggedAsset).toEqual([
			[
				{ date: 3, mcap: { peggedUSD: 30 } },
				{ date: 7, mcap: { peggedUSD: 70 } }
			],
			[
				{ date: 3, mcap: { peggedUSD: 0 } },
				{ date: 5, mcap: { peggedUSD: 5 } }
			],
			[{ date: 3, mcap: {} }],
			[]
		])
	})

	test('builds exact chain page summaries without returning chart histories', () => {
		const page = buildStablecoinChainsPageSummary(chainsRawFixture(), {
			currentTimeMs: NOW,
			chainMetadata: {
				base: { id: 'base', name: 'Base', deprecated: true }
			}
		})

		expect(page).toMatchObject({
			chainList: ['Ethereum', 'Arbitrum', 'Base', 'Empty'],
			chainsGroupbyParent: { Ethereum: { L2: ['Arbitrum', 'Base'] } },
			deprecatedChains: { Base: true },
			change1d: '+11.11',
			change7d: '+25.00',
			change30d: '+42.86',
			totalMcapCurrent: 1000,
			change1d_nol: '+$100',
			change7d_nol: '+$200',
			change30d_nol: '+$300',
			dataTimestamp: Number(daysAgo(0)),
			isDataStale: false
		})
		expect(page.chainCirculatings.map((chain) => chain.name)).toEqual(['Base', 'Ethereum', 'Arbitrum', 'Empty'])
		expect(page.chainCirculatings.find((chain) => chain.name === 'Ethereum')).toMatchObject({
			circulating: 100,
			mcap: 100,
			unreleased: 10,
			bridgedTo: 20,
			minted: 30,
			mcapPrevDay: 90,
			mcapPrevWeek: 80,
			mcapPrevMonth: 70,
			change_1d: 11.11111111111111,
			change_7d: 25,
			change_1m: 42.857142857142854,
			dominance: { name: 'USDC', value: '80.00' }
		})
		expect(page.chainCirculatings.find((chain) => chain.name === 'Arbitrum')).toMatchObject({
			mcap: 80,
			mcapPrevDay: null,
			dominance: null
		})
		expect(page).not.toHaveProperty('chartData')
		expect(page).not.toHaveProperty('peggedChartDataByChain')
	})

	test('preserves signed zero labels and reports stale aggregate timestamps exactly', () => {
		const raw = chainsRawFixture()
		raw.aggregatedChart = [
			aggregatePoint(40, 1000),
			aggregatePoint(39, 1000),
			aggregatePoint(33, 1000),
			aggregatePoint(10, 1000)
		]

		const page = buildStablecoinChainsPageSummary(raw, { currentTimeMs: NOW, chainMetadata: {} })

		expect(page).toMatchObject({
			change1d: null,
			change7d: null,
			change30d: null,
			change1d_nol: null,
			change7d_nol: null,
			change30d_nol: null,
			dataTimestamp: Number(daysAgo(10)),
			isDataStale: true
		})

		raw.aggregatedChart = [
			aggregatePoint(30, 1000),
			aggregatePoint(7, 1000),
			aggregatePoint(1, 1000),
			aggregatePoint(0, 1000)
		]
		const unchanged = buildStablecoinChainsPageSummary(raw, { currentTimeMs: NOW, chainMetadata: {} })
		expect(unchanged).toMatchObject({
			change1d: '0.00',
			change7d: '0.00',
			change30d: '0.00',
			change1d_nol: '$0',
			change7d_nol: '$0',
			change30d_nol: '$0'
		})
	})

	test('preserves chronology and interprets producer-pruned historical metrics as zero', () => {
		const raw = chainsRawFixture()
		raw.chainChartMap.Base = [
			chainPoint(7, undefined, { totalUnreleased: { peggedUSD: 5 } }),
			chainPoint(30, { peggedUSD: 0 }),
			chainPoint(0, { peggedUSD: 0 })
		]
		const before = structuredClone(raw)

		const source = buildStablecoinChainsChartSource(raw)

		expect(source.chainList).toEqual(['Ethereum', 'Arbitrum', 'Base', 'Empty'])
		expect(source.chartDataByChain[2]).toEqual([
			{ date: Number(daysAgo(7)), mcap: 0 },
			{ date: Number(daysAgo(30)), mcap: 0 },
			{ date: Number(daysAgo(0)), mcap: 0 }
		])
		expect(source.chartDataByChain[3]).toBeNull()
		expect(raw).toEqual(before)
	})

	test('builds total, bounded chain, and dominance payloads from the raw source', () => {
		const raw = chainsRawFixture()
		const source = buildStablecoinChainsChartSource(raw)
		const total = buildStablecoinChainsChartSeries(source, { chart: 'totalMcap' })
		const chains = buildStablecoinChainsChartSeries(source, { chart: 'chainMcaps', seriesLimit: 1 })
		const dominance = buildStablecoinChainsChartSeries(source, { chart: 'dominance', includeUnreleased: false })
		const dominanceWithUnreleased = buildStablecoinChainsChartSeries(source, {
			chart: 'dominance',
			includeUnreleased: true
		})

		expect(total.dataset).toEqual({
			dimensions: ['timestamp', 'Mcap'],
			source: [
				[Number(daysAgo(30)) * 1000, 110],
				[Number(daysAgo(7)) * 1000, 130],
				[Number(daysAgo(1)) * 1000, 90],
				[Number(daysAgo(0)) * 1000, 480]
			]
		})
		expect(chains.availableSeries).toEqual(['Base', 'Ethereum', 'Arbitrum', 'Empty'])
		expect(chains.defaultSeries).toEqual(['Base', 'Ethereum', 'Arbitrum', 'Empty'])
		expect(chains).toMatchObject({ valueSymbol: '$', stacked: false, showTotalInTooltip: false })
		expect(chains.dataset.dimensions).toEqual(['timestamp', 'Base', 'Others'])
		expect(chains.dataset.source.at(-1)).toEqual([Number(daysAgo(0)) * 1000, 300, 180])
		expect(dominance).toMatchObject({
			valueSymbol: '%',
			stacked: true,
			expandTo100Percent: true,
			showTotalInTooltip: false
		})
		expect(dominance.dataset.source.at(-1)).toEqual([Number(daysAgo(0)) * 1000, 20.83, 16.67, 62.5, 0])
		expect(dominanceWithUnreleased).toEqual(dominance)
	})
})
