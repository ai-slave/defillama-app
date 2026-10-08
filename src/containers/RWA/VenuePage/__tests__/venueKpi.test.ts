import { describe, expect, test } from 'vitest'
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import { foldRwaVenueKpi } from '../venueKpi'

describe('foldRwaVenueKpi', () => {
	test('folds open interest, three volume windows, markets and fees over every market, CEX included', () => {
		const cex = perpsAsset({
			id: 'perps-cex',
			venueType: 'CEX',
			openInterest: 15_000,
			volume24h: 3000,
			volume7d: 9000,
			volume30d: 40_000,
			fundingRate: 0.0002,
			fundingIntervalHours: 1,
			protocolFees24h: 700,
			protocolFees30d: 9000
		})
		const kpi = foldRwaVenueKpi([spotAsset(), perpsAsset({ protocolFees30d: 1000 }), cex], null)
		expect(kpi.openInterest).toBe(20_000)
		expect(kpi.volume24h).toBe(4000)
		expect(kpi.volume7d).toBe(15_000)
		expect(kpi.volume30d).toBe(60_000)
		expect(kpi.markets).toBe(2)
		expect(kpi.fees24h).toBe(1000)
		expect(kpi.fees30d).toBe(10_000)
	})

	test('adds the venue share of its type and the annual fee run rate', () => {
		const kpi = foldRwaVenueKpi(
			[
				perpsAsset({ protocolFees30d: 3000 }),
				perpsAsset({ id: 'b', openInterest: 15_000, fundingIntervalHours: 1, protocolFees30d: 3000 })
			],
			80_000
		)
		expect(kpi.venueShare).toBe(25)
		// 6k in 30 days, times 365 / 30.
		expect(kpi.feesAnnual).toBe(73_000)
	})

	test('leaves the share a gap without the total of its type', () => {
		expect(foldRwaVenueKpi([perpsAsset()], null).venueShare).toBeNull()
		expect(foldRwaVenueKpi([perpsAsset()], 0).venueShare).toBeNull()
	})

	test('reads a venue with no markets as N/A, never zero', () => {
		const kpi = foldRwaVenueKpi([spotAsset()], null)
		expect(kpi.openInterest).toBeNull()
		expect(kpi.volume30d).toBeNull()
		expect(kpi.fees30d).toBeNull()
		expect(kpi.feesAnnual).toBeNull()
		expect(kpi.markets).toBe(0)
	})
})
