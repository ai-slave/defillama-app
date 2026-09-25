import { describe, expect, test } from 'vitest'
import { formatBarChart } from '~/components/ECharts/shared/timeSeries'
import type { ChainAssetTotals } from '~/containers/BridgedTVL/api.types'
import {
	buildBridgedTvlChart,
	buildDenominationPriceHistory,
	getNetInflowsSeries,
	normalizeActivityChart
} from '../chainChartData'
import { formatChainAssets } from '../utils'

describe('ChainOverview chart data transforms', () => {
	test('charts signed net inflows while preserving zero and retaining unknown points as gaps', () => {
		expect(
			getNetInflowsSeries([
				[1, 10, -4],
				[2, 4, -10],
				[3, 5, -5],
				[4, null, -3],
				[5, 3, null],
				[6, null, null]
			])
		).toEqual([
			[1, 6],
			[2, -6],
			[3, 0],
			[4, null],
			[5, null],
			[6, null]
		])
	})

	test('keeps valid Coingecko price chart rows alongside the denomination lookup', () => {
		const prices: Array<[number, number]> = [
			[2000, 2],
			[1000, 1]
		]
		const mcaps: Array<[number, number]> = [[1000, 10]]
		const volumes: Array<[number, number]> = [[1000, 20]]

		const result = buildDenominationPriceHistory({ prices, mcaps, volumes })

		expect(result.priceChart).toEqual(prices)
		expect(result.conversionPrices).toEqual({
			1000: 1,
			2000: 2
		})
		expect(result.canConvert).toBe(true)
		expect(result.mcaps).toBe(mcaps)
		expect(result.volumes).toBe(volumes)
	})

	test('uses the last valid duplicate timestamp observation as the conversion denominator', () => {
		const positiveThenZero = buildDenominationPriceHistory({
			prices: [
				[1000, 2],
				[1000, 0]
			]
		})
		expect(positiveThenZero.priceChart).toEqual([
			[1000, 2],
			[1000, 0]
		])
		expect(positiveThenZero.conversionPrices).toEqual({})
		expect(positiveThenZero.canConvert).toBe(false)

		const zeroThenPositive = buildDenominationPriceHistory({
			prices: [
				[1000, 0],
				[1000, 2]
			]
		})
		expect(zeroThenPositive.priceChart).toEqual([
			[1000, 0],
			[1000, 2]
		])
		expect(zeroThenPositive.conversionPrices).toEqual({ 1000: 2 })
		expect(zeroThenPositive.canConvert).toBe(true)

		const positiveThenPositive = buildDenominationPriceHistory({
			prices: [
				[1000, 2],
				[1000, 4]
			]
		})
		expect(positiveThenPositive.conversionPrices).toEqual({ 1000: 4 })
		expect(positiveThenPositive.canConvert).toBe(true)
	})

	test('distinguishes an empty activity response from a zero-valued point', () => {
		expect(normalizeActivityChart([])).toBeNull()
		const activity = normalizeActivityChart([[1_700_000_000, 0]])
		expect(activity).toEqual([[1_700_000_000, 0]])
		expect(formatBarChart({ data: activity ?? [], groupBy: 'daily', denominationPriceHistory: null })).toEqual([
			[1_700_000_000_000, 0]
		])
	})

	test('carries the v2-only sections through to the page instead of projecting them away', () => {
		const chainAsset: ChainAssetTotals = {
			canonical: { total: 10 },
			thirdParty: { total: 20 },
			total: { total: 100 },
			native: { total: 30 },
			ownTokens: { total: 500 },
			stablecoins: { total: 35.9 },
			rwa: { total: 3 },
			lst: { total: 2 }
		}

		expect(formatChainAssets(chainAsset)).toEqual({
			canonical: { total: 10 },
			thirdParty: { total: 20 },
			total: { total: 100 },
			native: { total: 30 },
			ownTokens: { total: 500 },
			stablecoins: { total: 35 },
			rwa: { total: 3 },
			lst: { total: 2 }
		})
	})

	test('builds bridged TVL chart timestamps from UTC day arithmetic', () => {
		const timestampSec = Date.UTC(2026, 0, 3, 12) / 1e3
		const dayStartSec = Date.UTC(2026, 0, 3) / 1e3

		expect(buildBridgedTvlChart([{ timestamp: timestampSec, data: { total: 100 } }], false)).toEqual([
			[dayStartSec * 1e3, 100]
		])
	})

	test('adds own tokens to bridged TVL on the millisecond timestamp when govtokens are enabled', () => {
		const timestampSec = Date.UTC(2026, 0, 3, 12) / 1e3
		const dayStartSec = Date.UTC(2026, 0, 3) / 1e3

		expect(buildBridgedTvlChart([{ timestamp: timestampSec, data: { total: 100, ownTokens: 10 } }], true)).toEqual([
			[dayStartSec * 1e3, 110]
		])
	})
})
