import { describe, expect, test } from 'vitest'
import { getRwaAssetsInlineFilters, getRwaPerpsInlineFilters } from '../inlineFilters'
import type { RWAPageKind } from '../pageLayout'

describe('the inline filters of a page', () => {
	const cases: Array<[RWAPageKind, Array<string>]> = [
		['overview', ['categories', 'assetGroups', 'accessModels']],
		['chain', ['categories', 'assetGroups', 'accessModels']],
		['category', ['assetGroups', 'accessModels']],
		['assetGroup', ['categories', 'accessModels']],
		['platform', ['categories', 'assetGroups', 'accessModels']],
		['perpsOverview', ['venueType', 'assetClasses', 'assetGroups', 'baseAssets']],
		['perpsAssetGroup', ['venueType', 'assetClasses', 'baseAssets']],
		['perpsAsset', ['venueType', 'assetClasses']],
		// One Filters button: the venue's filters all sit in the dialog.
		['venue', []]
	]

	test.each(cases)('the %s page shows %j inline, a scope page dropping its own dimension', (kind, expected) => {
		expect([...getRwaAssetsInlineFilters(kind), ...getRwaPerpsInlineFilters(kind)]).toEqual(expected)
	})
})
