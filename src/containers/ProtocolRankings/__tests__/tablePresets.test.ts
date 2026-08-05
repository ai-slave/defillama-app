import { describe, expect, it } from 'vitest'
import { getProtocolRankingDefaultColumnVisibility, getProtocolRankingPresetColumnVisibility } from '../Table'

const primaryPresets = ['Fees', 'Revenue', 'Spot', 'Perps', 'TVL']

describe('Protocol Rankings period presets', () => {
	it('restores the compact overview and hides custom columns by default', () => {
		const visibility = getProtocolRankingDefaultColumnVisibility(2)

		expect(visibility).toMatchObject({
			name: true,
			category: true,
			tvl: true,
			change_1d: true,
			change_7d: true,
			change_1m: true,
			mcap: true,
			token_price: true,
			fees_24h: true,
			revenue_24h: true,
			fees_7d: false,
			perp_volume_24h: false,
			options_premium_volume_24h: false,
			custom_formula_0: false,
			custom_formula_1: false
		})
	})

	it.each([
		['1d', 'change_1d', 'fees_24h', 'dex_volume_24h', 'perp_volume_24h'],
		['7d', 'change_7d', 'fees_7d', 'dex_volume_7d', 'perp_volume_7d'],
		['1m', 'change_1m', 'fees_30d', 'dex_volume_30d', 'perp_volume_30d']
	])('keeps snapshots alongside %s flow columns', (period, tvlChange, fees, spot, perps) => {
		const visibility = getProtocolRankingPresetColumnVisibility(null, period, primaryPresets)

		expect(visibility).toMatchObject({
			name: true,
			category: true,
			tvl: true,
			[tvlChange]: true,
			[fees]: true,
			[spot]: true,
			[perps]: true,
			open_interest: true,
			active_liquidity: true,
			fees_cumulative: false,
			pf: false,
			options_premium_volume_24h: false,
			dex_aggregator_volume_24h: false,
			perp_aggregator_volume_24h: false,
			bridge_aggregator_volume_24h: false
		})
	})

	it('keeps routed-volume columns opt-in within their market domains', () => {
		const spot = getProtocolRankingPresetColumnVisibility('Spot', null, primaryPresets)
		const perps = getProtocolRankingPresetColumnVisibility('Perps', null, primaryPresets)

		expect(spot.dex_volume_24h).toBe(true)
		expect(spot.dex_aggregator_volume_24h).toBe(false)
		expect(perps.perp_volume_24h).toBe(true)
		expect(perps.perp_aggregator_volume_24h).toBe(false)
	})

	it('intersects metric and period presets while retaining current snapshots', () => {
		const revenue30d = getProtocolRankingPresetColumnVisibility('Revenue', '1m', primaryPresets)
		const perps7d = getProtocolRankingPresetColumnVisibility('Perps', '7d', primaryPresets)

		expect(revenue30d).toMatchObject({
			name: true,
			category: true,
			tvl: true,
			revenue_30d: true,
			holdersRevenue_30d: true,
			emissions_30d: true,
			earnings_30d: true,
			revenue_24h: false,
			fees_30d: false
		})
		expect(perps7d).toMatchObject({
			tvl: true,
			perp_volume_7d: true,
			normalized_volume_7d: true,
			open_interest: true,
			active_liquidity: true,
			perp_volume_24h: false,
			perp_aggregator_volume_7d: false
		})
	})
})
