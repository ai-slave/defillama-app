import { describe, expect, test } from 'vitest'
import { PROTOCOL_RANKING_RESET_QUERY, PROTOCOL_RANKING_RESET_STORAGE_KEYS } from '../settings'
import { getProtocolRankingDefaultColumnVisibility, getProtocolRankingPresetColumnVisibility } from '../Table'

const primaryPresets = ['Fees', 'Revenue', 'Spot', 'Perps', 'TVL'] as const

describe('Protocol Rankings period presets', () => {
	test('keeps Reset scoped to ranking state while clearing both TVL bounds', () => {
		expect(PROTOCOL_RANKING_RESET_STORAGE_KEYS).toEqual(['ptcfs', 'ptcmp', 'ptcp', 'ptc'])
		expect(PROTOCOL_RANKING_RESET_QUERY).toEqual({ minTvl: undefined, maxTvl: undefined })
	})
	test('restores the compact overview and hides custom columns by default', () => {
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

	test.each([
		['1d', 'change_1d', 'fees_24h', 'dex_volume_24h', 'perp_volume_24h'],
		['7d', 'change_7d', 'fees_7d', 'dex_volume_7d', 'perp_volume_7d'],
		['1m', 'change_1m', 'fees_30d', 'dex_volume_30d', 'perp_volume_30d']
	] as const)('keeps snapshots alongside %s flow columns', (period, tvlChange, fees, spot, perps) => {
		const visibility = getProtocolRankingPresetColumnVisibility({ type: 'period', period }, primaryPresets)

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

	test('keeps routed-volume columns opt-in within their market domains', () => {
		const spot = getProtocolRankingPresetColumnVisibility({ type: 'metric', metric: 'Spot' }, primaryPresets)
		const perps = getProtocolRankingPresetColumnVisibility({ type: 'metric', metric: 'Perps' }, primaryPresets)

		expect(spot.tvl).toBe(false)
		expect(spot.dex_volume_24h).toBe(true)
		expect(spot.dex_aggregator_volume_24h).toBe(false)
		expect(perps.tvl).toBe(false)
		expect(perps.perp_volume_24h).toBe(true)
		expect(perps.perp_aggregator_volume_24h).toBe(false)
	})

	test('intersects metric and period presets without snapshots from other metrics', () => {
		const revenue30d = getProtocolRankingPresetColumnVisibility(
			{ type: 'metric-period', metric: 'Revenue', period: '1m' },
			primaryPresets
		)
		const perps7d = getProtocolRankingPresetColumnVisibility(
			{ type: 'metric-period', metric: 'Perps', period: '7d' },
			primaryPresets
		)

		expect(revenue30d).toMatchObject({
			name: true,
			category: true,
			tvl: false,
			revenue_30d: true,
			holdersRevenue_30d: true,
			emissions_30d: true,
			earnings_30d: true,
			revenue_24h: false,
			fees_30d: false
		})
		expect(perps7d).toMatchObject({
			tvl: false,
			perp_volume_7d: true,
			normalized_volume_7d: true,
			open_interest: true,
			active_liquidity: true,
			perp_volume_24h: false,
			perp_aggregator_volume_7d: false
		})
	})

	test('keeps TVL columns within the TVL metric preset', () => {
		const tvl = getProtocolRankingPresetColumnVisibility({ type: 'metric', metric: 'TVL' }, primaryPresets)
		const tvl7d = getProtocolRankingPresetColumnVisibility(
			{ type: 'metric-period', metric: 'TVL', period: '7d' },
			primaryPresets
		)

		expect(tvl).toMatchObject({ tvl: true, change_1d: true, change_7d: true, change_1m: true })
		expect(tvl7d).toMatchObject({ tvl: true, change_1d: false, change_7d: true, change_1m: false })
	})
})
