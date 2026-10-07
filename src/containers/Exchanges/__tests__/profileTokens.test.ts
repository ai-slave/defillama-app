import { describe, expect, test } from 'vitest'
import type { ExchangePairModel, ExchangeProfileModel, ExchangeSegment } from '../models'
import { exchangeTokenRows } from '../profileTokens'

function pair(base: string, patch: Partial<ExchangePairModel> = {}): ExchangePairModel {
	return {
		base,
		baseGeckoId: null,
		volume24h: 100,
		openInterestUsd: null,
		normalizedVolume: { normalized: 70, activeLiquidity: 30 },
		...patch
	} as unknown as ExchangePairModel
}

function profile(
	segments: Partial<Record<ExchangeSegment, Array<ExchangePairModel>>>,
	execution: ExchangeProfileModel['execution'] = null
): ExchangeProfileModel {
	return {
		segments: Object.fromEntries(Object.entries(segments).map(([segment, pairs]) => [segment, { pairs }])),
		execution
	} as unknown as ExchangeProfileModel
}

describe('exchangeTokenRows', () => {
	test('groups a token across segments and keeps spot and perp figures apart', () => {
		const [row] = exchangeTokenRows(
			profile({
				spot: [pair('btc'), pair('BTC')],
				linear_perp: [pair('btc', { openInterestUsd: 500 })],
				inverse_perp: [pair('btc', { openInterestUsd: 200, normalizedVolume: null })]
			})
		)
		expect(row.token).toBe('BTC')
		expect(row.segments).toEqual(['spot', 'linear_perp', 'inverse_perp'])
		expect(row.marketCount).toBe(4)
		// Spot and perps are different instruments: never one summed liquidity number.
		expect(row.spotActiveLiquidity).toBe(60)
		expect(row.perpActiveLiquidity).toBe(30)
		expect(row.spotNormalizedVolume).toBe(140)
		expect(row.perpNormalizedVolume).toBe(70)
		// Both perpetual classes are USD-denominated, so open interest adds up.
		expect(row.perpOpenInterestUsd).toBe(700)
	})

	// Summing only the markets that have a normalized figure understates the token;
	// dropping the whole group to reported because one market lacks depth overstates it.
	test('falls back per market and flags that it did', () => {
		const [row] = exchangeTokenRows(
			profile({ spot: [pair('sol'), pair('sol', { normalizedVolume: null, volume24h: 40 })] })
		)
		expect(row.spotNormalizedVolume).toBe(110)
		expect(row.spotVolumeIsReported).toBe(true)

		const [clean] = exchangeTokenRows(profile({ spot: [pair('sol')] }))
		expect(clean.spotVolumeIsReported).toBe(false)
	})

	test('leaves a segment the token does not trade as absent, not zero', () => {
		const [row] = exchangeTokenRows(profile({ spot: [pair('doge')] }))
		expect(row.segments).toEqual(['spot'])
		expect(row.perpActiveLiquidity).toBeNull()
		expect(row.perpNormalizedVolume).toBeNull()
		expect(row.perpOpenInterestUsd).toBeNull()
		expect(row.perpVolumeIsReported).toBe(false)
	})

	// BTC/USDT and BTC/USDC are one token: each figure is the mean of its measured markets,
	// weighted by the volume measured on each, so the busier market counts for more.
	test('merges a token’s measured markets by volume and leaves unmeasured tokens empty', () => {
		const measured = (
			costToTradeBps: number,
			notionalUsd: number,
			insideSpreadPct: number,
			insideMeasuredUsd: number
		) =>
			({
				costToTradeBps,
				notionalUsd,
				insideSpreadPct,
				insideMeasuredUsd,
				hoursCovered: 100
			}) as unknown as ExchangePairModel['execution']
		const rows = exchangeTokenRows(
			profile({
				linear_perp: [
					// the second market has a book to judge against on 1 of its 100: its 50% is 0.5 of 101
					pair('btc', { execution: measured(4, 300, 1, 100) }),
					pair('btc', { execution: measured(8, 100, 50, 1) }),
					pair('doge', { execution: null })
				]
			})
		)
		const btc = rows.find((row) => row.token === 'BTC')?.executionBySegment.linear_perp
		expect(btc?.costToTradeBps).toBe(5)
		expect(btc?.insideSpreadPct).toBeCloseTo((1 * 100 + 50 * 1) / 101, 10)
		expect(btc?.hoursCovered).toBe(100)
		expect(rows.find((row) => row.token === 'DOGE')?.executionBySegment).toEqual({})
	})

	// Leverage is a property of the perp, not of the asset: a spot-only token has none,
	// and where several perps offer it we show the highest on the venue.
	test('takes the highest leverage across the token’s perps, and none from spot', () => {
		const [perps] = exchangeTokenRows(
			profile({
				spot: [pair('btc', { maxLeverage: 999 })],
				linear_perp: [pair('btc', { maxLeverage: 50 })],
				inverse_perp: [pair('btc', { maxLeverage: 125 })]
			})
		)
		expect(perps.maxLeverage).toBe(125)

		const [spotOnly] = exchangeTokenRows(profile({ spot: [pair('doge', { maxLeverage: 20 })] }))
		expect(spotOnly.maxLeverage).toBeNull()

		const [unstated] = exchangeTokenRows(profile({ linear_perp: [pair('sol', { maxLeverage: null })] }))
		expect(unstated.maxLeverage).toBeNull()
	})

	test('ranks the busiest token first', () => {
		const rows = exchangeTokenRows(
			profile({
				spot: [pair('small', { normalizedVolume: { normalized: 1, activeLiquidity: 1 } as never })],
				linear_perp: [pair('big', { normalizedVolume: { normalized: 900, activeLiquidity: 1 } as never })]
			})
		)
		expect(rows.map((row) => row.token)).toEqual(['BIG', 'SMALL'])
	})
})
