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

	test('attaches measured fills by asset and leaves the rest null', () => {
		const rows = exchangeTokenRows(
			profile(
				{ linear_perp: [pair('btc'), pair('doge')] },
				{
					assets: ['BTC'],
					hoursCovered: 720,
					costToTradeBps: 1,
					realizedSlippage10kBps: 1,
					predictedSlippage10kBps: 1,
					markout1mBps: 1,
					feed: null,
					pairs: [{ asset: 'BTC', costToTradeBps: 4 } as never]
				}
			)
		)
		expect(rows.find((row) => row.token === 'BTC')?.execution?.costToTradeBps).toBe(4)
		expect(rows.find((row) => row.token === 'DOGE')?.execution).toBeNull()
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
