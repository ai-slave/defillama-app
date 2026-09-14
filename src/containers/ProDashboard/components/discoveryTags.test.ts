import { describe, expect, test } from 'vitest'
import { DISCOVERY_TAG_LIMIT, rankDiscoveryTags, TRENDING_TAGS } from './discoveryTags'

function dashboardsWithTags(tagSets: Array<Array<string>>, idPrefix = 'dashboard') {
	return tagSets.map((tags, index) => ({ id: `${idPrefix}-${index}`, tags }))
}

describe('rankDiscoveryTags', () => {
	test('ranks tags used by at least two dashboards, most used first, ties alphabetical', () => {
		const dashboards = dashboardsWithTags([
			['Yields', 'Perps', 'Fees', 'Solo'],
			['Yields', 'Perps', 'Fees'],
			['Yields', 'Perps'],
			['Yields', 'Bridges'],
			['Bridges']
		])
		expect(rankDiscoveryTags(dashboards)).toEqual(['Yields', 'Perps', 'Bridges', 'Fees'])
	})

	test('folds case and whitespace and displays the most common spelling', () => {
		const dashboards = dashboardsWithTags([
			['stablecoins', 'RWA'],
			['Stablecoins ', ' rwa'],
			['Stablecoins', 'RWA'],
			['stablecoins', 'RWA'],
			['Perps', 'Fees'],
			['Perps', 'Fees'],
			['Yields', 'DeFi'],
			['Yields', 'DeFi']
		])
		expect(rankDiscoveryTags(dashboards)).toEqual(['RWA', 'stablecoins', 'DeFi', 'Fees', 'Perps', 'Yields'])
	})

	test('counts a dashboard once even when it appears on several shelves or repeats a tag', () => {
		const shared = { id: 'shared', tags: ['Yields', 'yields', 'Perps'] }
		const dashboards = [
			shared,
			shared,
			{ ...shared },
			{ id: 'other-1', tags: ['Fees', 'Perps'] },
			{ id: 'other-2', tags: ['Fees', 'DeFi'] },
			{ id: 'other-3', tags: ['Fees', 'DeFi'] },
			{ id: 'other-4', tags: ['Bridges', 'Staking'] },
			{ id: 'other-5', tags: ['Bridges', 'Staking'] }
		]
		expect(rankDiscoveryTags(dashboards)).toEqual(['Fees', 'Bridges', 'DeFi', 'Perps', 'Staking'])
	})

	test('caps the ranked list at the limit', () => {
		const tags = Array.from({ length: 12 }, (_, index) => `tag-${String(index).padStart(2, '0')}`)
		const dashboards = dashboardsWithTags([tags, tags])
		expect(rankDiscoveryTags(dashboards)).toHaveLength(DISCOVERY_TAG_LIMIT)
		expect(rankDiscoveryTags(dashboards, 3)).toEqual(['tag-00', 'tag-01', 'tag-02'])
	})

	test('falls back to the trending list when fewer than four tags qualify', () => {
		const dashboards = dashboardsWithTags([
			['Yields', 'Perps', 'Fees'],
			['Yields', 'Perps', 'Fees'],
			['Solo'],
			['Another']
		])
		expect(rankDiscoveryTags(dashboards)).toEqual([...TRENDING_TAGS])
		expect(rankDiscoveryTags([])).toEqual([...TRENDING_TAGS])
		expect(rankDiscoveryTags([], 3)).toEqual(TRENDING_TAGS.slice(0, 3))
	})

	test('ignores missing, blank and non-string tags', () => {
		const dashboards = [
			{ id: 'a', tags: ['Yields', '', '   ', 42 as unknown as string] },
			{ id: 'b', tags: ['Yields'] },
			{ id: 'c' },
			{ id: 'd', tags: undefined },
			{ id: 'e', tags: ['Fees', 'Perps', 'DeFi'] },
			{ id: 'f', tags: ['Fees', 'Perps', 'DeFi'] }
		]
		expect(rankDiscoveryTags(dashboards)).toEqual(['DeFi', 'Fees', 'Perps', 'Yields'])
	})
})
