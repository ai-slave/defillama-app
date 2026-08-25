import { describe, expect, it } from 'vitest'
import type { StablecoinListAsset } from '~/containers/Stablecoins/api.types'
import {
	buildReserveStablecoinChartData,
	getReserveStablecoinViewState,
	TOTAL_STABLECOINS_SERIES_NAME
} from '../reserveStablecoinChartData'

const usdtAsset = { symbol: 'USDT', pegType: 'peggedUSD', pegMechanism: 'fiat-backed' } satisfies Pick<
	StablecoinListAsset,
	'symbol' | 'pegType' | 'pegMechanism'
>

const assets = [
	usdtAsset,
	{ symbol: 'USDC', pegType: 'peggedUSD', pegMechanism: 'fiat-backed' },
	{ symbol: 'DAI', pegType: 'peggedUSD', pegMechanism: 'crypto-backed' }
] satisfies Array<Pick<StablecoinListAsset, 'symbol' | 'pegType' | 'pegMechanism'>>

describe('buildReserveStablecoinChartData', () => {
	it('builds zero-filled datasets in first-seen dimension order', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { BTC: 100, USDT: 20, DAI: 5 }],
				[2_000, { USDC: 7, USDT: 3 }]
			],
			assets
		)

		expect(result.totalStablecoins?.dataset).toEqual({
			dimensions: ['timestamp', TOTAL_STABLECOINS_SERIES_NAME],
			source: [
				[1_000, 25],
				[2_000, 10]
			]
		})
		expect(result.totalStablecoins?.charts.map((chart) => chart.name)).toEqual([TOTAL_STABLECOINS_SERIES_NAME])
		const tokenDataset = result.stablecoinsByToken!.dataset
		expect(tokenDataset.dimensions).toEqual(['timestamp', 'USDT', 'DAI', 'USDC'])
		expect(tokenDataset.source).toEqual([
			[1_000, 20, 5, 0],
			[2_000, 3, 0, 7]
		])
		expect(result.stablecoinsByPegMechanism?.dataset.source).toEqual([
			[1_000, 20, 5],
			[2_000, 10, 0]
		])
		expect(result.stablecoinsByPegType?.dataset.source).toEqual([
			[1_000, 25],
			[2_000, 10]
		])
		expect(result.currentTotal).toBe(10)
		expect(result.currentStablecoinCount).toBe(2)
		for (const spec of [
			result.totalStablecoins,
			result.stablecoinsByPegMechanism,
			result.stablecoinsByPegType,
			result.stablecoinsByToken
		]) {
			for (const chart of spec?.charts ?? []) expect(chart.encode.y).toBeGreaterThan(0)
		}
	})

	it('trusts unique timestamps and preserves the last duplicate-symbol definition', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { USDT: 2 }],
				[2_000, { USDT: 4 }]
			],
			[usdtAsset, { symbol: 'USDT', pegType: 'peggedEUR', pegMechanism: 'algorithmic' }]
		)

		expect(result.totalStablecoins?.dataset.source).toEqual([
			[1_000, 2],
			[2_000, 4]
		])
		expect(result.stablecoinsByPegMechanism?.dataset.source).toEqual([
			[1_000, 2],
			[2_000, 4]
		])
		expect(result.pegTypesUnique).toEqual(['peggedEUR'])
	})

	it('uses the latest mechanism row for the pie and summary', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { USDT: 100 }],
				[2_000, { USDT: 75, DAI: 25 }]
			],
			assets
		)

		expect(result.stablecoinBreakdown).toEqual([
			{ mechanism: 'fiat-backed', value: 75, percentage: 75 },
			{ mechanism: 'crypto-backed', value: 25, percentage: 25 }
		])
		expect(result.pegMechanismPieSeries.peers.map(({ name, value }) => ({ name, value }))).toEqual([
			{ name: 'fiat-backed', value: 75 },
			{ name: 'crypto-backed', value: 25 }
		])
	})

	it('keeps successful timestamps with no matched stablecoin as zero stock', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { USDT: 5, DAI: 2 }],
				[2_000, { BTC: 10 }]
			],
			assets
		)

		expect(result.totalStablecoins?.dataset.source).toEqual([
			[1_000, 7],
			[2_000, 0]
		])
		expect(result.stablecoinsByToken?.dataset).toEqual({
			dimensions: ['timestamp', 'USDT', 'DAI'],
			source: [
				[1_000, 5, 2],
				[2_000, 0, 0]
			]
		})
		expect(result.currentTotal).toBe(0)
		expect(result.currentStablecoinCount).toBe(0)
		expect(result.stablecoinBreakdown).toEqual([])
		expect(result.pegMechanismPieSeries).toEqual({ peers: [], limit: 10, upstreamOthersValue: 0 })
	})

	it('counts current positive holdings without shrinking historical eligibility', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { USDT: 5, USDC: 4, DAI: 3 }],
				[2_000, { USDT: 2, USDC: 0 }]
			],
			assets
		)

		expect(result.stablecoinTokensUnique).toEqual(['USDT', 'USDC', 'DAI'])
		expect(result.stablecoinsByToken?.dataset.source[1]).toEqual([2_000, 2, 0, 0])
		expect(result.currentStablecoinCount).toBe(1)
	})

	it('preserves exact-case symbol matching', () => {
		const result = buildReserveStablecoinChartData(
			[
				[1_000, { usdt: 9, USDT: 2 }],
				[2_000, { usdt: 8, USDT: 1 }]
			],
			assets
		)

		expect(result.stablecoinTokensUnique).toEqual(['USDT'])
		expect(result.totalStablecoins?.dataset.source).toEqual([
			[1_000, 2],
			[2_000, 1]
		])
	})

	it('distinguishes query failure from successful empty and ready data', () => {
		const data = buildReserveStablecoinChartData(
			[
				[1_000, { USDT: 2 }],
				[2_000, { USDT: 1 }]
			],
			assets
		)

		expect(
			getReserveStablecoinViewState({
				data: undefined,
				isLoading: false,
				tokenBreakdownFailed: true,
				stablecoinListFailed: false,
				chartDataFailed: false
			})
		).toEqual({ status: 'unavailable' })
		expect(
			getReserveStablecoinViewState({
				data: undefined,
				isLoading: false,
				tokenBreakdownFailed: false,
				stablecoinListFailed: true,
				chartDataFailed: false
			})
		).toEqual({ status: 'unavailable' })
		expect(
			getReserveStablecoinViewState({
				data: undefined,
				isLoading: false,
				tokenBreakdownFailed: false,
				stablecoinListFailed: false,
				chartDataFailed: true
			})
		).toEqual({ status: 'unavailable' })
		expect(
			getReserveStablecoinViewState({
				data: undefined,
				isLoading: true,
				tokenBreakdownFailed: false,
				stablecoinListFailed: false,
				chartDataFailed: false
			})
		).toEqual({ status: 'loading' })
		expect(
			getReserveStablecoinViewState({
				data: undefined,
				isLoading: false,
				tokenBreakdownFailed: false,
				stablecoinListFailed: false,
				chartDataFailed: false
			})
		).toEqual({ status: 'empty' })
		expect(
			getReserveStablecoinViewState({
				data,
				isLoading: false,
				tokenBreakdownFailed: false,
				stablecoinListFailed: false,
				chartDataFailed: false
			})
		).toEqual({ status: 'ready', data })
	})
})
