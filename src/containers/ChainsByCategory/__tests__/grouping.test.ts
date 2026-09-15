import { describe, expect, test } from 'vitest'
import { mergeChainAssetTotals } from '../chainAssetTotals'
import { aggregateGroupedChainRows, getTopLevelGroupedChains } from '../grouping'
import type { IFormattedDataWithExtraTvlBase } from '../types'

const chain = (name: string, children: Array<string> = []) => ({
	name,
	childGroups: children.length > 0 ? { ecosystem: children } : null
})

describe('chains by category grouping', () => {
	const row = (name: string): IFormattedDataWithExtraTvlBase => ({
		name,
		tvl: 0,
		tvlPrevDay: 0,
		tvlPrevWeek: 0,
		tvlPrevMonth: 0,
		change_1d: null,
		change_7d: null,
		change_1m: null,
		mcap: 0,
		mcaptvl: null,
		protocols: 0,
		stablesMcap: 0,
		dexVolume24h: 0,
		dexVolume7d: 0,
		dexVolume30d: 0,
		fees24h: 0,
		fees7d: 0,
		fees30d: 0,
		revenue24h: 0,
		revenue7d: 0,
		revenue30d: 0,
		appRevenue24h: 0,
		appRevenue7d: 0,
		appRevenue30d: 0,
		activeUsers24h: 0,
		activeUsers7d: 0,
		activeUsers30d: 0,
		chainAssets: {
			total: { total: 0 },
			canonical: { total: 0 },
			thirdParty: { total: 0 }
		}
	})

	test.each([
		[chain('Parent', ['Child']), chain('Child')],
		[chain('Child'), chain('Parent', ['Child'])]
	])('emits a grouped child only through its parent regardless of input order', (...chains) => {
		expect(getTopLevelGroupedChains(chains, ['ecosystem']).map(({ name }) => name)).toEqual(['Parent'])
	})

	test('precomputes every selected child in a live-shaped multi-parent fixture', () => {
		const chains = [
			chain('L2 Child A'),
			chain('Parachain Child A'),
			chain('L2 Parent A', ['L2 Child A']),
			chain('Parachain Parent A', ['Parachain Child A']),
			chain('L2 Child B'),
			chain('L2 Parent B', ['L2 Child B']),
			chain('Standalone')
		]

		expect(getTopLevelGroupedChains(chains, ['ecosystem']).map(({ name }) => name)).toEqual([
			'L2 Parent A',
			'Parachain Parent A',
			'L2 Parent B',
			'Standalone'
		])
	})

	test('preserves optional asset-category presence and explicit zero while summing groups', () => {
		const base = {
			total: { total: 10 },
			canonical: { total: 8 },
			thirdParty: { total: 2 }
		}

		expect(mergeChainAssetTotals(base, base)).toEqual({
			total: { total: 20 },
			canonical: { total: 16 },
			thirdParty: { total: 4 }
		})
		expect(mergeChainAssetTotals(base, { ...base, native: { total: 0 }, ownTokens: { total: 0 } })).toEqual({
			total: { total: 20 },
			canonical: { total: 16 },
			thirdParty: { total: 4 },
			native: { total: 0 },
			ownTokens: { total: 0 }
		})
	})

	test('carries the v2-only sections through a merge with a chain that reports only five', () => {
		const eightSection = {
			total: { total: 100 },
			canonical: { total: 10 },
			thirdParty: { total: 20 },
			native: { total: 30 },
			stablecoins: { total: 35 },
			rwa: { total: 3 },
			lst: { total: 2 }
		}
		const fiveSection = { total: { total: 40 }, canonical: { total: 25 }, thirdParty: { total: 15 } }

		// a section present on only one side must survive rather than being dropped
		expect(mergeChainAssetTotals(eightSection, fiveSection)).toEqual({
			total: { total: 140 },
			canonical: { total: 35 },
			thirdParty: { total: 35 },
			native: { total: 30 },
			stablecoins: { total: 35 },
			rwa: { total: 3 },
			lst: { total: 2 }
		})
	})

	test.each([
		'mcap',
		'stablesMcap',
		'activeUsers24h',
		'dexVolume24h',
		'fees24h',
		'revenue24h',
		'appRevenue24h'
	] as const)('sums known grouped %s values when a child is unavailable', (field) => {
		const parent = row('Parent')
		parent[field] = 12
		const child = row('Child')
		child[field] = null

		expect(aggregateGroupedChainRows([parent, child])[field]).toBe(12)
		parent[field] = null
		expect(aggregateGroupedChainRows([parent, child])[field]).toBeNull()
	})

	test('uses current TVL contributors for grouped comparison periods', () => {
		const parent = row('Parent')
		Object.assign(parent, { tvl: 100, tvlPrevDay: 80, tvlPrevWeek: 70, tvlPrevMonth: 60 })
		const unavailable = row('Unavailable')
		Object.assign(unavailable, { tvl: null, tvlPrevDay: 50, tvlPrevWeek: 40, tvlPrevMonth: 30 })
		const active = row('Active')
		Object.assign(active, { tvl: 50, tvlPrevDay: null, tvlPrevWeek: 25, tvlPrevMonth: 20 })

		expect(aggregateGroupedChainRows([parent, unavailable, active])).toMatchObject({
			tvl: 150,
			tvlPrevDay: null,
			tvlPrevWeek: 95,
			tvlPrevMonth: 80
		})
	})

	test('keeps explicit zero TVL and all-unavailable TVL distinct', () => {
		const zero = row('Zero')
		const unavailable = row('Unavailable')
		Object.assign(unavailable, { tvl: null, tvlPrevDay: null, tvlPrevWeek: null, tvlPrevMonth: null })

		expect(aggregateGroupedChainRows([zero, unavailable])).toMatchObject({
			tvl: 0,
			tvlPrevDay: 0,
			tvlPrevWeek: 0,
			tvlPrevMonth: 0
		})
		Object.assign(zero, { tvl: null, tvlPrevDay: 0, tvlPrevWeek: 0, tvlPrevMonth: 0 })
		expect(aggregateGroupedChainRows([zero, unavailable])).toMatchObject({
			tvl: null,
			tvlPrevDay: null,
			tvlPrevWeek: null,
			tvlPrevMonth: null
		})
	})

	test('does not add per-chain protocol counts that may contain the same protocol', () => {
		const parent = row('Parent')
		parent.protocols = 10
		const child = row('Child')
		child.protocols = 5

		expect(aggregateGroupedChainRows([parent, child]).protocols).toBeNull()
	})

	test('preserves known asset totals when a child asset record is missing', () => {
		const parent = row('Parent')
		const child = row('Child')
		expect(aggregateGroupedChainRows([parent, child])).toMatchObject({
			tvl: 0,
			protocols: null,
			fees24h: 0,
			chainAssets: {
				total: { total: 0 },
				canonical: { total: 0 },
				thirdParty: { total: 0 }
			}
		})

		child.chainAssets = null
		expect(aggregateGroupedChainRows([parent, child]).chainAssets).toEqual(parent.chainAssets)
		parent.chainAssets = null
		expect(aggregateGroupedChainRows([parent, child]).chainAssets).toBeNull()
	})
})
