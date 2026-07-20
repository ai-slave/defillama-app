import { describe, expect, it } from 'vitest'
import { getProRwaBreakdown, getProRwaBreakdownQueryKey } from './rwaBreakdown'

describe('getProRwaBreakdown', () => {
	it('maps unsupported legacy asset breakdowns to the chain dataset', () => {
		expect(getProRwaBreakdown('assetClass')).toBe('chain')
		expect(getProRwaBreakdown('assetName')).toBe('chain')
	})

	it('preserves supported RWA API breakdowns', () => {
		expect(getProRwaBreakdown('category')).toBe('category')
		expect(getProRwaBreakdown('platform')).toBe('platform')
		expect(getProRwaBreakdown('assetGroup')).toBe('assetGroup')
	})

	it('builds the normalized cache identity shared by the stream and client query', () => {
		expect(getProRwaBreakdownQueryKey('assetClass', 'activeMcap')).toEqual([
			'pro-dashboard',
			'rwa-breakdown-chart',
			'chain',
			'activeMcap',
			'All'
		])
	})
})
