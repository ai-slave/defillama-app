import { describe, expect, test } from 'vitest'
import type { RWAPageKind } from '../../layout/pageLayout'
import {
	getRwaDefaultGroupBy,
	getRwaGroupByOptions,
	getRwaGroupByQueryValue,
	getRwaGroupMemberships,
	parseRwaGroupBy,
	type RWAGroupBy
} from '../groupBy'
import { buildRwaLeafRows } from '../rows'
import { perpsAsset, spotAsset } from './fixtures'

const GROUP_BY_PER_PAGE: Array<[RWAPageKind, RWAGroupBy, Array<string>]> = [
	['overview', 'platform', ['Platform', 'Chain', 'Asset Group', 'Category', 'None']],
	['chain', 'platform', ['Platform', 'Asset Group', 'Category', 'None']],
	['category', 'platform', ['Platform', 'Chain', 'Asset Group', 'None']],
	['assetGroup', 'platform', ['Platform', 'Chain', 'Category', 'None']],
	['platform', 'none', ['None', 'Chain', 'Asset Group', 'Category']],
	['perpsOverview', 'platform', ['Venue', 'Asset Group', 'Asset Class', 'Asset', 'None']],
	['perpsAssetGroup', 'platform', ['Venue', 'Asset Class', 'Asset', 'None']],
	['venue', 'none', ['None', 'Asset Group', 'Asset Class']],
	['perpsAsset', 'none', ['None', 'Venue']]
]

describe('the Group by of each page', () => {
	test.each(GROUP_BY_PER_PAGE)(
		'%s opens with %s and offers its options in order',
		(pageKind, defaultGroupBy, names) => {
			expect(getRwaDefaultGroupBy(pageKind)).toBe(defaultGroupBy)
			expect(getRwaGroupByOptions(pageKind).map((option) => option.name)).toEqual(names)
			expect(parseRwaGroupBy(undefined, pageKind)).toBe(defaultGroupBy)
			expect(getRwaGroupByQueryValue(defaultGroupBy, pageKind)).toBeUndefined()
		}
	)

	test('a page never takes its own dimension from the URL, it falls back to its default', () => {
		expect(parseRwaGroupBy('chain', 'chain')).toBe('platform')
		expect(parseRwaGroupBy('category', 'category')).toBe('platform')
		expect(parseRwaGroupBy('assetGroup', 'assetGroup')).toBe('platform')
		expect(parseRwaGroupBy('platform', 'platform')).toBe('none')
		expect(parseRwaGroupBy('assetGroup', 'perpsAssetGroup')).toBe('platform')
		expect(parseRwaGroupBy('platform', 'venue')).toBe('none')
		expect(parseRwaGroupBy('asset', 'perpsAsset')).toBe('none')
	})

	test('spot-only and perps-only dimensions stay in their tree', () => {
		expect(parseRwaGroupBy('chain', 'perpsOverview')).toBe('platform')
		expect(parseRwaGroupBy('assetClass', 'overview')).toBe('platform')
		expect(parseRwaGroupBy('asset', 'overview')).toBe('platform')
	})

	test('reads the first value of a repeated key and writes a picked option to the URL', () => {
		expect(parseRwaGroupBy(['assetClass', 'none'], 'perpsOverview')).toBe('assetClass')
		expect(getRwaGroupByQueryValue('chain', 'platform')).toBe('chain')
		expect(getRwaGroupByQueryValue('assetClass', 'venue')).toBe('assetClass')
	})
})

describe('getRwaGroupMemberships', () => {
	const [row] = buildRwaLeafRows([spotAsset()], { includeBridgeTvl: true })

	test('puts a perps market under its reference asset with the perps asset link', () => {
		const [perp] = buildRwaLeafRows([perpsAsset({ assetName: 'Gold' })], { includeBridgeTvl: true })
		expect(getRwaGroupMemberships(perp, 'asset')).toEqual([
			{ key: 'Gold', label: 'Gold', href: '/rwa/perps/asset/gold', icon: null, chain: null }
		])
	})

	test('links an asset group into the tree of the row: Perps for a market, Assets for a spot asset', () => {
		const [perp] = buildRwaLeafRows([perpsAsset({ assetGroup: 'Bonds' })], { includeBridgeTvl: true })
		expect(getRwaGroupMemberships(perp, 'assetGroup')[0].href).toBe('/rwa/perps/asset-group/bonds')
		expect(getRwaGroupMemberships(row, 'assetGroup')[0].href).toMatch(/^\/rwa\/asset-group\//)
	})

	test('puts an asset under its platform with a link', () => {
		expect(getRwaGroupMemberships(row, 'platform')).toEqual([
			{ key: 'Ondo', label: 'Ondo', href: '/rwa/platform/ondo', icon: null, chain: null }
		])
	})

	test('puts an asset under every chain it has value on', () => {
		expect(getRwaGroupMemberships(row, 'chain')).toEqual([
			{
				key: 'Ethereum',
				label: 'Ethereum',
				href: '/rwa/chain/ethereum',
				icon: { kind: 'chain', name: 'Ethereum' },
				chain: 'Ethereum'
			},
			{
				key: 'Solana',
				label: 'Solana',
				href: '/rwa/chain/solana',
				icon: { kind: 'chain', name: 'Solana' },
				chain: 'Solana'
			},
			{
				key: 'Mantle',
				label: 'Mantle',
				href: '/rwa/chain/mantle',
				icon: { kind: 'chain', name: 'Mantle' },
				chain: 'Mantle'
			}
		])
	})

	test('puts an asset under every category it carries, as the category page counts it', () => {
		const [both] = buildRwaLeafRows([spotAsset({ category: ['Bond & MMF Funds', 'Private Credit'] })], {
			includeBridgeTvl: true
		})
		expect(getRwaGroupMemberships(both, 'category').map((membership) => membership.href)).toEqual([
			'/rwa/category/bond-mmf-funds',
			'/rwa/category/private-credit'
		])
	})

	test('uses the category and the normalised asset group', () => {
		expect(getRwaGroupMemberships(row, 'category')).toEqual([
			{ key: 'Treasuries', label: 'Treasuries', href: '/rwa/category/treasuries', icon: null, chain: null }
		])
		const [blank] = buildRwaLeafRows([spotAsset({ assetGroup: '  ', category: null })], { includeBridgeTvl: true })
		expect(getRwaGroupMemberships(blank, 'assetGroup')).toEqual([
			{ key: 'Unknown', label: 'Unknown', href: '/rwa/asset-group/unknown', icon: null, chain: null }
		])
		expect(getRwaGroupMemberships(blank, 'category')).toEqual([
			{ key: 'Unknown', label: 'Unknown', href: null, icon: null, chain: null }
		])
	})

	test('attaches the platform logo when the page ships one', () => {
		expect(getRwaGroupMemberships(row, 'platform', { platformLogos: { ondo: 'https://icons/ondo.png' } })).toEqual([
			{
				key: 'Ondo',
				label: 'Ondo',
				href: '/rwa/platform/ondo',
				icon: { kind: 'src', src: 'https://icons/ondo.png' },
				chain: null
			}
		])
	})

	test('keeps an unknown platform without a link', () => {
		const [unknown] = buildRwaLeafRows([spotAsset({ parentPlatform: null })], { includeBridgeTvl: true })
		expect(getRwaGroupMemberships(unknown, 'platform')).toEqual([
			{ key: 'Unknown', label: 'Unknown', href: null, icon: null, chain: null }
		])
	})

	test('puts a perps market under its first asset class, Unknown without one', () => {
		const [perp] = buildRwaLeafRows([perpsAsset({ assetClass: ['Commodities', 'Metals'] })], { includeBridgeTvl: true })
		expect(getRwaGroupMemberships(perp, 'assetClass')).toEqual([
			{ key: 'Commodities', label: 'Commodities', href: null, icon: null, chain: null }
		])
		const [bare] = buildRwaLeafRows([perpsAsset({ assetClass: null })], { includeBridgeTvl: true })
		expect(getRwaGroupMemberships(bare, 'assetClass')).toEqual([
			{ key: 'Unknown', label: 'Unknown', href: null, icon: null, chain: null }
		])
	})

	test('links perps rows to the venue page', () => {
		const [perps] = buildRwaLeafRows([perpsAsset()], { includeBridgeTvl: true })
		expect(getRwaGroupMemberships(perps, 'platform')).toEqual([
			{ key: 'Hyperliquid', label: 'Hyperliquid', href: '/rwa/perps/venue/hyperliquid', icon: null, chain: null }
		])
		expect(getRwaGroupMemberships(perps, 'chain')).toEqual([])
	})
})
