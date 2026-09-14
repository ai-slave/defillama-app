import { describe, expect, test } from 'vitest'
import type { IRWAFlowSummaryResponse } from '../../api.types'
import { spotAsset } from '../../table/__tests__/fixtures'
import { getRwaMovers } from '../movers'

const empty = { assetGroup: {}, platform: {}, category: {}, chain: {} }
const flowSummary: IRWAFlowSummaryResponse = {
	generatedAt: 1,
	windows: {
		'7d': {
			...empty,
			asset: {
				a: { flow: 300, mcap: 1, intensityPct: null, coverage: 1, byChain: {} },
				b: { flow: -100, mcap: 1, intensityPct: null, coverage: 1, byChain: {} },
				c: { flow: 500, mcap: 1, intensityPct: null, coverage: 1, byChain: {} },
				d: { flow: 0, mcap: 1, intensityPct: null, coverage: 1, byChain: {} }
			}
		},
		'30d': { ...empty, asset: {} }
	}
}
const assets = ['a', 'b', 'c', 'd', 'e'].map((id) => spotAsset({ id, canonicalMarketId: id, ticker: id.toUpperCase() }))

describe('getRwaMovers', () => {
	test('splits inflows and outflows, largest first, skipping zero and unknown flows', () => {
		const movers = getRwaMovers(assets, flowSummary)
		expect(movers.inflows.map((mover) => [mover.asset.id, mover.flow])).toEqual([
			['c', 500],
			['a', 300]
		])
		expect(movers.outflows.map((mover) => [mover.asset.id, mover.flow])).toEqual([['b', -100]])
		expect(movers.inflows[0].change7d).toBeCloseTo(14.2857, 3)
	})

	test('caps each side at the limit', () => {
		expect(getRwaMovers(assets, flowSummary, 1).inflows.map((mover) => mover.asset.id)).toEqual(['c'])
	})

	test('is empty without a flow summary', () => {
		expect(getRwaMovers(assets, undefined)).toEqual({ inflows: [], outflows: [] })
	})
})
