import { describe, expect, it } from 'vitest'
import type { StablecoinListAsset } from '../api.types'
import { formatPeggedAssetsData, getPrevStablecoinTotalFromChart, getStablecoinMcapStatsFromTotals } from '../utils'

const NOW = Date.parse('2026-07-14T12:00:00Z')
const point = (date: string, mcap: number) => ({
	date: Math.floor(Date.parse(`${date}T00:00:00Z`) / 1e3),
	mcap: { peggedUSD: mcap }
})

describe('stablecoin change freshness', () => {
	it('validates each period independently without requiring intermediate days', () => {
		const chart = [point('2026-06-14', 70), point('2026-07-07', 80), point('2026-07-13', 90), point('2026-07-14', 100)]

		expect(getPrevStablecoinTotalFromChart(chart, 1, 'mcap', '', { currentTimeMs: NOW })).toBe(90)
		expect(getPrevStablecoinTotalFromChart(chart, 7, 'mcap', '', { currentTimeMs: NOW })).toBe(80)
		expect(getPrevStablecoinTotalFromChart(chart, 30, 'mcap', '', { currentTimeMs: NOW })).toBe(70)
	})

	it('hides only the period whose exact comparison endpoint is missing', () => {
		const chart = [point('2026-06-13', 60), point('2026-06-15', 70), point('2026-07-13', 90), point('2026-07-14', 100)]

		expect(getPrevStablecoinTotalFromChart(chart, 1, 'mcap', '', { currentTimeMs: NOW })).toBe(90)
		expect(getPrevStablecoinTotalFromChart(chart, 30, 'mcap', '', { currentTimeMs: NOW })).toBeNull()
	})

	it('keeps the current total but nulls all changes when the latest point is stale', () => {
		const totals = [
			{ date: String(Math.floor(Date.parse('2026-06-13T00:00:00Z') / 1e3)), Mcap: 80 },
			{ date: String(Math.floor(Date.parse('2026-07-13T00:00:00Z') / 1e3)), Mcap: 100 }
		]

		expect(getStablecoinMcapStatsFromTotals(totals, NOW)).toMatchObject({
			totalMcapCurrent: 100,
			change1d: null,
			change7d: null,
			change30d: null,
			change1dUsd: null,
			change7dUsd: null,
			change30dUsd: null,
			dataTimestamp: Date.parse('2026-07-13T00:00:00Z') / 1e3,
			isDataStale: true
		})
	})

	it('does not treat forward-filled chart points as fresh observations', () => {
		const chart = [point('2026-07-12', 80), point('2026-07-13', 90), { ...point('2026-07-14', 90), isSynthetic: true }]

		expect(getPrevStablecoinTotalFromChart(chart, 1, 'mcap', '', { currentTimeMs: NOW })).toBeNull()
		expect(
			getStablecoinMcapStatsFromTotals(
				[
					{ date: String(point('2026-07-13', 90).date), Mcap: 90 },
					{ date: String(point('2026-07-14', 90).date), Mcap: 90, isSynthetic: true }
				],
				NOW
			).change1d
		).toBeNull()
	})

	it('hides the monthly peg deviation when a daily price snapshot is missing', () => {
		const asset: StablecoinListAsset = {
			id: '1',
			name: 'Test USD',
			symbol: 'TUSD',
			gecko_id: 'test-usd',
			chains: ['Ethereum'],
			pegType: 'peggedUSD',
			pegMechanism: 'fiat-backed',
			priceSource: 'coingecko',
			price: 1,
			circulating: { peggedUSD: 100 },
			circulatingPrevDay: { peggedUSD: 100 },
			circulatingPrevWeek: { peggedUSD: 100 },
			circulatingPrevMonth: { peggedUSD: 100 },
			chainCirculating: {}
		}
		const completePrices = Array.from({ length: 31 }, (_, index) => ({
			date: Math.floor((Date.parse('2026-06-14T00:00:00Z') + index * 24 * 60 * 60 * 1000) / 1e3),
			prices: { 'test-usd': index === 15 ? 0.9 : 1 }
		}))
		const format = (priceData: typeof completePrices) =>
			formatPeggedAssetsData({
				peggedAssets: [asset],
				chartDataByPeggedAsset: [[point('2026-07-14', 100)]],
				peggedNameToChartDataIndex: { 'Test USD': 0 },
				priceData,
				currentTimeMs: NOW
			})[0]

		expect(format(completePrices).pegDeviation_1m).toBeCloseTo(-10)
		expect(format(completePrices.filter((_, index) => index !== 10)).pegDeviation_1m).toBeNull()
	})
})
