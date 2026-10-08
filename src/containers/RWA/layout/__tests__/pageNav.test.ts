import { describe, expect, test } from 'vitest'
import { getRwaAssetsPageNav, getRwaPerpsPageNav } from '../pageNav'

const rwaList = {
	canonicalMarketIds: [],
	idMap: {},
	platforms: ['Ondo', 'Ostium'],
	platformRoutes: [
		{ name: 'Ondo', slug: 'ondo' },
		{ name: 'Ostium', slug: 'ostium' }
	],
	chains: ['Ethereum', 'Solana'],
	categories: ['Treasuries', 'RWA Perps'],
	assetGroups: ['Bonds']
}

describe('getRwaAssetsPageNav', () => {
	test('the overview and a chain page list the chains, All leading to /rwa', () => {
		const nav = getRwaAssetsPageNav('chain', { rwaList, assetGroups: ['Bonds'] }, 'Solana')
		expect(nav).toEqual({
			heading: 'Chains',
			links: [
				{ label: 'All', to: '/rwa' },
				{ label: 'Ethereum', to: '/rwa/chain/ethereum' },
				{ label: 'Solana', to: '/rwa/chain/solana' }
			],
			active: 'Solana'
		})
		expect(getRwaAssetsPageNav('overview', { rwaList, assetGroups: [] }, null).active).toBe('All')
	})

	test('a category page lists the standard categories, never the perps one', () => {
		expect(getRwaAssetsPageNav('category', { rwaList, assetGroups: [] }, 'Treasuries')).toEqual({
			heading: 'Categories',
			links: [
				{ label: 'All', to: '/rwa/categories' },
				{ label: 'Treasuries', to: '/rwa/category/treasuries' }
			],
			active: 'Treasuries'
		})
	})

	test('an asset group page lists the groups it is given, Unknown included', () => {
		expect(getRwaAssetsPageNav('assetGroup', { rwaList, assetGroups: ['Bonds', 'Unknown'] }, 'Bonds').links).toEqual([
			{ label: 'All', to: '/rwa/asset-groups' },
			{ label: 'Bonds', to: '/rwa/asset-group/bonds' },
			{ label: 'Unknown', to: '/rwa/asset-group/unknown' }
		])
	})

	test('a platform page skips the platforms that redirect to their venue page', () => {
		const nav = getRwaAssetsPageNav(
			'platform',
			{ rwaList, assetGroups: [], redirectingPlatforms: new Set(['ostium']) },
			'Ondo'
		)
		expect(nav).toEqual({
			heading: 'Platforms',
			links: [
				{ label: 'All', to: '/rwa/platforms' },
				{ label: 'Ondo', to: '/rwa/platform/ondo' }
			],
			active: 'Ondo'
		})
	})
})

describe('getRwaPerpsPageNav', () => {
	test("lists the asset groups after All and lights the page's own group", () => {
		expect(getRwaPerpsPageNav(['Metals', 'Equity Indices'], 'Metals')).toEqual({
			heading: 'Asset groups',
			links: [
				{ label: 'All', to: '/rwa/perps' },
				{ label: 'Metals', to: '/rwa/perps/asset-group/metals' },
				{ label: 'Equity Indices', to: '/rwa/perps/asset-group/equity-indices' }
			],
			active: 'Metals'
		})
		expect(getRwaPerpsPageNav([], null).active).toBe('All')
	})
})
