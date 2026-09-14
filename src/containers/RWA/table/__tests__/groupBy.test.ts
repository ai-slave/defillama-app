import { describe, expect, test } from 'vitest'
import {
	getRwaDefaultGroupBy,
	getRwaGroupByOptions,
	getRwaGroupByQueryValue,
	getRwaGroupMemberships,
	parseRwaGroupBy
} from '../groupBy'
import { buildRwaLeafRows } from '../rows'
import { perpsAsset, spotAsset } from './fixtures'

describe('parseRwaGroupBy', () => {
	test('defaults to platform in both views, ignoring unknown values', () => {
		expect(parseRwaGroupBy(undefined, 'assets')).toBe('platform')
		expect(parseRwaGroupBy('nope', 'assets')).toBe('platform')
		expect(parseRwaGroupBy(['chain', 'none'], 'assets')).toBe('chain')
		expect(parseRwaGroupBy(undefined, 'perps')).toBe('platform')
	})

	test('has no chain or category option in the perps view, offers asset there and calls platform Venue', () => {
		expect(parseRwaGroupBy('chain', 'perps')).toBe('platform')
		expect(parseRwaGroupBy('category', 'perps')).toBe('platform')
		expect(parseRwaGroupBy('asset', 'perps')).toBe('asset')
		expect(parseRwaGroupBy('asset', 'assets')).toBe('platform')
		expect(getRwaGroupByOptions('perps').map((option) => [option.key, option.name])).toEqual([
			['platform', 'Venue'],
			['assetGroup', 'Asset Group'],
			['asset', 'Asset'],
			['none', 'None']
		])
		expect(getRwaGroupByOptions('assets').map((option) => option.name)).toEqual([
			'Platform',
			'Chain',
			'Asset Group',
			'Category',
			'None'
		])
	})

	test('serialises the view default as absent', () => {
		expect(getRwaGroupByQueryValue('platform', 'assets')).toBeUndefined()
		expect(getRwaGroupByQueryValue('chain', 'assets')).toBe('chain')
		expect(getRwaGroupByQueryValue('platform', 'perps')).toBeUndefined()
		expect(getRwaGroupByQueryValue('asset', 'perps')).toBe('asset')
	})

	test('opens every page by platform and hides Chain on a chain page', () => {
		for (const scope of ['all', 'chain', 'category', 'assetGroup', 'platform'] as const) {
			expect(getRwaDefaultGroupBy('assets', { scope })).toBe('platform')
		}
		expect(getRwaDefaultGroupBy('perps', { scope: 'chain' })).toBe('platform')
		expect(parseRwaGroupBy(undefined, 'assets', { scope: 'chain' })).toBe('platform')
		expect(parseRwaGroupBy('chain', 'assets', { scope: 'chain' })).toBe('platform')
		expect(parseRwaGroupBy('chain', 'assets', { scope: 'platform' })).toBe('chain')
		expect(getRwaGroupByOptions('assets', { scope: 'chain' }).map((option) => option.key)).toEqual([
			'platform',
			'assetGroup',
			'category',
			'none'
		])
		expect(getRwaGroupByQueryValue('platform', 'assets', { scope: 'chain' })).toBeUndefined()
		expect(getRwaGroupByQueryValue('assetGroup', 'assets', { scope: 'platform' })).toBe('assetGroup')
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

	test('uses the primary category and the normalised asset group', () => {
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

	test('links perps rows to the venue page', () => {
		const [perps] = buildRwaLeafRows([perpsAsset()], { includeBridgeTvl: true })
		expect(getRwaGroupMemberships(perps, 'platform')).toEqual([
			{ key: 'Hyperliquid', label: 'Hyperliquid', href: '/rwa/perps/venue/hyperliquid', icon: null, chain: null }
		])
		expect(getRwaGroupMemberships(perps, 'chain')).toEqual([])
	})
})
