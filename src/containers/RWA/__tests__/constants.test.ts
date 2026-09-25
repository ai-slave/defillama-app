import { describe, expect, test } from 'vitest'
import {
	filterCategoriesForStandardRwaOverview,
	getDefaultRWAOverviewInclusion,
	inferPlatformRWAOverviewInclusion
} from '../constants'

describe('getDefaultRWAOverviewInclusion', () => {
	// These categories hold only stablecoin, governance or wrapper assets, so the
	// page would render empty with those toggles off.
	test.each([
		['rwa-yield-wrapper', true, true, true],
		['rwa-stablecoins', true, false, false],
		['non-rwa-stablecoins', true, false, false],
		['fiat-stablecoins', true, false, false],
		['governance-tokens', false, true, false],
		['other-rwas', true, true, true]
	])('opens the %s category page with its assets included', (categorySlug, stablecoins, governance, wrappers) => {
		expect(getDefaultRWAOverviewInclusion({ mode: 'category', categorySlug })).toEqual({
			includeStablecoins: stablecoins,
			includeGovernance: governance,
			includeRwaPerps: false,
			includeBridgeTvl: true,
			includeWrappers: wrappers
		})
	})

	test('keeps other RWA pages on the existing false defaults', () => {
		expect(getDefaultRWAOverviewInclusion({ mode: 'category', categorySlug: 'private-credit' })).toEqual({
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false,
			includeBridgeTvl: true,
			includeWrappers: false
		})
		expect(getDefaultRWAOverviewInclusion({ mode: 'platform', platformSlug: 'other-platform' })).toEqual({
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false,
			includeBridgeTvl: true,
			includeWrappers: true
		})
		expect(getDefaultRWAOverviewInclusion({ mode: 'chain' })).toEqual({
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false,
			includeBridgeTvl: true,
			includeWrappers: false
		})
	})
})

describe('inferPlatformRWAOverviewInclusion', () => {
	test('enables stablecoins when a platform only has stablecoin assets', () => {
		expect(
			inferPlatformRWAOverviewInclusion([{ stablecoin: true, governance: false, onChainMcap: { total: 100 } }])
		).toEqual({
			includeStablecoins: true,
			includeGovernance: false,
			includeRwaPerps: false,
			includeBridgeTvl: true,
			includeWrappers: true
		})
	})

	test('enables stablecoins when they are the majority, but never governance', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: true, governance: true, onChainMcap: { total: 40 } },
				{ stablecoin: true, governance: true, onChainMcap: { total: 40 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 20 } }
			])
		).toMatchObject({ includeStablecoins: true, includeGovernance: false })
	})

	test('enables stablecoins that hold most market cap despite having fewer assets', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: true, governance: false, onChainMcap: { total: 100 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 0 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 0 } }
			])
		).toMatchObject({ includeStablecoins: true, includeGovernance: false })
	})

	test('leaves governance off even when it holds most of the platform market cap', () => {
		// Ondo's shape: 593 real RWAs plus ONDO, which alone is over half the platform's mcap.
		// Counting it would plot ~$7.5B under an On-chain AUM headline that reads ~$3.7B.
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: false, governance: true, onChainMcap: { total: 3_783_000_000 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 3_682_000_000 } },
				{ stablecoin: true, governance: false, onChainMcap: { total: 80_000_000 } }
			])
		).toMatchObject({ includeGovernance: false })
	})

	test('leaves governance off when it is the majority by asset count', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: false, governance: true, onChainMcap: { total: 10 } },
				{ stablecoin: false, governance: true, onChainMcap: { total: 10 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 10 } }
			])
		).toMatchObject({ includeGovernance: false })
	})

	test('keeps optional classifications off on a tie when base assets remain visible', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: true, governance: false, onChainMcap: { total: 50 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 50 } }
			])
		).toEqual({
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false,
			includeBridgeTvl: true,
			includeWrappers: true
		})
	})

	test('falls back to stablecoins, not governance, when no base asset would be visible', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: true, governance: false, onChainMcap: { total: 0 } },
				{ stablecoin: false, governance: true, onChainMcap: { total: 0 } }
			])
		).toEqual({
			includeStablecoins: true,
			includeGovernance: false,
			includeRwaPerps: false,
			includeBridgeTvl: true,
			includeWrappers: true
		})
	})

	test('falls back to governance only for a platform that holds nothing else', () => {
		// 24 platforms are governance-token-only; forcing the toggle off would render them empty.
		expect(
			inferPlatformRWAOverviewInclusion([{ stablecoin: false, governance: true, onChainMcap: { total: 234_700_000 } }])
		).toEqual({
			includeStablecoins: false,
			includeGovernance: true,
			includeRwaPerps: false,
			includeBridgeTvl: true,
			includeWrappers: true
		})
	})

	test('does not enable a minority classification when another classification already makes the page visible', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: true, governance: false, onChainMcap: { total: 60 } },
				{ stablecoin: true, governance: false, onChainMcap: { total: 30 } },
				{ stablecoin: true, governance: true, onChainMcap: { total: 10 } }
			])
		).toMatchObject({ includeStablecoins: true, includeGovernance: false })
	})
})

describe('filterCategoriesForStandardRwaOverview', () => {
	test('drops RWA Perps from the standard overview categories', () => {
		expect(filterCategoriesForStandardRwaOverview(['Treasuries', 'RWA Perps', 'Private Credit'])).toEqual([
			'Treasuries',
			'Private Credit'
		])
	})
})
