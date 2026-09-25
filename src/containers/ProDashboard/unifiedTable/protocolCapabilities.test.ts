import { describe, expect, test } from 'vitest'
import type { UnifiedTableConfig } from './config/current'
import { getProtocolMetricCapabilities } from './protocolCapabilities'

const config = (overrides: Partial<UnifiedTableConfig>): UnifiedTableConfig => ({
	id: 'table',
	kind: 'unified-table',
	configVersion: 3,
	strategy: 'protocols',
	rowHeaders: ['protocol'],
	...overrides
})

describe('protocol supplemental metric capabilities', () => {
	test('requests v2 supplements only for active columns, shares, sorting, or expressions', () => {
		expect(
			getProtocolMetricCapabilities(
				config({
					columnOrder: ['earnings24h', 'bridgeAggregatorVolume24h'],
					columnVisibility: { earnings24h: false, filteredShare_earnings7d: true },
					defaultSorting: [{ id: 'bridgeAggregatorVolume30d', desc: true }]
				})
			).supplementalMetrics
		).toEqual(['earnings', 'bridge-aggregator-volume'])
	})
})

describe('protocol oracle capabilities', () => {
	test('requests oracle membership only for an active oracle column, sort, or filter', () => {
		expect(
			getProtocolMetricCapabilities(config({ columnOrder: ['oracles'], columnVisibility: { oracles: false } }))
				.needsOracleMembership
		).toBe(false)
		expect(
			getProtocolMetricCapabilities(config({ columnOrder: ['oracles'], columnVisibility: { oracles: true } }))
				.needsOracleMembership
		).toBe(true)
		expect(
			getProtocolMetricCapabilities(config({ defaultSorting: [{ id: 'oracles', desc: false }] })).needsOracleMembership
		).toBe(true)
		expect(getProtocolMetricCapabilities(config({ filters: { oracles: ['Chainlink'] } })).needsOracleMembership).toBe(
			true
		)
	})
})

describe('protocol point metric capabilities', () => {
	test('requests only visible, sorted, or custom-expression point metrics', () => {
		expect(
			getProtocolMetricCapabilities(
				config({
					columnOrder: ['volume24hChange7dAgo', 'fees24hChange7dAgo'],
					columnVisibility: { volume24hChange7dAgo: false, fees24hChange7dAgo: true },
					defaultSorting: [{ id: 'revenue24hChange30dAgo', desc: true }],
					customColumns: [
						{
							id: 'custom-growth',
							name: 'Growth',
							expression: 'perpsVolume24hChange7dAgo + my_fees24hChange7dAgo',
							format: 'percent',
							aggregation: 'recalculate'
						}
					]
				})
			).pointMetrics
		).toEqual(['fees', 'revenue', 'perps-volume'])
	})

	test('does not request metrics used only by hidden custom columns', () => {
		expect(
			getProtocolMetricCapabilities(
				config({
					columnVisibility: { 'custom-growth': false },
					customColumns: [
						{
							id: 'custom-growth',
							name: 'Growth',
							expression: 'optionsVolume24hChange7dAgo',
							format: 'percent',
							aggregation: 'recalculate'
						}
					]
				})
			).pointMetrics
		).toEqual([])
	})
})

describe('protocol base metric family capabilities', () => {
	test('requests incentives and long-period families from columns and custom expressions', () => {
		expect(
			getProtocolMetricCapabilities(
				config({
					columnOrder: ['emissions30d', 'emissionsYtd', 'fees_90d', 'change1y', 'optionsNotionalVolume30d'],
					customColumns: [
						{
							id: 'holder-profit',
							name: 'Holder Profit',
							expression: 'holdersRevenue30d - emissions30d + stakingTvl',
							format: 'usd',
							aggregation: 'recalculate'
						}
					]
				})
			).baseMetricFamilies
		).toEqual(['tvl', 'fees', 'holder-revenue', 'incentives', 'options-volume'])
	})

	test('requests holder revenue for the 7d over 7d column', () => {
		expect(
			getProtocolMetricCapabilities(
				config({
					columnOrder: ['holderRevenueChange7dOver7d'],
					columnVisibility: { holderRevenueChange7dOver7d: true }
				})
			).baseMetricFamilies
		).toEqual(['holder-revenue'])
	})

	test('requests fees and revenue for chain economics columns', () => {
		expect(
			getProtocolMetricCapabilities(
				config({
					columnOrder: [
						'chainFees24h',
						'chainFeesChange7dOver7d',
						'chainRevenue7d',
						'chainRevenueChange1d',
						'chainRev30d',
						'chainRevChange30dOver30d'
					]
				})
			).baseMetricFamilies
		).toEqual(['fees', 'revenue'])
	})

	test('requests the current family for visible, sorted, and filtered point comparisons', () => {
		expect(
			getProtocolMetricCapabilities(
				config({
					columnOrder: ['fees24hChange7dAgo'],
					defaultSorting: [{ id: 'revenue24hChange30dAgo', desc: true }],
					filters: { volume24hChange7dAgoMin: -20 }
				})
			).baseMetricFamilies
		).toEqual(['dex-volume', 'fees', 'revenue'])
	})

	test('derives canonical families from visible columns, sorting, filters, shares, and expressions', () => {
		expect(
			getProtocolMetricCapabilities(
				config({
					columnOrder: ['openInterest', 'tvl', 'fees24h'],
					columnVisibility: { openInterest: false, filteredShare_aggregators_volume_24h: true },
					defaultSorting: [{ id: 'mcap', desc: true }],
					filters: { hasOpenInterest: true, revenue30dMin: 1 },
					customColumns: [
						{
							id: 'custom-ratio',
							name: 'Ratio',
							expression: 'ps + options_volume_24h',
							format: 'ratio',
							aggregation: 'recalculate'
						}
					]
				})
			).baseMetricFamilies
		).toEqual(['tvl', 'fees', 'revenue', 'aggregator-volume', 'options-volume', 'open-interest', 'market-cap'])
	})

	test('does not request a family used only by a hidden column', () => {
		expect(
			getProtocolMetricCapabilities(
				config({ columnOrder: ['openInterest'], columnVisibility: { openInterest: false } })
			).baseMetricFamilies
		).toEqual([])
	})
})
