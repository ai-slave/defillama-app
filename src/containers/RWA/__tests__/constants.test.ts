import { describe, expect, it } from 'vitest'
import {
	getDefaultRWAOverviewInclusion,
	getDefaultSelectedTypes,
	inferPlatformRWAOverviewInclusion
} from '../constants'

describe('getDefaultRWAOverviewInclusion', () => {
	it('enables stablecoins and governance by default for rwa-yield-wrapper category pages', () => {
		expect(getDefaultRWAOverviewInclusion({ mode: 'category', categorySlug: 'rwa-yield-wrapper' })).toEqual({
			includeStablecoins: true,
			includeGovernance: true,
			includeRwaPerps: false
		})
	})

	it('enables stablecoins by default for stablecoin category pages', () => {
		for (const categorySlug of ['rwa-stablecoins', 'non-rwa-stablecoins', 'fiat-stablecoins']) {
			expect(getDefaultRWAOverviewInclusion({ mode: 'category', categorySlug })).toEqual({
				includeStablecoins: true,
				includeGovernance: false,
				includeRwaPerps: false
			})
		}
	})

	it('enables governance by default for the governance-tokens category page', () => {
		// every asset in this category is governance-classified, so the page
		// would render empty with the toggle off
		expect(getDefaultRWAOverviewInclusion({ mode: 'category', categorySlug: 'governance-tokens' })).toEqual({
			includeStablecoins: false,
			includeGovernance: true,
			includeRwaPerps: false
		})
	})

	it('enables stablecoins and governance by default for other-rwas category pages', () => {
		expect(getDefaultRWAOverviewInclusion({ mode: 'category', categorySlug: 'other-rwas' })).toEqual({
			includeStablecoins: true,
			includeGovernance: true,
			includeRwaPerps: false
		})
	})

	it('keeps other RWA pages on the existing false defaults', () => {
		expect(getDefaultRWAOverviewInclusion({ mode: 'category', categorySlug: 'private-credit' })).toEqual({
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false
		})
		expect(getDefaultRWAOverviewInclusion({ mode: 'platform', platformSlug: 'other-platform' })).toEqual({
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false
		})
		expect(getDefaultRWAOverviewInclusion({ mode: 'chain' })).toEqual({
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false
		})
	})
})

describe('inferPlatformRWAOverviewInclusion', () => {
	it('enables stablecoins when a platform only has stablecoin assets', () => {
		expect(
			inferPlatformRWAOverviewInclusion([{ stablecoin: true, governance: false, onChainMcap: { total: 100 } }])
		).toEqual({
			includeStablecoins: true,
			includeGovernance: false,
			includeRwaPerps: false
		})
	})

	it('enables each classification independently when it is the majority', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: true, governance: true, onChainMcap: { total: 40 } },
				{ stablecoin: true, governance: true, onChainMcap: { total: 40 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 20 } }
			])
		).toMatchObject({ includeStablecoins: true, includeGovernance: true })
	})

	it('enables a classification that holds most market cap despite having fewer assets', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: false, governance: true, onChainMcap: { total: 100 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 0 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 0 } }
			])
		).toMatchObject({ includeStablecoins: false, includeGovernance: true })
	})

	it('keeps optional classifications off on a tie when base assets remain visible', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: true, governance: false, onChainMcap: { total: 50 } },
				{ stablecoin: false, governance: false, onChainMcap: { total: 50 } }
			])
		).toEqual({
			includeStablecoins: false,
			includeGovernance: false,
			includeRwaPerps: false
		})
	})

	it('enables present classifications when otherwise no base asset would be visible', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: true, governance: false, onChainMcap: { total: 0 } },
				{ stablecoin: false, governance: true, onChainMcap: { total: 0 } }
			])
		).toEqual({
			includeStablecoins: true,
			includeGovernance: true,
			includeRwaPerps: false
		})
	})

	it('does not enable a minority classification when another classification already makes the page visible', () => {
		expect(
			inferPlatformRWAOverviewInclusion([
				{ stablecoin: true, governance: false, onChainMcap: { total: 60 } },
				{ stablecoin: true, governance: false, onChainMcap: { total: 30 } },
				{ stablecoin: true, governance: true, onChainMcap: { total: 10 } }
			])
		).toMatchObject({ includeStablecoins: true, includeGovernance: false })
	})
})

describe('getDefaultSelectedTypes', () => {
	const allTypes = ['Asset', 'Platform', 'Wrapper', 'Perp', 'Unknown']

	it('selects asset, platform, and wrapper types by default for other-rwas and rwa-wrappers category pages', () => {
		for (const categorySlug of ['other-rwas', 'rwa-wrappers']) {
			expect(getDefaultSelectedTypes(allTypes, 'category', categorySlug)).toEqual(['Asset', 'Platform', 'Wrapper'])
		}
	})

	it('keeps wrapper type excluded by default for standard category pages', () => {
		expect(getDefaultSelectedTypes(allTypes, 'category', 'private-credit')).toEqual([
			'Asset',
			'Platform',
			'Perp',
			'Unknown'
		])
	})
})
