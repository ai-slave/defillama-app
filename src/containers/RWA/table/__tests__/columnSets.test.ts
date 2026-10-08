import { describe, expect, test } from 'vitest'
import { getRwaHiddenColumnIds } from '../columnSets'

describe('getRwaHiddenColumnIds', () => {
	test('perps rows show Asset Group only under Group by Venue and None', () => {
		expect(getRwaHiddenColumnIds('platform', 'perpsOverview')).not.toContain('assetGroup')
		expect(getRwaHiddenColumnIds('none', 'perpsOverview')).not.toContain('assetGroup')
		expect(getRwaHiddenColumnIds('assetGroup', 'perpsOverview')).toContain('assetGroup')
		expect(getRwaHiddenColumnIds('assetClass', 'perpsOverview')).toContain('assetGroup')
		expect(getRwaHiddenColumnIds('asset', 'perpsOverview')).toContain('assetGroup')
	})

	test('asset rows hide Asset Group under Group by Asset Group only', () => {
		expect(getRwaHiddenColumnIds('assetGroup', 'overview')).toContain('assetGroup')
		expect(getRwaHiddenColumnIds('category', 'overview')).not.toContain('assetGroup')
	})

	test('a Perps scope page never shows its own dimension, whatever the Group by', () => {
		expect(getRwaHiddenColumnIds('assetGroup', 'venue')).toEqual(expect.arrayContaining(['platform', 'venueType']))
		expect(getRwaHiddenColumnIds('platform', 'perpsAssetGroup')).toContain('assetGroup')
		expect(getRwaHiddenColumnIds('none', 'perpsAsset')).toEqual(expect.arrayContaining(['assetGroup', 'asset']))
		expect(getRwaHiddenColumnIds('none', 'perpsOverview')).toEqual([])
	})
})
