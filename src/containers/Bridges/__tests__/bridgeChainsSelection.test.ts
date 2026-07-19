import { describe, expect, it } from 'vitest'
import { boundBridgeChainSelection, MAX_VISIBLE_CHAINS } from '../bridgeChainsSelection'

const chains = Array.from({ length: MAX_VISIBLE_CHAINS + 5 }, (_, index) => `Chain ${index + 1}`)

describe('boundBridgeChainSelection', () => {
	it('leaves selections within the chart limit unchanged', () => {
		const values = chains.slice(0, MAX_VISIBLE_CHAINS)
		expect(boundBridgeChainSelection([], values)).toBe(values)
		expect(boundBridgeChainSelection(values, [])).toEqual([])
	})

	it('keeps a newly added chain when the selection exceeds the limit', () => {
		const current = chains.slice(0, MAX_VISIBLE_CHAINS)
		const added = chains[MAX_VISIBLE_CHAINS]

		expect(boundBridgeChainSelection(current, [...current, added])).toEqual([...current.slice(0, -1), added])
	})

	it('deterministically truncates bulk selections', () => {
		expect(boundBridgeChainSelection([], chains)).toEqual(chains.slice(0, MAX_VISIBLE_CHAINS))
	})
})
