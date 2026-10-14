import { describe, expect, test } from 'vitest'
import { getRwaOverviewIntro, getRwaPageHeadline, getRwaPageMeta } from '../pageCopy'
import type { RWAPageKind } from '../pageLayout'

describe('getRwaPageMeta', () => {
	test('a scoped page names its scope in the title and description, and its canonical is its own route', () => {
		const scope = { name: 'Zeta Fund', slug: 'zeta-fund' }
		const pages: Array<[RWAPageKind, string]> = [
			['chain', '/rwa/chain/zeta-fund'],
			['category', '/rwa/category/zeta-fund'],
			['assetGroup', '/rwa/asset-group/zeta-fund'],
			['platform', '/rwa/platform/zeta-fund'],
			['perpsAssetGroup', '/rwa/perps/asset-group/zeta-fund'],
			['perpsAsset', '/rwa/perps/asset/zeta-fund'],
			['venue', '/rwa/perps/venue/zeta-fund']
		]
		for (const [kind, canonicalUrl] of pages) {
			const meta = getRwaPageMeta(kind, scope)
			expect({ kind, canonicalUrl: meta.canonicalUrl }).toEqual({ kind, canonicalUrl })
			expect(meta.title).toContain('Zeta Fund')
			expect(meta.description).toContain('Zeta Fund')
		}
	})

	test('the two overviews canonicalize to their section roots', () => {
		expect(getRwaPageMeta('overview', null).canonicalUrl).toBe('/rwa')
		expect(getRwaPageMeta('perpsOverview', null).canonicalUrl).toBe('/rwa/perps')
	})

	test('an asset group and its perps page do not share a title', () => {
		const scope = { name: 'Stocks', slug: 'stocks' }
		expect(getRwaPageMeta('assetGroup', scope).title).not.toBe(getRwaPageMeta('perpsAssetGroup', scope).title)
	})

	test('a platform page reads its description from the index when the index has one', () => {
		expect(getRwaPageMeta('platform', { name: 'Ondo', slug: 'ondo' }, 'Tokenized treasuries.').description).toBe(
			'Tokenized treasuries.'
		)
		expect(getRwaPageMeta('platform', { name: 'Ondo', slug: 'ondo' }, null).description).toContain('Ondo')
	})
})

describe('getRwaPageHeadline', () => {
	test('an overview heads with the asset list, a scope page with its metric, an entity page with its name', () => {
		expect(getRwaPageHeadline('overview', null)).toBe('Top real world assets by onchain value')
		expect(getRwaPageMeta('overview', null).title).toBe('Top Real World Assets (RWA) by Onchain Value - DefiLlama')
		expect(getRwaPageHeadline('chain', 'Ethereum')).toBe('Ethereum RWA Active AUM')
		expect(getRwaPageHeadline('perpsOverview', null)).toBe('Total RWA Perps Open Interest')
		expect(getRwaPageHeadline('perpsAssetGroup', 'Stocks')).toBe('Stocks Perps Open Interest')
		expect(getRwaPageHeadline('perpsAsset', 'NVDA')).toBe('NVDA Perps Open Interest')
		expect(getRwaPageHeadline('platform', 'Ondo')).toBeNull()
		expect(getRwaPageHeadline('venue', 'QFEX')).toBeNull()
	})
})

describe('getRwaOverviewIntro', () => {
	test('states the active AUM on the page date', () => {
		expect(getRwaOverviewIntro(Date.UTC(2026, 9, 14) / 1000, 12.4e9)).toBe(
			'Real world assets ranked by onchain value. On Oct 14, 2026 total active AUM is $12.4b.'
		)
	})

	test('keeps the ranking sentence when active AUM is missing', () => {
		expect(getRwaOverviewIntro(Date.UTC(2026, 9, 14) / 1000, null)).toBe('Real world assets ranked by onchain value.')
	})
})
