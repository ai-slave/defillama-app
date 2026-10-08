import type { IRWAList } from '~/utils/metadata/types'
import type { RWAPageNav } from '../api.types'
import { normalizeRwaAssetGroup } from '../assetGroup'
import { filterCategoriesForStandardRwaOverview } from '../constants'
import { getRWAPlatformRoutes } from '../platformRoutes'
import { rwaSlug } from '../rwaSlug'
import { getRwaPlatformHref } from '../table/classificationHrefs'
import type { RWAPageKind } from './pageLayout'

export type RWAAssetsPageKind = Extract<RWAPageKind, 'overview' | 'chain' | 'category' | 'assetGroup' | 'platform'>

type Link = { label: string; to: string }

/** A nav row: 'All' leading to the list page, then the siblings; the page it is on lights up, else All. */
function buildRwaNav(heading: string, allHref: string, links: Array<Link>, active: string | null): RWAPageNav {
	return { heading, links: [{ label: 'All', to: allHref }, ...links], active: active ?? 'All' }
}

/**
 * The nav row of an Assets page: its siblings, 'All' leading to the list page. A platform page leaves out the platforms
 * that redirect to their venue page, so no link leaves the Assets tree.
 */
export function getRwaAssetsPageNav(
	kind: RWAAssetsPageKind,
	{
		rwaList,
		assetGroups,
		redirectingPlatforms
	}: { rwaList: IRWAList; assetGroups: Array<string>; redirectingPlatforms?: ReadonlySet<string> },
	active: string | null
): RWAPageNav {
	switch (kind) {
		case 'overview':
		case 'chain':
			return buildRwaNav(
				'Chains',
				'/rwa',
				rwaList.chains.map((chain) => ({ label: chain, to: `/rwa/chain/${rwaSlug(chain)}` })),
				active
			)
		case 'category':
			return buildRwaNav(
				'Categories',
				'/rwa/categories',
				filterCategoriesForStandardRwaOverview(rwaList.categories).map((category) => ({
					label: category,
					to: `/rwa/category/${rwaSlug(category)}`
				})),
				active
			)
		case 'assetGroup':
			return buildRwaNav(
				'Asset groups',
				'/rwa/asset-groups',
				assetGroups.map((assetGroup) => {
					const name = normalizeRwaAssetGroup(assetGroup)
					return { label: name, to: `/rwa/asset-group/${rwaSlug(name)}` }
				}),
				active
			)
		case 'platform':
			return buildRwaNav(
				'Platforms',
				'/rwa/platforms',
				getRWAPlatformRoutes(rwaList)
					.filter((platform) => !redirectingPlatforms?.has(platform.slug))
					.map((platform) => ({ label: platform.name, to: `/rwa/platform/${platform.slug}` })),
				active
			)
	}
}

/** The nav row of a Perps page: the asset groups, 'All' leading to /rwa/perps; an underlying's page lights its group. */
export function getRwaPerpsPageNav(assetGroups: Array<string>, active: string | null): RWAPageNav {
	return buildRwaNav(
		'Asset groups',
		'/rwa/perps',
		assetGroups.map((assetGroup) => ({ label: assetGroup, to: `/rwa/perps/asset-group/${rwaSlug(assetGroup)}` })),
		active
	)
}

/** The nav row of a venue page: every venue, 'All' leading to /rwa/perps. */
export function getRwaVenuePageNav(venues: Array<string>, active: string): RWAPageNav {
	return buildRwaNav(
		'Venues',
		'/rwa/perps',
		venues.map((venue) => ({ label: venue, to: getRwaPlatformHref(venue, 'perps') })),
		active
	)
}
