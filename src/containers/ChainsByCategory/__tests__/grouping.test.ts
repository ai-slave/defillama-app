import { describe, expect, it } from 'vitest'
import { mergeChainAssetTotals } from '../chainAssetTotals'
import { aggregateGroupedChainRows, getTopLevelGroupedChains } from '../grouping'
import type { IFormattedDataWithExtraTvlBase } from '../types'

const chain = (name: string, children: string[] = []) => ({
	name,
	childGroups: children.length ? { ecosystem: children } : null
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
		nftVolume24h: 0,
		nftVolume7d: 0,
		nftVolume30d: 0,
		chainAssets: {
			total: { total: 0 },
			canonical: { total: 0 },
			thirdParty: { total: 0 }
		}
	})

	it.each([
		[chain('Parent', ['Child']), chain('Child')],
		[chain('Child'), chain('Parent', ['Child'])]
	])('emits a grouped child only through its parent regardless of input order', (...chains) => {
		expect(getTopLevelGroupedChains(chains, ['ecosystem']).map(({ name }) => name)).toEqual(['Parent'])
	})

	it('precomputes every selected child in a live-shaped multi-parent fixture', () => {
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

	it('preserves optional asset-category presence and explicit zero while summing groups', () => {
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

	it.each([
		'tvl',
		'mcap',
		'stablesMcap',
		'activeUsers24h',
		'dexVolume24h',
		'fees24h',
		'revenue24h',
		'appRevenue24h',
		'nftVolume24h'
	] as const)('keeps grouped %s unknown when any child is unknown', (field) => {
		const child = row('Child')
		child[field] = null

		expect(aggregateGroupedChainRows([row('Parent'), child])[field]).toBeNull()
	})

	it('does not add per-chain protocol counts that may contain the same protocol', () => {
		const parent = row('Parent')
		parent.protocols = 10
		const child = row('Child')
		child.protocols = 5

		expect(aggregateGroupedChainRows([parent, child]).protocols).toBeNull()
	})

	it('preserves known zero totals and makes assets unknown when any child asset record is missing', () => {
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
		expect(aggregateGroupedChainRows([parent, child]).chainAssets).toBeNull()
	})
})
