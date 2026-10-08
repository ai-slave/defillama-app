import type { RWASelectFilterKey } from '../filterState'
import { getRwaPageLayout, type RWAPageKind } from './pageLayout'

/**
 * The filters a page shows inline in its filter strip; every other filter sits behind More filters. A scope page
 * drops its own dimension, inline and in the dialog. On the Perps tree `venueType` is the DEX and CEX choice and
 * `baseAssets` the market's underlying.
 */
export type RWAAssetsInlineFilterKey = Extract<RWASelectFilterKey, 'categories' | 'assetGroups' | 'accessModels'>
type RWAPerpsInlineFilterKey = 'venueType' | 'assetClasses' | 'assetGroups' | 'baseAssets'

const ASSETS_INLINE_FILTERS: ReadonlyArray<RWAAssetsInlineFilterKey> = ['categories', 'assetGroups', 'accessModels']
const PERPS_INLINE_FILTERS: ReadonlyArray<RWAPerpsInlineFilterKey> = [
	'venueType',
	'assetClasses',
	'assetGroups',
	'baseAssets'
]

/** The dimensions a page is scoped to. An underlying sits in one asset group, a venue is one venue. */
const OWN_DIMENSIONS: Partial<Record<RWAPageKind, ReadonlyArray<string>>> = {
	category: ['categories'],
	assetGroup: ['assetGroups'],
	perpsAssetGroup: ['assetGroups'],
	perpsAsset: ['assetGroups', 'baseAssets'],
	venue: ['venues']
}

export function getRwaOwnDimensions(kind: RWAPageKind): ReadonlyArray<string> {
	return OWN_DIMENSIONS[kind] ?? []
}

export function getRwaAssetsInlineFilters(kind: RWAPageKind): ReadonlyArray<RWAAssetsInlineFilterKey> {
	const own = getRwaOwnDimensions(kind)
	return getRwaPageLayout(kind).section === 'assets' ? ASSETS_INLINE_FILTERS.filter((key) => !own.includes(key)) : []
}

export function getRwaPerpsInlineFilters(kind: RWAPageKind): ReadonlyArray<RWAPerpsInlineFilterKey> {
	// The venue page has one Filters button: every filter sits in its dialog.
	if (kind === 'venue') return []
	const own = getRwaOwnDimensions(kind)
	return getRwaPageLayout(kind).section === 'perps' ? PERPS_INLINE_FILTERS.filter((key) => !own.includes(key)) : []
}
