import type { RWAAssetOverviewRow, RWAOverviewDisplayRow } from '../api.types'

export type RWANewListing = { asset: RWAAssetOverviewRow; firstSeen: number }

export const RWA_NEW_LISTING_WINDOW_DAYS = 30
export const RWA_NEW_LISTINGS_LIMIT = 6
const DAY_MS = 86_400_000

/** Spot rows first seen inside the window, largest active mcap first. */
export function getRwaNewListings(
	assets: Array<RWAOverviewDisplayRow>,
	now: number,
	limit = RWA_NEW_LISTINGS_LIMIT
): Array<RWANewListing> {
	const since = now - RWA_NEW_LISTING_WINDOW_DAYS * DAY_MS
	const listings: Array<RWANewListing> = []
	for (const asset of assets) {
		if (asset.kind !== 'spot' || asset.firstSeen == null || asset.firstSeen < since) continue
		listings.push({ asset, firstSeen: asset.firstSeen })
	}
	listings.sort((a, b) => (b.asset.activeMcap?.total ?? 0) - (a.asset.activeMcap?.total ?? 0))
	return listings.slice(0, limit)
}
