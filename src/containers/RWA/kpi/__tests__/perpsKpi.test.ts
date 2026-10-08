import { describe, expect, test } from 'vitest'
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import { foldRwaPerpsKpi } from '../perpsKpi'

const dex = perpsAsset()
const cex = perpsAsset({
	id: 'perps-cex',
	venueType: 'CEX',
	openInterest: 15_000,
	openInterestChange24h: null,
	volume24h: 3000,
	fundingRate: 0.0002,
	fundingIntervalHours: 1,
	protocolFees24h: 700
})

describe('foldRwaPerpsKpi', () => {
	test('folds the windows, the counts, the turnover and the fees the card opens to', () => {
		const tsla = perpsAsset({
			id: 'perps-tsla',
			venue: 'Binance',
			venueType: 'CEX',
			assetName: 'TSLA',
			assetGroup: 'Public Equities',
			price: 200,
			openInterest: 15_000,
			volume24h: 0,
			volume7d: 9000,
			volume30d: 40_000,
			volumeAllTime: 500_000,
			premium: -0.001,
			protocolFees24h: 700,
			protocolFees7d: 4000,
			protocolFees30d: 9000,
			protocolFeesAllTime: 90_000
		})
		const usdy = perpsAsset({
			volumeAllTime: 100_000,
			protocolFees7d: 1000,
			protocolFees30d: 3000,
			protocolFeesAllTime: 10_000
		})
		const kpi = foldRwaPerpsKpi([usdy, perpsAsset({ id: 'usdy-2', venue: 'Binance', openInterest: 0 }), tsla], true)
		expect(kpi.volume7d).toBe(21_000)
		expect(kpi.volume30d).toBe(80_000)
		expect(kpi.volumeAllTime).toBe(600_000)
		// 80k of 30d volume over 20k open.
		expect(kpi.turnover30d).toBe(4)
		expect(kpi.venues).toBe(2)
		expect(kpi.referenceAssets).toBe(2)
		expect(kpi.assetGroups).toBe(2)
		expect([kpi.fees24h, kpi.fees7d, kpi.fees30d, kpi.feesAllTime]).toEqual([1300, 5000, 12_000, 100_000])
	})

	test('folds open interest, volume, markets, DEX share and fees over perps rows', () => {
		const kpi = foldRwaPerpsKpi([spotAsset(), dex, cex], true)
		expect(kpi.openInterest).toBe(20_000)
		expect(kpi.openInterestChange24h).toEqual({ current: 5000, prior: 4000 })
		expect(kpi.volume24h).toBe(4000)
		expect(kpi.markets).toBe(2)
		expect(kpi.dexShare).toBe(25)
		expect(kpi.fees24h).toBe(1000)
	})

	test('leaves CEX markets out under DEX only, but the DEX share still reads over both venue types', () => {
		const kpi = foldRwaPerpsKpi([dex, cex], false)
		expect(kpi.openInterest).toBe(5000)
		expect(kpi.markets).toBe(1)
		expect(kpi.dexShare).toBe(25)
		expect(foldRwaPerpsKpi([dex], true, [dex, cex]).dexShare).toBe(25)
		expect(foldRwaPerpsKpi([cex], true, [dex, cex]).dexShare).toBe(25)
	})

	test('reads a gap as N/A, never zero', () => {
		const kpi = foldRwaPerpsKpi([spotAsset()], true)
		expect(kpi.openInterest).toBeNull()
		expect(kpi.fees24h).toBeNull()
		expect(kpi.turnover30d).toBeNull()
		expect(kpi.markets).toBe(0)
	})
})
