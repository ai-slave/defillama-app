import type { RWAOverviewMode } from '../constants'
import type { RWAGroupBy } from '../table/groupBy'

/**
 * The frame of every /rwa page, read from its route: which section tab is active, which rows the table shows, the
 * filter mode and the Group by a page opens with. Assets and Perps are two mirrored route trees; a page never
 * switches row kind, it links to the other tree.
 */

export type RWAPageKind =
	| 'overview'
	| 'chain'
	| 'category'
	| 'assetGroup'
	| 'platform'
	| 'perpsOverview'
	| 'perpsAssetGroup'
	| 'perpsAsset'
	| 'venue'

/** The section tab and the rows its table shows. */
export type RWASection = 'assets' | 'perps'

type RWAPageLayout = {
	section: RWASection
	/** The scope the filters and the default inclusion read: a page drops the filter of its own dimension. */
	mode: RWAOverviewMode
	/** 'platform' reads Venue on perps rows. */
	defaultGroupBy: RWAGroupBy
}

const LAYOUTS: Record<RWAPageKind, RWAPageLayout> = {
	overview: { section: 'assets', mode: 'chain', defaultGroupBy: 'platform' },
	chain: { section: 'assets', mode: 'chain', defaultGroupBy: 'platform' },
	category: { section: 'assets', mode: 'category', defaultGroupBy: 'platform' },
	assetGroup: { section: 'assets', mode: 'assetGroup', defaultGroupBy: 'platform' },
	platform: { section: 'assets', mode: 'platform', defaultGroupBy: 'none' },
	perpsOverview: { section: 'perps', mode: 'chain', defaultGroupBy: 'platform' },
	perpsAssetGroup: { section: 'perps', mode: 'assetGroup', defaultGroupBy: 'platform' },
	perpsAsset: { section: 'perps', mode: 'chain', defaultGroupBy: 'none' },
	venue: { section: 'perps', mode: 'platform', defaultGroupBy: 'none' }
}

export function getRwaPageLayout(kind: RWAPageKind): RWAPageLayout {
	return LAYOUTS[kind]
}

export const RWA_SECTION_TABS: ReadonlyArray<{ section: RWASection; label: string; href: string }> = [
	{ section: 'assets', label: 'Assets', href: '/rwa' },
	{ section: 'perps', label: 'Perps', href: '/rwa/perps' }
]
