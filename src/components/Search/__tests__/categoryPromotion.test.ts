import { describe, expect, test } from 'vitest'
import { findCategoryToPromote, mergePromotedCategory } from '../categoryPromotion'

const launchpad = { name: 'Launchpad', route: '/protocols/launchpad', type: 'Category', r: 2 }
const nftLaunchpad = { name: 'NFT Launchpad', route: '/protocols/nft-launchpad', type: 'Category', r: 2 }
const dyorSwap = { name: 'DyorSwap Launchpad', route: '/protocol/dyorswap-launchpad', type: 'Protocol', r: 3 }
const fixes = { name: 'Fixes Launchpad', route: '/protocol/fixes-launchpad', type: 'Protocol', r: 3 }

describe('findCategoryToPromote', () => {
	test('promotes a category when the query is a near-complete prefix of its name', () => {
		expect(findCategoryToPromote([dyorSwap, fixes], [launchpad, nftLaunchpad], 'launchp')).toBe(launchpad)
	})

	test('requires a minimum query length so short prefixes stay on normal relevance', () => {
		expect(findCategoryToPromote([dyorSwap], [launchpad], 'laun')).toBeNull()
	})

	test('requires the prefix to cover most of the category name', () => {
		// "launch" is 6 characters of the 9-character "Launchpad" (< 70%)
		expect(findCategoryToPromote([dyorSwap], [launchpad], 'launch')).toBeNull()
	})

	test('ignores mid-word matches: the category name must start with the query', () => {
		const algoStables = { name: 'Partially Algorithmic Stablecoin', route: '/protocols/x', type: 'Category', r: 2 }
		const algorand = { name: 'Algorand', route: '/chain/algorand', type: 'Chain', r: 3 }
		expect(findCategoryToPromote([algorand], [algoStables], 'algorithm')).toBeNull()
	})

	test('does not promote for the complete category name (exactness already wins server-side)', () => {
		expect(findCategoryToPromote([dyorSwap], [launchpad], 'launchpad')).toBeNull()
	})

	test('never displaces a navigation page whose name the user is typing', () => {
		const bridges = { name: 'Bridges by Volume', route: '/bridges', type: 'Metric', r: 4 }
		// synthetic category that would otherwise qualify for promotion
		const bridgesBank = { name: 'Bridges Bank', route: '/protocols/bridges-bank', type: 'Category', r: 2 }
		expect(findCategoryToPromote([bridgesBank], [bridgesBank], 'bridges b')).toBe(bridgesBank)
		expect(findCategoryToPromote([bridges], [bridgesBank], 'bridges b')).toBeNull()
		// nav pages indexed before `r` was exposed are recognized by type
		const legacyNav = { name: 'Bridges by Volume', route: '/bridges', type: 'Metric' }
		expect(findCategoryToPromote([legacyNav], [bridgesBank], 'bridges b')).toBeNull()
	})

	test('does displace a nav page that only leads via keyword matches', () => {
		// "lendi" surfaces Yields: Loop through its keywords; the user is
		// spelling out the Lending category, which should win
		const yieldsLoop = { name: 'Yields: Loop', route: '/yields/loop', type: 'Metric', r: 4 }
		const lending = { name: 'Lending', route: '/protocols/lending', type: 'Category', r: 2 }
		expect(findCategoryToPromote([yieldsLoop], [lending], 'lendi')).toBe(lending)
	})

	test('never displaces an exact match of the query', () => {
		const stakingProtocol = { name: 'Staking Pool', route: '/protocol/staking-pool', type: 'Protocol', r: 3 }
		const stakingCategory = { name: 'Staking Pools', route: '/protocols/staking-pool', type: 'Category', r: 2 }
		expect(findCategoryToPromote([stakingProtocol], [stakingCategory], 'staking pool')).toBeNull()
	})
})

describe('mergePromotedCategory', () => {
	test('pins the category first and keeps the page length stable for pagination', () => {
		const page = [dyorSwap, fixes]
		const merged = mergePromotedCategory(page, launchpad)
		expect(merged.map((hit) => hit.route)).toEqual(['/protocols/launchpad', '/protocol/dyorswap-launchpad'])
		expect(merged).toHaveLength(page.length)
	})

	test('moves the category up without duplicating it when it is already in the page', () => {
		const merged = mergePromotedCategory([dyorSwap, launchpad, fixes], launchpad)
		expect(merged.map((hit) => hit.route)).toEqual([
			'/protocols/launchpad',
			'/protocol/dyorswap-launchpad',
			'/protocol/fixes-launchpad'
		])
	})

	test('is a no-op when nothing is promoted or the category already leads', () => {
		const page = [launchpad, dyorSwap]
		expect(mergePromotedCategory(page, null)).toBe(page)
		expect(mergePromotedCategory(page, launchpad)).toBe(page)
	})
})
