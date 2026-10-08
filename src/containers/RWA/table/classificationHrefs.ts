import { UNKNOWN_RWA_ASSET_GROUP } from '../assetGroup'
import { rwaSlug } from '../rwaSlug'

/**
 * The page a classification value links to, by the row kind: asset rows open the Assets tree, perps rows the Perps
 * tree. The Assets tree serves an Unknown group page; the Perps tree lists named groups only, so Unknown stays text.
 */
export function getRwaAssetGroupHref(assetGroup: string, kind: 'spot' | 'perps'): string | null {
	if (kind === 'perps') {
		return assetGroup === UNKNOWN_RWA_ASSET_GROUP ? null : `/rwa/perps/asset-group/${rwaSlug(assetGroup)}`
	}
	return `/rwa/asset-group/${rwaSlug(assetGroup)}`
}

export function getRwaPerpsAssetHref(asset: string): string {
	return `/rwa/perps/asset/${rwaSlug(asset)}`
}

/** A platform's page: the venue page for a perps row, the platform page for an asset row. */
export function getRwaPlatformHref(platform: string, kind: 'spot' | 'perps'): string {
	return kind === 'perps' ? `/rwa/perps/venue/${rwaSlug(platform)}` : `/rwa/platform/${rwaSlug(platform)}`
}
